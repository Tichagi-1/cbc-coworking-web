"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { getCurrencySymbol } from "@/lib/currency";
import type { Resource, Booking } from "@/lib/types";

const HOUR_HEIGHT = 60;

// Day-start / day-end now come from app_settings (working_hours_start /
// working_hours_end). The constants below are last-resort fallbacks if
// the GET /settings/booking call fails on mount.
const DEFAULT_DAY_START = 8;
const DEFAULT_DAY_END = 20;

// '24:00' from settings is allowed as the upper bound — parsed to 24 here
// and used as a 24-hour upper edge in pixel calculations.
const parseHourString = (s: string, fallback: number): number => {
  if (s === "24:00") return 24;
  const [h] = s.split(":").map(Number);
  return Number.isFinite(h) ? h : fallback;
};

const minToTime = (min: number) => {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

const timeToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const round5 = (min: number) => Math.round(min / 5) * 5;

// UZ convention: week starts Monday.
const startOfWeekMon = (d: Date): Date => {
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
};

const isoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const WEEKDAY_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function BookingsPage() {
  const [rooms, setRooms] = useState<Resource[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Resource | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tenants, setTenants] = useState<
    { id: number; company_name: string; coin_balance: number }[]
  >([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(
    null
  );
  const [coinBalance, setCoinBalance] = useState(0);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [view, setView] = useState<"day" | "week">("day");

  // Working-hours window — fetched on mount from GET /settings/booking.
  // Defaults render fine on first paint (and if the fetch fails).
  const [dayStart, setDayStart] = useState(DEFAULT_DAY_START);
  const [dayEnd, setDayEnd] = useState(DEFAULT_DAY_END);
  const totalHours = dayEnd - dayStart;

  // Pixel <-> time helpers depend on dayStart/dayEnd, so they're inside
  // the component to close over current state.
  const yToTime = useCallback(
    (y: number): string => {
      const totalMinutes = round5(Math.floor((y / HOUR_HEIGHT) * 60));
      const hour = dayStart + Math.floor(totalMinutes / 60);
      const min = totalMinutes % 60;
      return `${String(Math.min(hour, dayEnd)).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    },
    [dayStart, dayEnd]
  );

  const timeToY = useCallback(
    (timeStr: string): number => {
      const [h, m] = timeStr.split(":").map(Number);
      return (h - dayStart + m / 60) * HOUR_HEIGHT;
    },
    [dayStart]
  );

  const [showModal, setShowModal] = useState(false);
  const [modalFrom, setModalFrom] = useState("09:00");
  const [modalTo, setModalTo] = useState("10:00");
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);
  type PreviewData = {
    coins_used: number;
    cash_charged: number;
    discount_pct: number;
    discount_reason: string | null;
    coin_balance_after: number;
    duration_hours: number;
    payment_type: "coins" | "money";
  };
  type PreviewState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ok"; data: PreviewData }
    | { status: "error"; message: string };
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [role, setRole] = useState("");

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

  // Bookings filtered for a specific day. Day view uses this once with the
  // current selectedDate; week view calls it per column.
  const bookingsForDate = (iso: string) =>
    bookings.filter((b) => b.start_time.startsWith(iso));

  // Mon..Sun ISO dates derived from selectedDate, computed once per render.
  const weekDates: string[] =
    view === "week"
      ? (() => {
          const mon = startOfWeekMon(new Date(selectedDate + "T00:00:00"));
          return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(mon);
            d.setDate(mon.getDate() + i);
            return isoDate(d);
          });
        })()
      : [];

  const loadRooms = async () => {
    try {
      const res = await api.get<Resource[]>("/resources", {
        params: { type: "meeting_room,event_zone" },
      });
      setRooms(res.data);
      if (res.data.length > 0 && !selectedRoom)
        setSelectedRoom(res.data[0]);
    } catch {
      /* noop */
    }
  };

  const loadBookings = useCallback(async () => {
    if (!selectedRoom) return;
    try {
      const params: Record<string, string | number> = {
        resource_id: selectedRoom.id,
      };
      if (view === "week") {
        const mon = startOfWeekMon(new Date(selectedDate + "T00:00:00"));
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        params.start = isoDate(mon);
        params.end = isoDate(sun);
      } else {
        params.date = selectedDate;
      }
      const res = await api.get<Booking[]>("/bookings", { params });
      setBookings(res.data);
    } catch {
      /* noop */
    }
  }, [selectedRoom, view, selectedDate]);

  const loadTenants = async () => {
    try {
      const res = await api.get<
        { id: number; company_name: string; coin_balance: number }[]
      >("/tenants/");
      setTenants(res.data);
      if (res.data.length > 0) {
        setSelectedTenantId(res.data[0].id);
        setCoinBalance(res.data[0].coin_balance);
      }
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    setRole(document.cookie.match(/cbc_role=([^;]+)/)?.[1] || "");
    loadRooms();
    loadTenants();
    // Fire-and-forget — defaults render fine if this fails.
    api
      .get<{
        working_hours_start: string;
        working_hours_end: string;
        min_booking_minutes: number;
      }>("/settings/booking")
      .then((r) => {
        setDayStart(parseHourString(r.data.working_hours_start, DEFAULT_DAY_START));
        setDayEnd(parseHourString(r.data.working_hours_end, DEFAULT_DAY_END));
      })
      .catch(() => {
        /* keep defaults */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Cost preview — server-driven (POST /bookings/preview, debounced 300ms).
  // Replaced the previous naive client-side calc that had no awareness of
  // tenant.is_resident, plan.meeting_discount_*, or resource.resident_discount_pct
  // and silently disagreed with the actual billed amount for residents.
  useEffect(() => {
    if (!selectedRoom || !selectedTenantId) {
      setPreview({ status: "idle" });
      return;
    }
    const fromMin = timeToMin(modalFrom);
    const toMin = timeToMin(modalTo);
    if (toMin <= fromMin) {
      setPreview({ status: "error", message: "End must be after start" });
      return;
    }
    if (toMin - fromMin < 5) {
      setPreview({ status: "error", message: "Minimum 5 minutes" });
      return;
    }

    setPreview({ status: "loading" });
    const startISO = `${selectedDate}T${modalFrom}:00`;
    const endISO = `${selectedDate}T${modalTo}:00`;

    const handle = setTimeout(async () => {
      try {
        const res = await api.post<PreviewData>("/bookings/preview", {
          resource_id: selectedRoom.id,
          tenant_id: selectedTenantId,
          start_time: startISO,
          end_time: endISO,
        });
        setPreview({ status: "ok", data: res.data });
      } catch (e) {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        const msg = (e as { message?: string })?.message;
        setPreview({
          status: "error",
          message: detail || msg || "Unable to calculate — please review time range",
        });
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [modalFrom, modalTo, selectedRoom, selectedTenantId, selectedDate]);

  const handleBook = async () => {
    if (!selectedRoom || !selectedTenantId) return;
    setSaving(true);
    try {
      await api.post("/bookings", {
        resource_id: selectedRoom.id,
        tenant_id: selectedTenantId,
        start_time: `${selectedDate}T${modalFrom}:00`,
        end_time: `${selectedDate}T${modalTo}:00`,
      });
      setShowModal(false);
      await loadBookings();
      await loadTenants();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Booking failed";
      alert(detail);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await api.delete(`/bookings/${id}`);
      await loadBookings();
      await loadTenants();
    } catch (e: unknown) {
      alert((e as Error)?.message || "Cancel failed");
    }
  };

  const changeDate = (deltaDays: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + deltaDays);
    setSelectedDate(isoDate(d));
  };

  const navStep = view === "week" ? 7 : 1;

  // Timeline mouse handlers — `colDate` is the ISO date of the column the
  // pointer is in. Day view always passes selectedDate; week view passes
  // each column's own date. mouseUp commits selectedDate=colDate so all
  // downstream consumers (preview ISO, handleBook ISO) point at the right day.
  const handleTimelineMouseDown =
    (colDate: string) => (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      // Anchor the active day to the clicked column. In day view this is
      // a no-op; in week view it scopes the drag ghost (gated below by
      // colDate === selectedDate) and keeps preview/handleBook ISO-builds
      // pointed at the right day.
      if (colDate !== selectedDate) setSelectedDate(colDate);
      setDragStart(y);
      setDragEnd(y);
      setIsDragging(true);
    };
  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDragEnd(e.clientY - rect.top);
  };
  const handleTimelineMouseUp = (colDate: string) => () => {
    if (!isDragging || dragStart === null || dragEnd === null) return;
    setIsDragging(false);
    const minY = Math.min(dragStart, dragEnd);
    const maxY = Math.max(dragStart, dragEnd);
    if (maxY - minY < 5) return;
    const fromTime = yToTime(minY);
    const toTime = yToTime(maxY);
    if (colDate !== selectedDate) setSelectedDate(colDate);
    setModalFrom(fromTime);
    setModalTo(toTime);
    setEditBooking(null);
    setShowModal(true);
    setDragStart(null);
    setDragEnd(null);
  };

  // Memoized — depends on dayStart/dayEnd which can change after the
  // settings fetch resolves. Sliced at 5-minute granularity to match the
  // existing modal time-picker behavior.
  const timeSlots = useMemo(
    () =>
      Array.from(
        { length: (dayEnd - dayStart) * 12 + 1 },
        (_, i) => minToTime(dayStart * 60 + i * 5)
      ),
    [dayStart, dayEnd]
  );

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 64px)",
        overflow: "hidden",
      }}
    >
      {/* LEFT: Room selector */}
      <div
        style={{
          width: 280,
          borderRight: "1px solid var(--color-gray-200)",
          overflowY: "auto",
          padding: 16,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-gray-500)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 12,
          }}
        >
          MEETING ROOMS
        </div>

        {rooms.map((room) => (
          <div
            key={room.id}
            onClick={() => setSelectedRoom(room)}
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              marginBottom: 8,
              cursor: "pointer",
              border:
                selectedRoom?.id === room.id
                  ? "2px solid #003DA5"
                  : "1px solid var(--color-gray-200)",
              background:
                selectedRoom?.id === room.id ? "#eff6ff" : "white",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-gray-900)" }}>
              {room.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-gray-500)", marginTop: 2 }}>
              {room.capacity ?? 0} seats
            </div>
            <div style={{ fontSize: 12, color: "var(--color-gray-500)" }}>
              {room.rate_coins_per_hour ?? 0}/hr coins · $
              {room.rate_money_per_hour ?? 0}/hr
            </div>
            {room.amenities && room.amenities.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginTop: 6,
                }}
              >
                {room.amenities.map((a) => (
                  <span
                    key={a}
                    style={{
                      fontSize: 10,
                      background: "var(--color-gray-100)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      color: "var(--color-gray-700)",
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            background: "#fef3c7",
            borderRadius: 8,
            border: "1px solid #fcd34d",
          }}
        >
          <div style={{ fontSize: 12, color: "#92400e", fontWeight: 500 }}>
            Coin balance
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#78350f" }}>
            {Math.round(coinBalance).toLocaleString()}
          </div>
        </div>

        {hasPermission("create_booking") && tenants.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--color-gray-500)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              BOOKING FOR
            </label>
            <select
              value={selectedTenantId || ""}
              onChange={(e) => {
                const id = +e.target.value;
                setSelectedTenantId(id);
                const t = tenants.find((t) => t.id === id);
                if (t) setCoinBalance(t.coin_balance);
              }}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "7px 10px",
                border: "1px solid var(--color-gray-300)",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.company_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* RIGHT: Date nav + Timeline */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Date navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-gray-200)",
            background: "white",
          }}
        >
          <button
            onClick={() => changeDate(-navStep)}
            style={{
              border: "1px solid var(--color-gray-300)",
              borderRadius: 6,
              background: "white",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ‹
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              border: "1px solid var(--color-gray-300)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 14,
            }}
          />
          <button
            onClick={() => changeDate(navStep)}
            style={{
              border: "1px solid var(--color-gray-300)",
              borderRadius: 6,
              background: "white",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ›
          </button>
          <button
            onClick={() =>
              setSelectedDate(new Date().toISOString().slice(0, 10))
            }
            style={{
              border: "1px solid var(--color-gray-300)",
              borderRadius: 6,
              background: "white",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Today
          </button>

          {/* Day / Week toggle — matches existing button styling */}
          <div
            style={{
              display: "inline-flex",
              border: "1px solid var(--color-gray-300)",
              borderRadius: 6,
              overflow: "hidden",
              marginLeft: 4,
            }}
          >
            {(["day", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  border: "none",
                  background: view === v ? "#003DA5" : "white",
                  color: view === v ? "white" : "var(--color-gray-700)",
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: view === v ? 600 : 500,
                }}
              >
                {v === "day" ? "Day" : "Week"}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", fontWeight: 600, fontSize: 15 }}>
            {selectedRoom?.name || "Select a room"}
          </div>
        </div>

        {/* Timeline area — single column in day view, gutter + 7 columns in week view */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
          {selectedRoom ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Column headers (week view only) */}
              {view === "week" && (
                <div style={{ display: "flex", marginBottom: 4 }}>
                  <div style={{ width: 45, flexShrink: 0 }} />
                  {weekDates.map((iso, i) => {
                    const d = new Date(iso + "T00:00:00");
                    const isToday =
                      iso === new Date().toISOString().slice(0, 10);
                    return (
                      <div
                        key={iso}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: 600,
                          color: isToday
                            ? "#003DA5"
                            : "var(--color-gray-700)",
                          padding: "6px 0",
                          borderBottom: isToday
                            ? "2px solid #003DA5"
                            : "1px solid var(--color-gray-200)",
                        }}
                      >
                        {WEEKDAY_RU[i]}{" "}
                        {String(d.getDate()).padStart(2, "0")}.
                        {String(d.getMonth() + 1).padStart(2, "0")}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Timeline body: time gutter + N columns */}
              <div
                style={{
                  display: "flex",
                  position: "relative",
                  height: totalHours * HOUR_HEIGHT,
                  userSelect: "none",
                }}
              >
                {/* Time-label gutter (rendered once, outside the columns) */}
                <div
                  style={{
                    width: 45,
                    flexShrink: 0,
                    position: "relative",
                    pointerEvents: "none",
                  }}
                >
                  {Array.from({ length: totalHours + 1 }, (_, i) => (
                    <div
                      key={`tl${i}`}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: i * HOUR_HEIGHT - 6,
                        fontSize: 11,
                        color: "var(--color-gray-400)",
                      }}
                    >
                      {String(dayStart + i).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {/* Day column(s) */}
                {(view === "week" ? weekDates : [selectedDate]).map(
                  (colDate) => (
                    <div
                      key={colDate}
                      style={{
                        flex: 1,
                        position: "relative",
                        height: totalHours * HOUR_HEIGHT,
                        cursor: "crosshair",
                        borderLeft: "1px solid var(--color-gray-200)",
                      }}
                      onMouseDown={handleTimelineMouseDown(colDate)}
                      onMouseMove={handleTimelineMouseMove}
                      onMouseUp={handleTimelineMouseUp(colDate)}
                      onMouseLeave={() => {
                        if (isDragging) {
                          setIsDragging(false);
                          setDragStart(null);
                          setDragEnd(null);
                        }
                      }}
                    >
                      {/* Hour grid lines */}
                      {Array.from({ length: totalHours + 1 }, (_, i) => (
                        <div
                          key={`h${i}`}
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: i * HOUR_HEIGHT,
                            borderTop:
                              "1px solid var(--color-gray-200)",
                            pointerEvents: "none",
                          }}
                        />
                      ))}

                      {/* 30-min grid lines */}
                      {Array.from({ length: totalHours }, (_, i) => (
                        <div
                          key={`m${i}`}
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                            borderTop:
                              "1px dashed var(--color-gray-100)",
                            pointerEvents: "none",
                          }}
                        />
                      ))}

                      {/* Existing bookings for this column's date */}
                      {bookingsForDate(colDate).map((b) => {
                        const startT = b.start_time.slice(11, 16);
                        const endT = b.end_time.slice(11, 16);
                        const top = timeToY(startT);
                        const height = timeToY(endT) - top;
                        return (
                          <div
                            key={b.id}
                            style={{
                              position: "absolute",
                              left: 4,
                              right: 4,
                              top,
                              height: Math.max(height, 4),
                              background: "#003DA5",
                              borderRadius: 4,
                              color: "white",
                              fontSize: 12,
                              padding: "2px 6px",
                              overflow: "hidden",
                              cursor: "pointer",
                              zIndex: 2,
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => {
                              setEditBooking(b);
                              setModalFrom(startT);
                              setModalTo(endT);
                              setShowModal(true);
                            }}
                          >
                            {b.tenant_name || "—"} — {startT}–{endT}
                          </div>
                        );
                      })}

                      {/* Drag ghost — only on the column owning the drag */}
                      {isDragging &&
                        dragStart !== null &&
                        dragEnd !== null &&
                        colDate === selectedDate && (
                          <div
                            style={{
                              position: "absolute",
                              left: 4,
                              right: 4,
                              top: Math.min(dragStart, dragEnd),
                              height: Math.abs(dragEnd - dragStart),
                              background: "rgba(0,61,165,0.2)",
                              border: "2px solid #003DA5",
                              borderRadius: 4,
                              pointerEvents: "none",
                              zIndex: 3,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              color: "#003DA5",
                              fontWeight: 600,
                            }}
                          >
                            {yToTime(Math.min(dragStart, dragEnd))} –{" "}
                            {yToTime(Math.max(dragStart, dragEnd))}
                          </div>
                        )}
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--color-gray-500)",
                fontSize: 15,
              }}
            >
              Select a meeting room to view its calendar
            </div>
          )}
        </div>
      </div>

      {/* BOOKING MODAL */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
          }}
          onMouseDown={() => {
            setShowModal(false);
            setEditBooking(null);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 28,
              width: 420,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 600 }}>
              {editBooking ? "Edit Booking" : "New Booking"} —{" "}
              {selectedRoom?.name}
            </h3>

            {editBooking && (
              <div
                style={{
                  padding: "12px 14px",
                  background: "var(--color-gray-50)",
                  border: "1px solid var(--color-gray-200)",
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  color: "var(--color-gray-700)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div>
                  <strong>Арендатор:</strong>{" "}
                  {editBooking.tenant_name || "—"}
                </div>
                <div>
                  <strong>Комната:</strong> {selectedRoom?.name || "—"}
                </div>
                <div>
                  <strong>Время:</strong>{" "}
                  {editBooking.start_time.slice(11, 16)}–
                  {editBooking.end_time.slice(11, 16)}{" "}
                  <span style={{ color: "var(--color-gray-500)" }}>
                    ({editBooking.start_time.slice(0, 10)})
                  </span>
                </div>
                <div>
                  <strong>Стоимость:</strong>{" "}
                  {editBooking.coins_charged > 0 && (
                    <>{Math.round(editBooking.coins_charged).toLocaleString()} coins</>
                  )}
                  {editBooking.coins_charged > 0 &&
                    editBooking.money_charged_uzs > 0 &&
                    " + "}
                  {editBooking.money_charged_uzs > 0 && (
                    <>
                      {Math.round(editBooking.money_charged_uzs).toLocaleString()}{" "}
                      {getCurrencySymbol()}
                    </>
                  )}
                  {editBooking.coins_charged === 0 &&
                    editBooking.money_charged_uzs === 0 &&
                    "FREE"}
                </div>
                <div>
                  <strong>Способ оплаты:</strong> {editBooking.payment_type}
                </div>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)" }}>
                From
                <select
                  value={modalFrom}
                  onChange={(e) => {
                    setModalFrom(e.target.value);
                    const fromMin = timeToMin(e.target.value);
                    const toMin = timeToMin(modalTo);
                    if (toMin <= fromMin)
                      setModalTo(minToTime(Math.min(fromMin + 60, dayEnd * 60)));
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 10px",
                    border: "1px solid var(--color-gray-300)",
                    borderRadius: 6,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                >
                  {timeSlots
                    .filter((t) => timeToMin(t) < dayEnd * 60)
                    .map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)" }}>
                To
                <select
                  value={modalTo}
                  onChange={(e) => setModalTo(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 10px",
                    border: "1px solid var(--color-gray-300)",
                    borderRadius: 6,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                >
                  {timeSlots
                    .filter((t) => t > modalFrom)
                    .map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {preview.status !== "idle" && (
              <div
                style={{
                  padding: "10px 14px",
                  background: preview.status === "error" ? "#fef2f2" : "#f0f9ff",
                  borderRadius: 8,
                  fontSize: 13,
                  color: preview.status === "error" ? "#dc2626" : "#0369a1",
                  marginBottom: 16,
                  border: `1px solid ${preview.status === "error" ? "#fecaca" : "#bae6fd"}`,
                  opacity: preview.status === "loading" ? 0.6 : 1,
                  transition: "opacity 120ms ease",
                }}
              >
                {preview.status === "loading" && "Calculating cost…"}
                {preview.status === "error" && preview.message}
                {preview.status === "ok" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div>
                      {Math.round(preview.data.duration_hours * 60)} min
                      {" — "}
                      {preview.data.coins_used > 0 && (
                        <>
                          <strong>{Math.round(preview.data.coins_used)}</strong> coins
                          {preview.data.cash_charged > 0 && " + "}
                        </>
                      )}
                      {preview.data.cash_charged > 0 && (
                        <>
                          <strong>{Math.round(preview.data.cash_charged).toLocaleString()}</strong> {getCurrencySymbol()}
                        </>
                      )}
                      {preview.data.coins_used === 0 && preview.data.cash_charged === 0 && "FREE"}
                    </div>
                    {preview.data.discount_pct > 0 && (
                      <div
                        title={preview.data.discount_reason ?? ""}
                        style={{ color: "#16a34a", fontSize: 12 }}
                      >
                        Resident discount −{preview.data.discount_pct}%
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--color-gray-500)" }}>
                      Coin balance after: {Math.round(preview.data.coin_balance_after)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              <div>
                {editBooking && (
                  <button
                    onClick={async () => {
                      await handleCancel(editBooking.id);
                      setShowModal(false);
                      setEditBooking(null);
                    }}
                    style={{
                      padding: "8px 16px",
                      border: "1px solid #fca5a5",
                      borderRadius: 6,
                      background: "white",
                      color: "#dc2626",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditBooking(null);
                  }}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid var(--color-gray-300)",
                    borderRadius: 6,
                    background: "white",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Close
                </button>
                {!editBooking && (
                  <button
                    onClick={handleBook}
                    disabled={saving || !selectedRoom || preview.status === "error"}
                    style={{
                      padding: "8px 16px",
                      background: "#003DA5",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? "Booking..." : "Book Now"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
