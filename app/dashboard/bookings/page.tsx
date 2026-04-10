"use client";

import { useState, useEffect, useCallback } from "react";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createViewDay, createViewWeek } from "@schedule-x/calendar";
import { createDragAndDropPlugin } from "@schedule-x/drag-and-drop";
import { createResizePlugin } from "@schedule-x/resize";
import "@schedule-x/theme-default/dist/index.css";
import { api } from "@/lib/api";
import type { Resource, Booking } from "@/lib/types";

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

export default function BookingsPage() {
  const [rooms, setRooms] = useState<Resource[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Resource | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tenants, setTenants] = useState<
    { id: number; company_name: string; coin_balance: number }[]
  >([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalFrom, setModalFrom] = useState("09:00");
  const [modalTo, setModalTo] = useState("10:00");
  const [modalDate, setModalDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [costPreview, setCostPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("");

  const formatForCalendar = (isoStr: string) =>
    isoStr.replace("T", " ").slice(0, 16);

  const calendarEvents = bookings.map((b) => ({
    id: String(b.id),
    title: selectedRoom?.name || "Booking",
    start: formatForCalendar(b.start_time),
    end: formatForCalendar(b.end_time),
    calendarId: "main",
  }));

  const calendar = useCalendarApp({
    views: [createViewDay(), createViewWeek()],
    events: calendarEvents,
    calendars: {
      main: {
        colorName: "main",
        lightColors: {
          main: "#003DA5",
          container: "#dbeafe",
          onContainer: "#1e3a8a",
        },
      },
    },
    plugins: [createDragAndDropPlugin(5), createResizePlugin(5)],
    dayBoundaries: { start: "08:00", end: "20:00" },
    weekOptions: { gridHeight: 550, nDays: 1 },
    callbacks: {
      onEventUpdate(updatedEvent) {
        const bookingId = parseInt(String(updatedEvent.id));
        const newStart =
          String(updatedEvent.start).replace(" ", "T") + ":00";
        const newEnd =
          String(updatedEvent.end).replace(" ", "T") + ":00";
        api
          .patch(`/bookings/${bookingId}`, {
            start_time: newStart,
            end_time: newEnd,
          })
          .then(() => loadBookings())
          .catch((e) =>
            console.error(
              "Failed to update booking",
              (e as Error)?.message
            )
          );
      },
      onSelectedDateUpdate(date: string) {
        setModalDate(date);
      },
    },
  });

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
    setRole(
      document.cookie.match(/cbc_role=([^;]+)/)?.[1] || ""
    );
    loadRooms();
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Sync calendar events when bookings change
  useEffect(() => {
    if (calendar) {
      calendar.events.set(calendarEvents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  // Cost preview
  useEffect(() => {
    if (!selectedRoom) return;
    const fromMin = timeToMin(modalFrom);
    const toMin = timeToMin(modalTo);
    if (toMin <= fromMin) {
      setCostPreview("End must be after start");
      return;
    }
    const durMin = toMin - fromMin;
    if (durMin < 5) {
      setCostPreview("Minimum 5 minutes");
      return;
    }
    const durH = durMin / 60;
    const coinsRate = selectedRoom.rate_coins_per_hour ?? 0;
    const moneyRate = selectedRoom.rate_money_per_hour ?? 0;
    const coinsNeeded = Math.round(durH * coinsRate);
    if (coinsRate === 0 && moneyRate === 0) {
      setCostPreview(`${Math.round(durMin)} min — FREE`);
      return;
    }
    if (coinsNeeded <= coinBalance) {
      setCostPreview(
        `${Math.round(durMin)} min: ${coinsNeeded} coins (have ${Math.round(coinBalance)}) — FREE`
      );
    } else {
      const remaining = coinsNeeded - coinBalance;
      const ratio = coinsRate > 0 ? moneyRate / coinsRate : 0;
      const moneyUzs = Math.round(remaining * ratio * 12800);
      setCostPreview(
        `${Math.round(durMin)} min: ${Math.round(coinBalance)} coins + ${moneyUzs.toLocaleString()} сум`
      );
    }
  }, [modalFrom, modalTo, selectedRoom, coinBalance]);

  const handleBook = async () => {
    if (!selectedRoom || !selectedTenantId) return;
    setSaving(true);
    try {
      await api.post("/bookings", {
        resource_id: selectedRoom.id,
        tenant_id: selectedTenantId,
        start_time: `${modalDate}T${modalFrom}:00`,
        end_time: `${modalDate}T${modalTo}:00`,
      });
      setShowModal(false);
      await loadBookings();
      await loadTenants();
      const t = tenants.find((t) => t.id === selectedTenantId);
      if (t) setCoinBalance(t.coin_balance);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response
          ?.data?.detail || "Booking failed";
      alert(detail);
    } finally {
      setSaving(false);
    }
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
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          padding: 16,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#6b7280",
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
                  : "1px solid #e5e7eb",
              background:
                selectedRoom?.id === room.id ? "#eff6ff" : "white",
            }}
          >
            <div
              style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}
            >
              {room.name}
            </div>
            <div
              style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}
            >
              {room.capacity ?? 0} seats
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
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
                      background: "#f3f4f6",
                      padding: "2px 6px",
                      borderRadius: 4,
                      color: "#374151",
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Coin balance */}
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            background: "#fef3c7",
            borderRadius: 8,
            border: "1px solid #fcd34d",
          }}
        >
          <div
            style={{ fontSize: 12, color: "#92400e", fontWeight: 500 }}
          >
            Coin balance
          </div>
          <div
            style={{ fontSize: 18, fontWeight: 700, color: "#78350f" }}
          >
            {Math.round(coinBalance).toLocaleString()}
          </div>
        </div>

        {/* Tenant selector (admin only) */}
        {(role === "admin" || role === "manager") &&
          tenants.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "#6b7280",
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
                  border: "1px solid #d1d5db",
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

      {/* RIGHT: Calendar */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "white",
          }}
        >
          <div
            style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}
          >
            {selectedRoom ? selectedRoom.name : "Select a room"}
          </div>
          <button
            onClick={() => {
              const now = new Date();
              const startMin = round5(
                now.getHours() * 60 + now.getMinutes()
              );
              setModalFrom(minToTime(Math.min(startMin, 19 * 60)));
              setModalTo(
                minToTime(Math.min(startMin + 60, 20 * 60))
              );
              setModalDate(now.toISOString().slice(0, 10));
              setShowModal(true);
            }}
            disabled={!selectedRoom}
            style={{
              padding: "8px 16px",
              background: "#003DA5",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              cursor: "pointer",
              opacity: selectedRoom ? 1 : 0.5,
            }}
          >
            + New Booking
          </button>
        </div>

        {/* Schedule-X Calendar */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {selectedRoom ? (
            <ScheduleXCalendar calendarApp={calendar} />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#6b7280",
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
          onMouseDown={() => setShowModal(false)}
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
            <h3
              style={{
                margin: "0 0 20px",
                fontSize: 17,
                fontWeight: 600,
              }}
            >
              New Booking — {selectedRoom?.name}
            </h3>

            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#374151",
                display: "block",
                marginBottom: 12,
              }}
            >
              Date
              <input
                type="date"
                value={modalDate}
                onChange={(e) => setModalDate(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: "8px 10px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                From
                <select
                  value={modalFrom}
                  onChange={(e) => {
                    setModalFrom(e.target.value);
                    const fromMin = timeToMin(e.target.value);
                    const toMin = timeToMin(modalTo);
                    if (toMin <= fromMin)
                      setModalTo(
                        minToTime(Math.min(fromMin + 60, 20 * 60))
                      );
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 10px",
                    border: "1px solid #d1d5db",
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
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                To
                <select
                  value={modalTo}
                  onChange={(e) => setModalTo(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 10px",
                    border: "1px solid #d1d5db",
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

            {costPreview && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#f0f9ff",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#0369a1",
                  marginBottom: 16,
                  border: "1px solid #bae6fd",
                }}
              >
                {costPreview}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  background: "white",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={saving || !selectedRoom}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
