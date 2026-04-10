"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Cookies from "js-cookie";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createViewDay, createViewWeek } from "@schedule-x/calendar";
import { createDragAndDropPlugin } from "@schedule-x/drag-and-drop";
import { createEventModalPlugin } from "@schedule-x/event-modal";
import "@schedule-x/theme-default/dist/index.css";

import { api, ROLE_COOKIE } from "@/lib/api";
import type {
  Booking,
  Resource,
  Tenant,
  UserRole,
} from "@/lib/types";

const FIRST_HOUR = 8;
const LAST_HOUR = 20;
const UZS_RATE = 12800;

function hhmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function defaultFrom(): string {
  const now = dayjs();
  let mins = now.hour() * 60 + now.minute();
  mins = Math.ceil(mins / 5) * 5;
  if (mins < FIRST_HOUR * 60) mins = FIRST_HOUR * 60;
  if (mins >= LAST_HOUR * 60) mins = FIRST_HOUR * 60;
  return hhmm(mins);
}

export default function BookingsPage() {
  const [role, setRole] = useState<UserRole | undefined>(undefined);
  useEffect(() => {
    setRole(Cookies.get(ROLE_COOKIE) as UserRole | undefined);
  }, []);
  const isAdmin = role === "admin" || role === "manager";

  const [rooms, setRooms] = useState<Resource[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Booking form
  const [showBookForm, setShowBookForm] = useState(false);
  const [timeFrom, setTimeFrom] = useState(defaultFrom);
  const [timeTo, setTimeTo] = useState(() => {
    const f = defaultFrom();
    return hhmm(Math.min(timeToMinutes(f) + 60, LAST_HOUR * 60));
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  // ── Loads ───────────────────────────────────────────────────────────────
  useEffect(() => {
    api
      .get<Resource[]>("/resources", { params: { type: "meeting_room" } })
      .then((res) => {
        setRooms(res.data);
        if (res.data.length > 0) setSelectedRoomId(res.data[0].id);
      })
      .catch((e) => setError(e?.message || "Failed to load rooms"));

    api
      .get<Tenant | null>("/tenants/me")
      .then((res) => setTenant(res.data))
      .catch(() => setTenant(null));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get<Tenant[]>("/tenants/")
      .then((res) => {
        setAllTenants(res.data);
        if (!tenant && res.data.length > 0) setTenant(res.data[0]);
      })
      .catch(() => undefined);
  }, [isAdmin, tenant]);

  const refreshBookings = useCallback(async () => {
    if (!selectedRoomId) {
      setBookings([]);
      return;
    }
    try {
      const res = await api.get<Booking[]>("/bookings", {
        params: { resource_id: selectedRoomId },
      });
      setBookings(res.data);
    } catch {
      setBookings([]);
    }
  }, [selectedRoomId]);

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings, date]);

  // ── Schedule-X calendar ─────────────────────────────────────────────────
  const calendarEvents = useMemo(() => {
    return bookings.map((b) => ({
      id: String(b.id),
      title: selectedRoom?.name || "Booking",
      start: b.start_time.replace("T", " ").slice(0, 16),
      end: b.end_time.replace("T", " ").slice(0, 16),
      calendarId: "bookings",
    }));
  }, [bookings, selectedRoom]);

  const calendar = useCalendarApp({
    views: [createViewDay(), createViewWeek()],
    events: calendarEvents,
    calendars: {
      bookings: {
        colorName: "bookings",
        lightColors: {
          main: "#003DA5",
          container: "#dbeafe",
          onContainer: "#1e3a8a",
        },
      },
    },
    plugins: [createDragAndDropPlugin(5), createEventModalPlugin()],
    dayBoundaries: { start: "08:00", end: "20:00" },
    selectedDate: date,
    callbacks: {
      onEventUpdate(updatedEvent) {
        const bookingId = Number(updatedEvent.id);
        const start_time = String(updatedEvent.start).replace(" ", "T") + ":00";
        const end_time = String(updatedEvent.end).replace(" ", "T") + ":00";
        api
          .patch(`/bookings/${bookingId}`, { start_time, end_time })
          .then(() => {
            refreshBookings();
            setToast("Booking moved");
            setTimeout(() => setToast(null), 3000);
          })
          .catch(() => {
            setError("Failed to move booking");
            refreshBookings();
          });
      },
    },
  });

  // ── Cost preview ──────────────────────────────────────────────────────
  const cost = useMemo(() => {
    if (!selectedRoom) return null;
    const fromMins = timeToMinutes(timeFrom);
    const toMins = timeToMinutes(timeTo);
    if (toMins <= fromMins) return null;

    const hours = (toMins - fromMins) / 60;
    const coinsRate = selectedRoom.rate_coins_per_hour ?? 0;
    const moneyRate = selectedRoom.rate_money_per_hour ?? 0;
    const discountPct =
      selectedRoom.plan?.meeting_discount_on
        ? selectedRoom.plan.meeting_discount_pct
        : selectedRoom.resident_discount_pct || 0;
    const isResident = tenant?.is_resident ?? false;
    const discountMult =
      discountPct > 0 && isResident ? 1 - discountPct / 100 : 1;
    const effectiveMoneyRate = moneyRate * discountMult;
    const coinsNeeded = hours * coinsRate;

    if (!tenant) {
      return { hours, coinsNeeded, free: false, coinsOwed: 0, moneyOwed: 0, uzsOwed: 0 };
    }
    if (isResident) {
      if (tenant.coin_balance >= coinsNeeded) {
        return { hours, coinsNeeded, free: true, coinsOwed: 0, moneyOwed: 0, uzsOwed: 0 };
      }
      const coinsOwed = coinsNeeded - tenant.coin_balance;
      const ratio = coinsRate > 0 ? effectiveMoneyRate / coinsRate : 0;
      const moneyOwed = Math.round(coinsOwed * ratio * 100) / 100;
      return { hours, coinsNeeded, free: false, coinsOwed, moneyOwed, uzsOwed: Math.round(moneyOwed * UZS_RATE) };
    }
    const moneyOwed = Math.round(hours * effectiveMoneyRate * 100) / 100;
    return { hours, coinsNeeded, free: false, coinsOwed: 0, moneyOwed, uzsOwed: Math.round(moneyOwed * UZS_RATE) };
  }, [selectedRoom, timeFrom, timeTo, tenant]);

  // ── Book ────────────────────────────────────────────────────────────────
  async function handleBook() {
    if (!selectedRoom || !tenant) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/bookings", {
        resource_id: selectedRoom.id,
        tenant_id: tenant.id,
        start_time: `${date}T${timeFrom}:00`,
        end_time: `${date}T${timeTo}:00`,
      });
      await refreshBookings();
      const meRes = await api.get<Tenant | null>("/tenants/me").then((r) => r.data).catch(() => null);
      if (meRes) setTenant(meRes);
      setShowBookForm(false);
      setToast("Booked!");
      setTimeout(() => setToast(null), 4000);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || (e as Error)?.message;
      setError(detail || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: number) {
    try {
      await api.delete(`/bookings/${id}`);
      await refreshBookings();
      const meRes = await api.get<Tenant | null>("/tenants/me").then((r) => r.data).catch(() => null);
      if (meRes) setTenant(meRes);
      setToast("Cancelled");
      setTimeout(() => setToast(null), 3000);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Cancel failed");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT — room list */}
      <div className="lg:col-span-1 space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
          Meeting rooms
        </h2>
        {rooms.map((r) => {
          const active = r.id === selectedRoomId;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRoomId(r.id)}
              className={`block w-full text-left p-4 rounded-lg border transition ${
                active
                  ? "border-cbc-blue bg-cbc-blue/5 ring-1 ring-cbc-blue"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="font-semibold text-gray-900">{r.name}</div>
                <div className="text-xs text-gray-500">{r.capacity ?? 0} seats</div>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {r.rate_coins_per_hour ?? 0}/hr coins · ${r.rate_money_per_hour ?? 0}/hr
              </div>
              {r.amenities && r.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.amenities.map((a) => (
                    <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{a}</span>
                  ))}
                </div>
              )}
            </button>
          );
        })}

        <div className="pt-2">
          <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1.5">
            <span className="text-yellow-700 font-semibold text-sm">
              {tenant ? `${tenant.coin_balance} coins` : "no tenant"}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT — calendar + controls */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
            />
          </div>

          {isAdmin && allTenants.length > 0 && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Tenant</label>
              <select
                value={tenant?.id ?? ""}
                onChange={(e) => setTenant(allTenants.find((t) => t.id === Number(e.target.value)) ?? null)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                {allTenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.company_name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowBookForm(true)}
            disabled={!selectedRoom}
            className="px-4 py-2 text-sm font-semibold text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md disabled:opacity-50"
          >
            + New booking
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400">×</button>
          </div>
        )}
        {toast && (
          <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md p-3">{toast}</div>
        )}

        {/* Schedule-X calendar */}
        {selectedRoom ? (
          <div className="bg-white border border-gray-200 rounded-lg p-2 min-h-[500px]">
            <ScheduleXCalendar calendarApp={calendar} />
          </div>
        ) : (
          <div className="text-sm text-gray-500 p-8 border border-dashed border-gray-300 rounded-md">
            Select a meeting room.
          </div>
        )}

        {/* My bookings list */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Bookings for {selectedRoom?.name ?? "—"}
          </h3>
          {bookings.length === 0 ? (
            <div className="text-sm text-gray-500">No bookings.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <li key={b.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="text-xs text-gray-500">
                      {dayjs(b.start_time).format("MMM D, HH:mm")} – {dayjs(b.end_time).format("HH:mm")}
                      {b.coins_charged > 0 && <span> · {b.coins_charged} coins</span>}
                      {b.money_charged > 0 && <span> · ${b.money_charged}</span>}
                      {b.money_charged_uzs > 0 && (
                        <span className="text-gray-400"> ({b.money_charged_uzs.toLocaleString()} сум)</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancel(b.id)}
                    className="text-xs px-2.5 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Booking form modal */}
      {showBookForm && selectedRoom && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}
          onMouseDown={() => setShowBookForm(false)}
        >
          <div
            style={{ background: "white", borderRadius: 12, padding: 24, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Book {selectedRoom.name}
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">From</label>
                  <input
                    type="time"
                    step={300}
                    min="08:00"
                    max="20:00"
                    value={timeFrom}
                    onChange={(e) => {
                      setTimeFrom(e.target.value);
                      const m = timeToMinutes(e.target.value);
                      setTimeTo(hhmm(Math.min(m + 60, LAST_HOUR * 60)));
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">To</label>
                  <input
                    type="time"
                    step={300}
                    min="08:00"
                    max="20:00"
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {cost && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm">
                  <span className="font-medium">{cost.hours.toFixed(1)} hrs: {cost.coinsNeeded.toFixed(0)} coins</span>
                  {tenant && <span className="text-gray-500"> (have {tenant.coin_balance})</span>}
                  {" → "}
                  {cost.free ? (
                    <span className="font-bold text-green-700">FREE</span>
                  ) : (
                    <span className="font-bold">
                      {cost.coinsOwed > 0 && `${cost.coinsOwed.toFixed(0)} coins + `}
                      ${cost.moneyOwed.toFixed(2)}
                      {cost.uzsOwed > 0 && (
                        <span className="text-gray-500 font-normal ml-1">({cost.uzsOwed.toLocaleString()} сум)</span>
                      )}
                    </span>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowBookForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBook}
                  disabled={submitting || !tenant}
                  className="px-4 py-2 text-sm font-semibold text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md disabled:opacity-50"
                >
                  {submitting ? "Booking..." : "Book Now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
