import { api } from "@/lib/api";

let currentTimezone = "Asia/Tashkent";
let loaded = false;

export async function loadTimezone(): Promise<void> {
  try {
    const res = await api.get<{ currency: string; timezone: string }>("/settings/general");
    currentTimezone = res.data.timezone || "Asia/Tashkent";
    loaded = true;
  } catch {
    // keep default
  }
}

export function setTimezone(tz: string) {
  currentTimezone = tz;
}

export function getTimezone(): string {
  return currentTimezone;
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString("ru-RU", {
    timeZone: currentTimezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("ru-RU", {
    timeZone: currentTimezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("ru-RU", {
    timeZone: currentTimezone,
    hour: "2-digit", minute: "2-digit",
  });
}

export function isLoaded(): boolean {
  return loaded;
}
