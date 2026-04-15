import Cookies from "js-cookie";
import { PERMS_COOKIE, ROLE_COOKIE } from "@/lib/api";

export function getPermissions(): string[] {
  try {
    const raw = Cookies.get(PERMS_COOKIE);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function hasPermission(permission: string): boolean {
  const role = Cookies.get(ROLE_COOKIE) || "";
  if (role === "admin") return true;
  return getPermissions().includes(permission);
}

export function getRole(): string {
  return Cookies.get(ROLE_COOKIE) || "";
}
