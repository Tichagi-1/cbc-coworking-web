"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Cookies from "js-cookie";

import { api, ROLE_COOKIE } from "@/lib/api";
import type {
  AvailabilitySlot,
  Booking,
  MeetingRoom,
  Tenant,
  UserRole,
} from "@/lib/types";

const SLOT_COUNT = 24; // 08:00..20:00 in 30-min blocks (last slot is 19:30–20:00)
const FIRST_HOUR = 8;

function slotIndexToTime(i: number): string {
  const minutes = FIRST_HOUR * 60 + i * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildIso(date: string, slotIndex: number): string {
  // date is YYYY-MM-DD; produce a naive ISO string the backend stores as-is
  const minutes = FIRST_HOUR * 60 + slotIndex * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0"
  )}:00`;
}

export default function BookingsPage() {
  const [role, setRole] = useState<UserRole | undefined>(undefined);
  useEffect(() => {
    setRole(Cookies.get(ROLE_COOKIE) as UserRole | undefined);
  }, []);
  const isAdmin = role === "admin" || role === "manager";

  // ── Data ────────────────────────────────────────────────────────────────
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]); // admin only
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);

  // Slot selection (start/end indices, both inclusive)
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  // ── Initial loads ───────────────────────────────────────────────────────
  useEffect(() => {
    api
      .get<MeetingRoom[]>("/meeting-rooms")
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

  // Admins also fetch the full tenant list so they can pick whom to book for
  useEffect(() => {
    if (!isAdmin) return;
    api
      .get<Tenant[]>("/tenants/")
      .then((res) => {
        setAllTenants(res.data);
        // If admin has no own tenant, default to the first one in the list
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
        setSelStart(null);
        setSelEnd(null);
      })
      .catch((e) => setError(e?.message || "Failed to load availability"));
  }, [selectedRoomId, date]);

  // Fetch my bookings (current tenant)
  const refreshMyBookings = useCallback(async () => {
    if (!tenant) {
      setMyBookings([]);
      return;
    }
    try {
      const res = await api.get<Booking[]>("/bookings", {
        params: { tenant_id: tenant.id },
      });
      // Keep only upcoming
      const now = dayjs();
      const upcoming = res.data
        .filter((b) => dayjs(b.end_time).isAfter(now))
        .sort((a, b) =>
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

  // ── Selection logic ─────────────────────────────────────────────────────
  function handleSlotClick(i: number) {
    const slot = slots[i];
    if (!slot || !slot.available) return;
    if (selStart == null || (selStart != null && selEnd != null)) {
      setSelStart(i);
      setSelEnd(null);
      return;
    }
    // selStart set, selEnd not yet
    if (i < selStart) {
      setSelStart(i);
      return;
    }
    // Make sure every slot in [selStart..i] is available
    for (let k = selStart; k <= i; k++) {
      if (!slots[k].available) {
        // Truncate selection at the last contiguous available slot
        setSelEnd(k - 1 >= selStart ? k - 1 : selStart);
        return;
      }
    }
    setSelEnd(i);
  }

  // ── Cost calculation ────────────────────────────────────────────────────
  const cost = useMemo(() => {
    if (!selectedRoom || selStart == null) return null;
    const endIdx = selEnd ?? selStart;
    const slotsCount = endIdx - selStart + 1;
    const hours = slotsCount * 0.5;
    const coinsNeeded = hours * selectedRoom.rate_coins_per_hour;

    if (!tenant) {
      return { hours, coinsNeeded, free: false, coinsOwed: 0, moneyOwed: 0 };
    }

    if (tenant.is_resident) {
      if (tenant.coin_balance >= coinsNeeded) {
        return { hours, coinsNeeded, free: true, coinsOwed: 0, moneyOwed: 0 };
      }
      const coinsOwed = coinsNeeded - tenant.coin_balance;
      const ratio =
        selectedRoom.rate_coins_per_hour > 0
          ? selectedRoom.rate_money_per_hour /
            selectedRoom.rate_coins_per_hour
          : 0;
      const moneyOwed = Math.round(coinsOwed * ratio * 100) / 100;
      return { hours, coinsNeeded, free: false, coinsOwed, moneyOwed };
    }

    // Non-resident: pure cash
    const moneyOwed =
      Math.round(hours * selectedRoom.rate_money_per_hour * 100) / 100;
    return { hours, coinsNeeded, free: false, coinsOwed: 0, moneyOwed };
  }, [selectedRoom, selStart, selEnd, tenant]);

  // ── Book ────────────────────────────────────────────────────────────────
  async function handleBook() {
    if (!selectedRoom || !tenant || selStart == null) return;
    setSubmitting(true);
    setError(null);
    try {
      const endIdx = selEnd ?? selStart;
      const start_time = buildIso(date, selStart);
      const end_time = buildIso(date, endIdx + 1); // +1 because slot is half-open at the end
      const res = await api.post<Booking>("/bookings", {
        room_id: selectedRoom.id,
        tenant_id: tenant.id,
        start_time,
        end_time,
      });
      // Refresh: availability, tenant balance, my bookings
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
      setSelStart(null);
      setSelEnd(null);
      if (meRes) setTenant(meRes);
      else if (isAdmin) {
        // refresh tenant in admin list
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
      // Refetch bookings + balance + availability
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

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT — room list */}
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
                <div className="text-xs text-gray-500">
                  {r.capacity} seats
                </div>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                💰 {r.rate_coins_per_hour}/hr · ${r.rate_money_per_hour}/hr
              </div>
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

      {/* RIGHT — booking interface */}
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
              💰 {tenant ? `${tenant.coin_balance} coins` : "no tenant"}
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
              ×
            </button>
          </div>
        )}

        {toast && (
          <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md p-3">
            ✓ {toast}
          </div>
        )}

        {/* Timeline */}
        {selectedRoom ? (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">
              {selectedRoom.name} · {dayjs(date).format("dddd, MMM D")}
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((slot, i) => {
                const isSelected =
                  selStart != null &&
                  i >= selStart &&
                  i <= (selEnd ?? selStart);
                let cls = "border text-xs px-2 py-2 rounded transition ";
                if (isSelected) {
                  cls +=
                    "bg-cbc-blue text-white border-cbc-blue cursor-pointer";
                } else if (slot.available) {
                  cls +=
                    "bg-green-50 text-green-800 border-green-200 hover:border-green-500 cursor-pointer";
                } else {
                  cls +=
                    "bg-red-50 text-red-700 border-red-200 cursor-not-allowed opacity-70";
                }
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => handleSlotClick(i)}
                    className={cls}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>

            {/* Cost preview */}
            {cost && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md text-sm">
                <span className="font-medium text-gray-900">
                  {cost.hours}{" "}
                  {cost.hours === 1 ? "hour" : "hours"}: {cost.coinsNeeded}{" "}
                  coins
                </span>
                {tenant && (
                  <span className="text-gray-500">
                    {" "}
                    (you have {tenant.coin_balance})
                  </span>
                )}{" "}
                →{" "}
                {cost.free ? (
                  <span className="font-bold text-green-700">FREE</span>
                ) : (
                  <span className="font-bold text-gray-900">
                    {cost.coinsOwed > 0 && `${cost.coinsOwed} coins + `}
                    ${cost.moneyOwed.toFixed(2)}
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={
                  submitting ||
                  selStart == null ||
                  !tenant ||
                  rooms.length === 0
                }
                onClick={handleBook}
                className="px-4 py-2 text-sm font-semibold text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md disabled:opacity-50"
              >
                {submitting ? "Booking…" : "Book Now"}
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
                const room = rooms.find((r) => r.id === b.room_id);
                return (
                  <li
                    key={b.id}
                    className="py-2.5 flex items-center justify-between text-sm"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {room?.name ?? `Room #${b.room_id}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {dayjs(b.start_time).format("MMM D, HH:mm")} –{" "}
                        {dayjs(b.end_time).format("HH:mm")}
                        {b.coins_charged > 0 && (
                          <span> · {b.coins_charged} coins</span>
                        )}
                        {b.money_charged > 0 && (
                          <span> · ${b.money_charged}</span>
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
