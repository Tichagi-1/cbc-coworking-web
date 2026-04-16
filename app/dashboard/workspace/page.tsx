"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { getCurrencySymbol } from "@/lib/currency";

const localizer = momentLocalizer(moment);
const today = new Date().toISOString().slice(0, 10);

const minToTime = (min: number) => {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};
const timeToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

interface RoomData {
  id: number;
  name: string;
  capacity: number;
  rate_coins_per_hour: number;
  rate_money_per_hour: number;
  amenities: string[];
}

interface RoomBooking {
  id: number;
  resource_id: number;
  tenant_id: number;
  start_time: string;
  end_time: string;
  tenant_name: string | null;
}

interface CalEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resourceId: number;
}

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<"rooms" | "floors">("rooms");
  const [selectedDate, setSelectedDate] = useState(today);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalRoom, setModalRoom] = useState<RoomData | null>(null);
  const [modalFrom, setModalFrom] = useState("09:00");
  const [modalTo, setModalTo] = useState("10:00");
  const [modalDate, setModalDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [costPreview, setCostPreview] = useState("");

  // Detail
  const [detailBooking, setDetailBooking] = useState<RoomBooking | null>(null);
  const [bookingAccesses, setBookingAccesses] = useState<{ id: number; member_name: string }[]>([]);
  const [accessesLoading, setAccessesLoading] = useState(false);

  // Tenant/coin
  const [tenants, setTenants] = useState<
    { id: number; company_name: string; coin_balance: number }[]
  >([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [role, setRole] = useState("");

  // ── Fetch accesses when detail booking opens ──────────────────────────
  useEffect(() => {
    if (!detailBooking) { setBookingAccesses([]); return; }
    setAccessesLoading(true);
    api.get<{ id: number; member_name: string }[]>(`/bookings/${detailBooking.id}/accesses`)
      .then((r) => setBookingAccesses(r.data))
      .catch(() => setBookingAccesses([]))
      .finally(() => setAccessesLoading(false));
  }, [detailBooking]);

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setRole(document.cookie.match(/cbc_role=([^;]+)/)?.[1] || "");
    api
      .get<{ id: number; company_name: string; coin_balance: number }[]>("/tenants/")
      .then((r) => {
        setTenants(r.data);
        if (r.data.length > 0) {
          setSelectedTenantId(r.data[0].id);
          setCoinBalance(r.data[0].coin_balance);
        }
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    try {
      const r = await api.get<{ rooms: RoomData[]; bookings: RoomBooking[] }>(
        "/workspace/rooms",
        { params: { building_id: 1, date: selectedDate } }
      );
      setRooms(r.data.rooms);
      setBookings(r.data.bookings);
    } catch {}
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Calendar events ────────────────────────────────────────────────────
  const calEvents: CalEvent[] = useMemo(
    () =>
      bookings.map((b) => ({
        id: b.id,
        title: b.tenant_name || "Booking",
        start: new Date(b.start_time),
        end: new Date(b.end_time),
        resourceId: b.resource_id,
      })),
    [bookings]
  );

  const calResources = useMemo(
    () => rooms.map((r) => ({ id: r.id, title: r.name })),
    [rooms]
  );

  // ── Cost preview ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!modalRoom) { setCostPreview(""); return; }
    const fromMin = timeToMin(modalFrom);
    const toMin = timeToMin(modalTo);
    if (toMin <= fromMin) { setCostPreview("End must be after start"); return; }
    const durH = (toMin - fromMin) / 60;
    const coinsNeeded = Math.round(durH * modalRoom.rate_coins_per_hour);
    if (coinsNeeded <= coinBalance) {
      setCostPreview(`${Math.round(toMin - fromMin)} min: ${coinsNeeded} coins — FREE`);
    } else {
      const remaining = coinsNeeded - coinBalance;
      const ratio = modalRoom.rate_coins_per_hour > 0 ? modalRoom.rate_money_per_hour / modalRoom.rate_coins_per_hour : 0;
      const uzs = Math.round(remaining * ratio * 12800);
      setCostPreview(`${Math.round(toMin - fromMin)} min: ${Math.round(coinBalance)} coins + ${uzs.toLocaleString()} ${getCurrencySymbol()}`);
    }
  }, [modalFrom, modalTo, modalRoom, coinBalance]);

  const handleBook = async () => {
    if (!modalRoom || !selectedTenantId) return;
    setSaving(true);
    try {
      await api.post("/bookings", {
        resource_id: modalRoom.id,
        tenant_id: selectedTenantId,
        start_time: `${modalDate}T${modalFrom}:00`,
        end_time: `${modalDate}T${modalTo}:00`,
      });
      setShowModal(false);
      await loadData();
      const t = await api.get<{ id: number; company_name: string; coin_balance: number }[]>("/tenants/");
      setTenants(t.data);
      const updated = t.data.find((x) => x.id === selectedTenantId);
      if (updated) setCoinBalance(updated.coin_balance);
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Booking failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Cancel this booking?")) return;
    try {
      await api.delete(`/bookings/${id}`);
      setDetailBooking(null);
      await loadData();
      const t = await api.get<{ id: number; company_name: string; coin_balance: number }[]>("/tenants/");
      setTenants(t.data);
      const updated = t.data.find((x) => x.id === selectedTenantId);
      if (updated) setCoinBalance(updated.coin_balance);
    } catch (e: unknown) {
      alert((e as Error)?.message || "Cancel failed");
    }
  };

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const timeSlots = useMemo(
    () => Array.from({ length: (22 - 7) * 12 + 1 }, (_, i) => minToTime(7 * 60 + i * 5)),
    []
  );

  // Day bookings table (sorted by start time)
  const dayBookings = useMemo(
    () => [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [bookings]
  );

  const navBtn: React.CSSProperties = {
    border: "1px solid #d1d5db", borderRadius: 6, background: "white",
    padding: "4px 10px", cursor: "pointer", fontSize: 16,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
      {/* Top bar */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", flexShrink: 0 }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#f3f4f6", padding: 3, borderRadius: 8 }}>
          {(["rooms", "floors"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: "6px 16px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer",
                background: activeTab === tab ? "white" : "transparent",
                color: activeTab === tab ? "#111827" : "#6b7280",
                boxShadow: activeTab === tab ? "0 1px 2px rgba(0,0,0,0.1)" : "none" }}>
              {tab === "rooms" ? "Rooms" : "Floors"}
            </button>
          ))}
        </div>

        {/* Date nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => changeDate(-1)} style={navBtn}>‹</button>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 13 }} />
          <button onClick={() => changeDate(1)} style={navBtn}>›</button>
          <button onClick={() => setSelectedDate(today)} style={{ ...navBtn, background: "#003DA5", color: "white" }}>Today</button>
        </div>

        {/* Coins + tenant + new booking */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "#fef3c7", padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
            {Math.round(coinBalance).toLocaleString()} coins
          </div>
          {hasPermission("create_booking") && tenants.length > 0 && (
            <select value={selectedTenantId || ""} onChange={(e) => {
              const id = +e.target.value;
              setSelectedTenantId(id);
              const t = tenants.find((x) => x.id === id);
              if (t) setCoinBalance(t.coin_balance);
            }} style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 13 }}>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.company_name}</option>)}
            </select>
          )}
          <button onClick={() => {
            if (rooms.length > 0) setModalRoom(rooms[0]);
            setModalDate(selectedDate); setModalFrom("09:00"); setModalTo("10:00");
            setShowModal(true);
          }} style={{ padding: "6px 14px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
            + New Booking
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "rooms" && (
          <>
            {/* Calendar */}
            <div style={{ flex: 1, minHeight: 400, overflowY: "auto", padding: "0 8px" }}>
              <Calendar
                localizer={localizer}
                events={calEvents}
                resources={calResources}
                resourceIdAccessor="id"
                resourceTitleAccessor="title"
                defaultView={Views.DAY}
                views={[Views.DAY]}
                step={30}
                timeslots={2}
                min={new Date(0, 0, 0, 7, 0)}
                max={new Date(0, 0, 0, 22, 0)}
                date={new Date(selectedDate)}
                onNavigate={(date) => setSelectedDate(date.toISOString().slice(0, 10))}
                selectable
                onSelectSlot={({ start, end, resourceId }) => {
                  const room = rooms.find((r) => r.id === (resourceId as number));
                  setModalRoom(room || rooms[0] || null);
                  setModalFrom(moment(start).format("HH:mm"));
                  setModalTo(moment(end).format("HH:mm"));
                  setModalDate(moment(start).format("YYYY-MM-DD"));
                  setShowModal(true);
                }}
                onSelectEvent={(event) => {
                  const b = bookings.find((x) => x.id === (event as CalEvent).id);
                  if (b) setDetailBooking(b);
                }}
                eventPropGetter={() => ({
                  style: { background: "#003DA5", border: "none", borderRadius: 4 },
                })}
                style={{ height: 900 }}
              />
            </div>

            {/* Day bookings table */}
            <div style={{ borderTop: "1px solid #e5e7eb", padding: "12px 20px", maxHeight: 200, overflowY: "auto", background: "white", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                Bookings — {moment(selectedDate).format("ddd, MMM D")}
              </div>
              {dayBookings.length === 0 ? (
                <div style={{ fontSize: 13, color: "#9ca3af" }}>No bookings for this date.</div>
              ) : (
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#6b7280", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ padding: "4px 8px", fontWeight: 500 }}>Time</th>
                      <th style={{ padding: "4px 8px", fontWeight: 500 }}>Room</th>
                      <th style={{ padding: "4px 8px", fontWeight: 500 }}>Tenant</th>
                      <th style={{ padding: "4px 8px", fontWeight: 500, textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBookings.map((b) => {
                      const room = rooms.find((r) => r.id === b.resource_id);
                      return (
                        <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "6px 8px" }}>
                            {b.start_time.slice(11, 16)} – {b.end_time.slice(11, 16)}
                          </td>
                          <td style={{ padding: "6px 8px" }}>{room?.name || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{b.tenant_name || "—"}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>
                            <button onClick={() => handleCancel(b.id)}
                              style={{ fontSize: 12, padding: "2px 8px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", cursor: "pointer", color: "#dc2626" }}>
                              Cancel
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === "floors" && (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
            <a href="/dashboard/map" style={{ color: "#003DA5", fontSize: 16, fontWeight: 500, textDecoration: "none" }}>
              Open Floor Map →
            </a>
          </div>
        )}
      </div>

      {/* Booking modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
          onMouseDown={() => setShowModal(false)}>
          <div style={{ background: "white", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onMouseDown={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 600 }}>New Booking</h3>

            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 }}>
              Room
              <select value={modalRoom?.id || ""} onChange={(e) => setModalRoom(rooms.find((r) => r.id === +e.target.value) || null)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity} seats)</option>)}
              </select>
            </label>

            {hasPermission("create_booking") && tenants.length > 0 && (
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 }}>
                Tenant
                <select value={selectedTenantId || ""} onChange={(e) => {
                  const id = +e.target.value;
                  setSelectedTenantId(id);
                  const t = tenants.find((x) => x.id === id);
                  if (t) setCoinBalance(t.coin_balance);
                }} style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.company_name}</option>)}
                </select>
              </label>
            )}

            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 }}>
              Date
              <input type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                From
                <select value={modalFrom} onChange={(e) => {
                  setModalFrom(e.target.value);
                  if (timeToMin(modalTo) <= timeToMin(e.target.value))
                    setModalTo(minToTime(Math.min(timeToMin(e.target.value) + 60, 22 * 60)));
                }} style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}>
                  {timeSlots.filter((t) => t < "22:00").map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                To
                <select value={modalTo} onChange={(e) => setModalTo(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}>
                  {timeSlots.filter((t) => t > modalFrom).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>

            {costPreview && (
              <div style={{ padding: "10px 14px", background: "#f0f9ff", borderRadius: 8, fontSize: 13, color: "#0369a1", marginBottom: 16, border: "1px solid #bae6fd" }}>
                {costPreview}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={handleBook} disabled={saving || !modalRoom || !selectedTenantId}
                style={{ padding: "8px 16px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Booking..." : "Book Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking detail */}
      {detailBooking && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}
          onMouseDown={() => setDetailBooking(null)}>
          <div style={{ background: "white", borderRadius: 12, padding: 24, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onMouseDown={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>Booking Detail</h3>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>
              <div><strong>Room:</strong> {rooms.find((r) => r.id === detailBooking.resource_id)?.name || "—"}</div>
              <div><strong>Tenant:</strong> {detailBooking.tenant_name || "—"}</div>
              <div><strong>Time:</strong> {detailBooking.start_time.slice(11, 16)} – {detailBooking.end_time.slice(11, 16)}</div>
              <div><strong>Date:</strong> {detailBooking.start_time.slice(0, 10)}</div>
            </div>
            {/* Salto access indicator */}
            <div style={{ marginTop: 12 }}>
              {accessesLoading ? (
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Loading access info...</div>
              ) : bookingAccesses.length > 0 ? (
                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 6, padding: "8px 12px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#065f46", marginBottom: 4 }}>Salto Access Granted</div>
                  {bookingAccesses.map((a) => (
                    <div key={a.id} style={{ fontSize: 12, color: "#047857" }}>{a.member_name}</div>
                  ))}
                </div>
              ) : (
                <div style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>
                  No Salto access configured
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => handleCancel(detailBooking.id)}
                style={{ padding: "6px 14px", border: "1px solid #fca5a5", borderRadius: 6, background: "white", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>
                Cancel Booking
              </button>
              <button onClick={() => setDetailBooking(null)}
                style={{ padding: "6px 14px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 13 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
