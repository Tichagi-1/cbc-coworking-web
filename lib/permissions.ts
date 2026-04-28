import Cookies from "js-cookie";
import { PERMS_COOKIE, ROLE_COOKIE } from "@/lib/api";

// Cleanup-1: back-compat alias map for the view_workspace -> view_bookings
// rename (backend cbc-coworking-api PR #9, deployed 2026-04-28). A user's
// cookie might still carry the old name until they re-login. Remove this
// map in Cleanup-2 once all sessions have cycled.
const PERMISSION_ALIASES: Record<string, string> = {
  view_workspace: "view_bookings",
  view_bookings: "view_workspace",
};

export function getPermissions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = Cookies.get(PERMS_COOKIE);
    if (!raw) return [];
    // Handle both plain JSON and URL-encoded JSON
    const decoded = raw.startsWith("%5B") ? decodeURIComponent(raw) : raw;
    return JSON.parse(decoded);
  } catch {
    return [];
  }
}

export function hasPermission(permission: string): boolean {
  const role = getRole();
  if (role === "admin") return true;
  const perms = getPermissions();
  if (perms.includes(permission)) return true;
  const alias = PERMISSION_ALIASES[permission];
  return alias !== undefined && perms.includes(alias);
}

export function getRole(): string {
  if (typeof window === "undefined") return "";
  return Cookies.get(ROLE_COOKIE) || "";
}
