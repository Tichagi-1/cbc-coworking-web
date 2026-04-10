"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Cookies from "js-cookie";

import { api, ROLE_COOKIE } from "@/lib/api";
import type {
  AvailabilitySlot,
  Booking,
  Resource,
  Tenant,
  UserRole,
} from "@/lib/types";

const FIRST_HOUR = 8;
const LAST_HOUR = 20;
const UZS_RATE = 12800;

/** Round minutes UP to next 5-min boundary */
function roundUp5(m: number): number {
  return Math.ceil(m / 5) * 5;
}

/** Return "HH:MM" for an hour+minute value */
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
  mins = roundUp5(mins);
  if (mins < FIRST_HOUR * 60) mins = FIRST_HOUR * 60;
  if (mins >= LAST_HOUR * 60) mins = FIRST_HOUR * 60; // wrap to start
  return hhmm(mins);
}

function defaultTo(from: string): string {
  const fromMins = timeToMinutes(from);
  let toMins = fromMins + 60;
  if (toMins > LAST_HOUR * 60) toMins = LAST_HOUR * 60;
  return hhmm(toMins);
}

export default function BookingsPage() {
  const [role, setRole] = useState<UserRole | undefined>(undefined);
  useEffect(() => {
    setRole(Cookies.get(ROLE_COOKIE) as UserRole | undefined);
  }, []);
  const isAdmin = role === "admin" || role === "manager";

  // ── Data ────────────────────────────────────────────────────────────────
  const [rooms, setRooms] = useState<Resource[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);

  // Time picker state
  const [timeFrom, setTimeFrom] = useState(defaultFrom);
  const [timeTo, setTimeTo] = useState(() => defaultTo(defaultFrom()));

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leadTimeWarning, setLeadTimeWarning] = useState<string | null>(null);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  // ── Initial loads ───────────────────────────────────────────────────────
  useEffect(() => {
    api
      .get<Resource[]>("/resources", { params: { type: "meeting_room" } })
      .then((res) => {
        setRooms(res.data);
        if (res.data.length > 0) setSelectedRoomId(res.data[0].id);
      })
      .catch((e) => setError(e?.message || "Failed to load meeting rooms"));

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

  // Refetch availability whenever room or date changes
  useEffect(() => {
    if (!selectedRoomId) {
      setSlots([]);
      return;
    }
    api
      .get<AvailabilitySlot[]>(
        `/meeting-rooms/${selectedRoomId}/availability`,
        { params: { date } }
      )
      .then((res) => {
        setSlots(res.data);
      })
      .catch((e) => setError(e?.message || "Failed to load availability"));
  }, [selectedRoomId, date]);

  // Fetch my bookings
  const refreshMyBookings = useCallback(async () => {
    if (!tenant) {
      setMyBookings([]);
      return;
    }
    try {
      const res = await api.get<Booking[]>("/bookings", {
        params: { tenant_id: tenant.id },
      });
      const now = dayjs();
      const upcoming = res.data
        .filter((b) => dayjs(b.end_time).isAfter(now))
        .sort(
          (a, b) =>
            dayjs(a.start_time).valueOf() - dayjs(b.start_time).valueOf()
        );
      setMyBookings(upcoming);
    } catch {
      setMyBookings([]);
    }
  }, [tenant]);

  useEffect(() => {
    refreshMyBookings();
  }, [refreshMyBookings]);

  // ── Lead-time auto-adjust ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedRoom) {
      setLeadTimeWarning(null);
      return;
    }
    const advMin = selectedRoom.min_advance_minutes || 0;
    if (advMin <= 0) {
      setLeadTimeWarning(null);
      return;
    }
    const now = dayjs();
    const startDt = dayjs(`${date}T${timeFrom}:00`);
    const earliest = now.add(advMin, "minute");
    if (startDt.isBefore(earliest)) {
      // Auto-adjust
      let newMins = roundUp5(earliest.hour() * 60 + earliest.minute());
      if (newMins > LAST_HOUR * 60 - 30) {
        setLeadTimeWarning(
          `This room requires ${advMin} min advance booking. No available start time today.`
        );
        return;
      }
      if (newMins < FIRST_HOUR * 60) newMins = FIRST_HOUR * 60;
      const newFrom = hhmm(newMins);
      setTimeFrom(newFrom);
      // Adjust "to" if needed
      const toMins = timeToMinutes(timeTo);
      if (toMins <= newMins + 30) {
        const newTo = hhmm(Math.min(newMins + 60, LAST_HOUR * 60));
        setTimeTo(newTo);
      }
      setLeadTimeWarning(
        `Adjusted to ${newFrom} (${advMin} min advance required)`
      );
    } else {
      setLeadTimeWarning(null);
    }
    // Only run when room/date changes, not on every timeFrom change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom?.id, date]);

  // ── Overlap check ──────────────────────────────────────────────────────
  const bookedIntervals = useMemo(() => {
    return slots
      .filter((s) => !s.available)
      .map((s) => {
        const start = timeToMinutes(s.time);
        return { start, end: start + 30 };
      });
  }, [slots]);

  const overlapError = useMemo(() => {
    const fromMins = timeToMinutes(timeFrom);
    const toMins = timeToMinutes(timeTo);
    for (const iv of bookedIntervals) {
      if (fromMins < iv.end && toMins > iv.start) {
        return `Overlaps with existing booking at ${hhmm(iv.start)}-${hhmm(iv.end)}`;
      }
    }
    return null;
  }, [timeFrom, timeTo, bookedIntervals]);

  // ── Validation ─────────────────────────────────────────────────────────
  const validationError = useMemo(() => {
    const fromMins = timeToMinutes(timeFrom);
    const toMins = timeToMinutes(timeTo);
    if (toMins <= fromMins) return "End time must be after start time";
    if (toMins - fromMins < 30) return "Minimum booking is 30 minutes";
    return null;
  }, [timeFrom, timeTo]);

  // ── Cost calculation ───────────────────────────────────────────────────
  const cost = useMemo(() => {
    if (!selectedRoom) return null;
    const fromMins = timeToMinutes(timeFrom);
    const toMins = timeToMinutes(timeTo);
    if (toMins <= fromMins) return null;

    const hours = (toMins - fromMins) / 60;
    const coinsRate = selectedRoom.rate_coins_per_hour ?? 0;
    const moneyRate = selectedRoom.rate_money_per_hour ?? 0;
    // Use plan meeting discount if available, otherwise fall back to resource discount
    const planDiscount =
      selectedRoom.plan?.meeting_discount_on
        ? selectedRoom.plan.meeting_discount_pct
        : 0;
    const discountPct = planDiscount > 0 ? planDiscount : (selectedRoom.resident_discount_pct || 0);
    const planName = planDiscount > 0 ? selectedRoom.plan?.name : null;
    const isResident = tenant?.is_resident ?? false;
    const discountMult = discountPct > 0 && isResident ? 1 - discountPct / 100 : 1;
    const effectiveMoneyRate = moneyRate * discountMult;

    const coinsNeeded = hours * coinsRate;

    if (!tenant) {
      const moneyOwed = Math.round(hours * effectiveMoneyRate * 100) / 100;
      const uzsOwed = Math.round(moneyOwed * UZS_RATE);
      return {
        hours,
        coinsNeeded,
        free: false,
        coinsOwed: 0,
        moneyOwed,
        uzsOwed,
        discountPct: isResident ? discountPct : 0,
        planName: isResident ? planName : null,
      };
    }

    if (isResident) {
      if (tenant.coin_balance >= coinsNeeded) {
        return {
          hours,
          coinsNeeded,
          free: true,
          coinsOwed: 0,
          moneyOwed: 0,
          uzsOwed: 0,
          discountPct,
          planName,
        };
      }
      const coinsOwed = coinsNeeded - tenant.coin_balance;
      const ratio = coinsRate > 0 ? effectiveMoneyRate / coinsRate : 0;
      const moneyOwed = Math.round(coinsOwed * ratio * 100) / 100;
      const uzsOwed = Math.round(moneyOwed * UZS_RATE);
      return {
        hours,
        coinsNeeded,
        free: false,
        coinsOwed,
        moneyOwed,
        uzsOwed,
        discountPct,
        planName,
      };
    }

    const moneyOwed = Math.round(hours * effectiveMoneyRate * 100) / 100;
    const uzsOwed = Math.round(moneyOwed * UZS_RATE);
    return {
      hours,
      coinsNeeded,
      free: false,
      coinsOwed: 0,
      moneyOwed,
      uzsOwed,
      discountPct: 0,
      planName: null,
    };
  }, [selectedRoom, timeFrom, timeTo, tenant]);

  // ── Book ────────────────────────────────────────────────────────────────
  async function handleBook() {
    if (!selectedRoom || !tenant) return;
    if (validationError || overlapError) return;
    setSubmitting(true);
    setError(null);
    try {
      const start_time = `${date}T${timeFrom}:00`;
      const end_time = `${date}T${timeTo}:00`;
      const res = await api.post<Booking>("/bookings", {
        resource_id: selectedRoom.id,
        tenant_id: tenant.id,
        start_time,
        end_time,
      });
      // Refresh
      const [avRes, meRes] = await Promise.all([
        api.get<AvailabilitySlot[]>(
          `/meeting-rooms/${selectedRoom.id}/availability`,
          { params: { date } }
        ),
        api
          .get<Tenant | null>("/tenants/me")
          .then((r) => r.data)
          .catch(() => null),
      ]);
      setSlots(avRes.data);
      if (meRes) setTenant(meRes);
      else if (isAdmin) {
        const tlist = await api.get<Tenant[]>("/tenants/");
        const updated = tlist.data.find((t) => t.id === tenant.id) ?? tenant;
        setAllTenants(tlist.data);
        setTenant(updated);
      }
      await refreshMyBookings();
      setToast(
        `Booked ${selectedRoom.name} from ${dayjs(res.data.start_time).format(
          "HH:mm"
        )} to ${dayjs(res.data.end_time).format("HH:mm")}`
      );
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

  async function handleCancel(bookingId: number) {
    try {
      await api.delete(`/bookings/${bookingId}`);
      await refreshMyBookings();
      const meRes = await api
        .get<Tenant | null>("/tenants/me")
        .then((r) => r.data)
        .catch(() => null);
      if (meRes) setTenant(meRes);
      if (selectedRoomId) {
        const av = await api.get<AvailabilitySlot[]>(
          `/meeting-rooms/${selectedRoomId}/availability`,
          { params: { date } }
        );
        setSlots(av.data);
      }
      setToast("Booking cancelled");
      setTimeout(() => setToast(null), 4000);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Cancellation failed");
    }
  }

  // ── Timeline bar helpers ───────────────────────────────────────────────
  const TOTAL_MINUTES = (LAST_HOUR - FIRST_HOUR) * 60; // 720

  function minutesToPct(mins: number): number {
    return ((mins - FIRST_HOUR * 60) / TOTAL_MINUTES) * 100;
  }

  const timelineSegments = useMemo(() => {
    // Build segments: available (green), booked (red), selected (blue)
    const fromMins = timeToMinutes(timeFrom);
    const toMins = timeToMinutes(timeTo);
    const selValid = toMins > fromMins && !validationError;

    const segments: { start: number; end: number; type: "booked" | "selected" }[] = [];

    // Booked segments from slots
    for (const s of slots) {
      if (!s.available) {
        const sm = timeToMinutes(s.time);
        segments.push({ start: sm, end: sm + 30, type: "booked" });
      }
    }

    // Selected segment
    if (selValid) {
      segments.push({ start: fromMins, end: toMins, type: "selected" });
    }

    return segments;
  }, [slots, timeFrom, timeTo, validationError]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT - room list */}
      <div className="lg:col-span-1 space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
          Meeting rooms
        </h2>
        {rooms.length === 0 && (
          <div className="text-sm text-gray-500">No meeting rooms yet.</div>
        )}
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
                <div className="text-xs text-gray-500">{r.capacity} seats</div>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {r.rate_coins_per_hour ?? 0}/hr coins &middot; ${r.rate_money_per_hour ?? 0}/hr
              </div>
              {r.resident_discount_pct > 0 && (
                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-semibold">
                  -{r.resident_discount_pct}% resident
                </span>
              )}
              {r.amenities && r.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.amenities.map((a) => (
                    <span
                      key={a}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* RIGHT - booking interface */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
            />
          </div>

          {isAdmin && allTenants.length > 0 && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Booking for tenant
              </label>
              <select
                value={tenant?.id ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setTenant(allTenants.find((t) => t.id === id) ?? null);
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                {allTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="ml-auto inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1.5">
            <span className="text-yellow-700 font-semibold text-sm">
              {tenant ? `${tenant.coin_balance} coins` : "no tenant"}
            </span>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 flex items-start justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-700 ml-4"
            >
              x
            </button>
          </div>
        )}

        {toast && (
          <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md p-3">
            {toast}
          </div>
        )}

        {leadTimeWarning && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
            {leadTimeWarning}
          </div>
        )}

        {/* Booking panel */}
        {selectedRoom ? (
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="text-sm font-semibold text-gray-900">
              {selectedRoom.name} &middot; {dayjs(date).format("dddd, MMM D")}
            </div>

            {/* Time pickers */}
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  From
                </label>
                <input
                  type="time"
                  step={300}
                  min="08:00"
                  max="20:00"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  To
                </label>
                <input
                  type="time"
                  step={300}
                  min="08:00"
                  max="20:00"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                />
              </div>
              {cost && (
                <div className="text-sm text-gray-600">
                  {cost.hours.toFixed(1)} hr
                  {cost.hours !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            {validationError && (
              <div className="text-sm text-red-700 font-medium">{validationError}</div>
            )}
            {overlapError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2 font-medium">
                {overlapError}
              </div>
            )}

            {/* Timeline bar */}
            <div>
              <div className="text-xs text-gray-500 mb-1">08:00 - 20:00 timeline</div>
              <div className="relative h-8 bg-green-100 rounded-md overflow-hidden border border-gray-200">
                {timelineSegments.map((seg, i) => {
                  const left = minutesToPct(seg.start);
                  const width = minutesToPct(seg.end) - left;
                  const color =
                    seg.type === "booked"
                      ? "bg-red-400"
                      : "bg-blue-500";
                  return (
                    <div
                      key={`${seg.type}-${i}`}
                      className={`absolute top-0 bottom-0 ${color}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  );
                })}
                {/* Hour markers */}
                {Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => {
                  const hr = FIRST_HOUR + i;
                  const pct = minutesToPct(hr * 60);
                  return (
                    <div
                      key={hr}
                      className="absolute top-0 bottom-0 border-l border-gray-300/50"
                      style={{ left: `${pct}%` }}
                    >
                      <span className="absolute -top-4 text-[9px] text-gray-400 -translate-x-1/2">
                        {hr}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-1 text-[10px] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 rounded bg-green-100 border border-gray-200" /> available
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 rounded bg-red-400" /> booked
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 rounded bg-blue-500" /> selected
                </span>
              </div>
            </div>

            {/* Cost preview */}
            {cost && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm">
                <span className="font-medium text-gray-900">
                  {cost.hours.toFixed(1)}{" "}
                  {cost.hours === 1 ? "hour" : "hours"}: {cost.coinsNeeded.toFixed(1)}{" "}
                  coins
                </span>
                {tenant && (
                  <span className="text-gray-500">
                    {" "}
                    (you have {tenant.coin_balance})
                  </span>
                )}{" "}
                {" -> "}
                {cost.free ? (
                  <span className="font-bold text-green-700">FREE</span>
                ) : (
                  <span className="font-bold text-gray-900">
                    {cost.coinsOwed > 0 && `${cost.coinsOwed.toFixed(1)} coins + `}
                    ${cost.moneyOwed.toFixed(2)}
                    <span className="text-gray-500 font-normal ml-1">
                      ({cost.uzsOwed.toLocaleString()}{"\u00A0"}sum)
                    </span>
                  </span>
                )}
                {cost.discountPct > 0 && (
                  <span className="ml-2 text-green-700 font-semibold text-xs">
                    {cost.planName
                      ? `${cost.planName}: ${cost.discountPct}% resident discount`
                      : `-${cost.discountPct}% resident discount`}
                  </span>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={
                  submitting ||
                  !tenant ||
                  rooms.length === 0 ||
                  !!validationError ||
                  !!overlapError
                }
                onClick={handleBook}
                className="px-4 py-2 text-sm font-semibold text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md disabled:opacity-50"
              >
                {submitting ? "Booking..." : "Book Now"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 p-8 border border-dashed border-gray-300 rounded-md">
            Select a meeting room from the left to see availability.
          </div>
        )}

        {/* My upcoming bookings */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            My upcoming bookings
          </h3>
          {myBookings.length === 0 ? (
            <div className="text-sm text-gray-500">No upcoming bookings.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {myBookings.map((b) => {
                const room = rooms.find((r) => r.id === b.resource_id);
                return (
                  <li
                    key={b.id}
                    className="py-2.5 flex items-center justify-between text-sm"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {room?.name ?? `Room #${b.resource_id ?? "?"}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {dayjs(b.start_time).format("MMM D, HH:mm")} -{" "}
                        {dayjs(b.end_time).format("HH:mm")}
                        {b.coins_charged > 0 && (
                          <span> &middot; {b.coins_charged} coins</span>
                        )}
                        {b.money_charged > 0 && (
                          <span> &middot; ${b.money_charged}</span>
                        )}
                        {b.money_charged_uzs > 0 && (
                          <span className="text-gray-400">
                            {" "}
                            ({b.money_charged_uzs.toLocaleString()}{"\u00A0"}sum)
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancel(b.id)}
                      className="text-xs px-2.5 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
