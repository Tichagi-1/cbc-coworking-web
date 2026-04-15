import Cookies from "js-cookie";
import { PERMS_COOKIE, ROLE_COOKIE } from "@/lib/api";

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
  return getPermissions().includes(permission);
}

export function getRole(): string {
  if (typeof window === "undefined") return "";
  return Cookies.get(ROLE_COOKIE) || "";
}
