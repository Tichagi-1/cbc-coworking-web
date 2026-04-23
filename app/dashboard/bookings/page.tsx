"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { getCurrencySymbol } from "@/lib/currency";
import type { Resource, Booking } from "@/lib/types";

const HOUR_HEIGHT = 60;
const DAY_START = 8;
const DAY_END = 20;
const TOTAL_HOURS = DAY_END - DAY_START;

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

const yToTime = (y: number): string => {
  const totalMinutes = round5(Math.floor((y / HOUR_HEIGHT) * 60));
  const hour = DAY_START + Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  return `${String(Math.min(hour, DAY_END)).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};

const timeToY = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return (h - DAY_START + m / 60) * HOUR_HEIGHT;
};

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

  // Filter bookings for selected date
  const dayBookings = bookings.filter((b) =>
    b.start_time.startsWith(selectedDate)
  );

  const loadRooms = async () => {
    try {
      const res = await api.get<Resource[]>("/resources", {
        params: { type: "meeting_room" },
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
      const res = await api.get<Booking[]>("/bookings", {
        params: { resource_id: selectedRoom.id },
      });
      setBookings(res.data);
    } catch {
      /* noop */
    }
  }, [selectedRoom]);

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

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  // Timeline mouse handlers
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDragStart(y);
    setDragEnd(y);
    setIsDragging(true);
  };
  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDragEnd(e.clientY - rect.top);
  };
  const handleTimelineMouseUp = () => {
    if (!isDragging || dragStart === null || dragEnd === null) return;
    setIsDragging(false);
    const minY = Math.min(dragStart, dragEnd);
    const maxY = Math.max(dragStart, dragEnd);
    if (maxY - minY < 5) return;
    const fromTime = yToTime(minY);
    const toTime = yToTime(maxY);
    setModalFrom(fromTime);
    setModalTo(toTime);
    setEditBooking(null);
    setShowModal(true);
    setDragStart(null);
    setDragEnd(null);
  };

  const timeSlots = Array.from({ length: (20 - 8) * 12 + 1 }, (_, i) => {
    const totalMin = 8 * 60 + i * 5;
    return minToTime(totalMin);
  });

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
            onClick={() => changeDate(-1)}
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
            onClick={() => changeDate(1)}
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
          <div style={{ marginLeft: "auto", fontWeight: 600, fontSize: 15 }}>
            {selectedRoom?.name || "Select a room"}
          </div>
        </div>

        {/* Day timeline */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
          {selectedRoom ? (
            <div
              style={{
                position: "relative",
                height: TOTAL_HOURS * HOUR_HEIGHT,
                cursor: "crosshair",
                userSelect: "none",
              }}
              onMouseDown={handleTimelineMouseDown}
              onMouseMove={handleTimelineMouseMove}
              onMouseUp={handleTimelineMouseUp}
              onMouseLeave={() => {
                if (isDragging) {
                  setIsDragging(false);
                  setDragStart(null);
                  setDragEnd(null);
                }
              }}
            >
              {/* Hour grid lines */}
              {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                <div
                  key={`h${i}`}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: i * HOUR_HEIGHT,
                    borderTop: "1px solid var(--color-gray-200)",
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--color-gray-400)",
                      width: 45,
                      textAlign: "right",
                      paddingRight: 8,
                    }}
                  >
                    {String(DAY_START + i).padStart(2, "0")}:00
                  </span>
                </div>
              ))}

              {/* 30-min grid lines */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={`m${i}`}
                  style={{
                    position: "absolute",
                    left: 45,
                    right: 0,
                    top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                    borderTop: "1px dashed var(--color-gray-100)",
                    pointerEvents: "none",
                  }}
                />
              ))}

              {/* Existing bookings */}
              {dayBookings.map((b) => {
                const startT = b.start_time.slice(11, 16);
                const endT = b.end_time.slice(11, 16);
                const top = timeToY(startT);
                const height = timeToY(endT) - top;
                return (
                  <div
                    key={b.id}
                    style={{
                      position: "absolute",
                      left: 50,
                      right: 8,
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
                    {startT} – {endT}
                    {b.coins_charged > 0 && ` · ${b.coins_charged} coins`}
                  </div>
                );
              })}

              {/* Drag ghost */}
              {isDragging && dragStart !== null && dragEnd !== null && (
                <div
                  style={{
                    position: "absolute",
                    left: 50,
                    right: 8,
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
                      setModalTo(minToTime(Math.min(fromMin + 60, 20 * 60)));
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
                    .filter((t) => t < "20:00")
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
