"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { api } from "@/lib/api";
import type { Resource } from "@/lib/types";

const localizer = momentLocalizer(moment);
const today = new Date().toISOString().slice(0, 10);
const COL_WIDTH = 40;

const minToTime = (min: number) => {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};
const timeToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

interface TimelineEvent {
  id: string;
  resource_id: number;
  resource_name: string;
  resource_type: string;
  title: string;
  start: string;
  end: string;
  event_type: "occupancy" | "booking";
  color: string;
}

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

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resourceId: number;
}

const navBtn: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "white",
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 16,
};

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<"rooms" | "timeline" | "floors">(
    "rooms"
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [resources, setResources] = useState<Resource[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [roomBookings, setRoomBookings] = useState<RoomBooking[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState("All");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalRoom, setModalRoom] = useState<RoomData | null>(null);
  const [modalFrom, setModalFrom] = useState("09:00");
  const [modalTo, setModalTo] = useState("10:00");
  const [modalDate, setModalDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [costPreview, setCostPreview] = useState("");

  // Detail panel
  const [showDetail, setShowDetail] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | CalendarEvent | null>(null);

  // Tenant/coin
  const [tenants, setTenants] = useState<
    { id: number; company_name: string; coin_balance: number }[]
  >([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [role, setRole] = useState("");

  // ── Loaders ───────────────────────────────────────────────────────────
  useEffect(() => {
    setRole(document.cookie.match(/cbc_role=([^;]+)/)?.[1] || "");
    api
      .get<Resource[]>("/resources", { params: { building_id: 1 } })
      .then((r) => setResources(r.data))
      .catch(() => {});
    api
      .get<{ id: number; company_name: string; coin_balance: number }[]>(
        "/tenants/"
      )
      .then((r) => {
        setTenants(r.data);
        if (r.data.length > 0) {
          setSelectedTenantId(r.data[0].id);
          setCoinBalance(r.data[0].coin_balance);
        }
      })
      .catch(() => {});
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const r = await api.get<{ rooms: RoomData[]; bookings: RoomBooking[] }>(
        "/workspace/rooms",
        { params: { building_id: 1, date: selectedDate } }
      );
      setRooms(r.data.rooms);
      setRoomBookings(r.data.bookings);
    } catch {}
  }, [selectedDate]);

  const loadTimeline = useCallback(async () => {
    const start = moment(selectedDate).startOf("week").format("YYYY-MM-DD");
    const end = moment(selectedDate).endOf("week").add(7, "days").format("YYYY-MM-DD");
    try {
      const r = await api.get<TimelineEvent[]>("/workspace/timeline", {
        params: { building_id: 1, start, end },
      });
      setTimelineEvents(r.data);
    } catch {}
  }, [selectedDate]);

  useEffect(() => {
    if (activeTab === "rooms") loadRooms();
    if (activeTab === "timeline") loadTimeline();
  }, [activeTab, loadRooms, loadTimeline]);

  // ── Cost preview ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!modalRoom) {
      setCostPreview("");
      return;
    }
    const fromMin = timeToMin(modalFrom);
    const toMin = timeToMin(modalTo);
    if (toMin <= fromMin) {
      setCostPreview("End must be after start");
      return;
    }
    const durH = (toMin - fromMin) / 60;
    const coinsRate = modalRoom.rate_coins_per_hour;
    const coinsNeeded = Math.round(durH * coinsRate);
    if (coinsNeeded <= coinBalance) {
      setCostPreview(`${Math.round(toMin - fromMin)} min: ${coinsNeeded} coins — FREE`);
    } else {
      const remaining = coinsNeeded - coinBalance;
      const ratio =
        coinsRate > 0 ? modalRoom.rate_money_per_hour / coinsRate : 0;
      const uzs = Math.round(remaining * ratio * 12800);
      setCostPreview(
        `${Math.round(toMin - fromMin)} min: ${Math.round(coinBalance)} coins + ${uzs.toLocaleString()} сум`
      );
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
      await loadRooms();
      await loadTimeline();
      const t = await api.get<{ id: number; company_name: string; coin_balance: number }[]>("/tenants/");
      setTenants(t.data);
      const updated = t.data.find((x) => x.id === selectedTenantId);
      if (updated) setCoinBalance(updated.coin_balance);
    } catch (e: unknown) {
      alert(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Booking failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTenantChange = (id: number) => {
    setSelectedTenantId(id);
    const t = tenants.find((x) => x.id === id);
    if (t) setCoinBalance(t.coin_balance);
  };

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const timeSlots = Array.from({ length: (20 - 8) * 12 + 1 }, (_, i) =>
    minToTime(8 * 60 + i * 5)
  );

  // ── Calendar events for react-big-calendar ─────────────────────────────
  const calendarEvents: CalendarEvent[] = useMemo(
    () =>
      roomBookings.map((b) => ({
        id: b.id,
        title: b.tenant_name || "Booking",
        start: new Date(b.start_time),
        end: new Date(b.end_time),
        resourceId: b.resource_id,
      })),
    [roomBookings]
  );

  const calendarResources = useMemo(
    () => rooms.map((r) => ({ id: r.id, title: r.name })),
    [rooms]
  );

  // ── Timeline helpers ───────────────────────────────────────────────────
  const days = useMemo(() => {
    const start = moment(selectedDate).startOf("week");
    return Array.from({ length: 14 }, (_, i) =>
      start.clone().add(i, "days").toDate()
    );
  }, [selectedDate]);

  const filteredResources = useMemo(() => {
    if (filter === "All") return resources;
    const typeMap: Record<string, string> = {
      Office: "office",
      "Meeting Room": "meeting_room",
      "Hot Desk": "hot_desk",
      "Open Space": "open_space",
    };
    return resources.filter(
      (r) => r.resource_type === (typeMap[filter] || filter)
    );
  }, [resources, filter]);

  const isToday = (d: Date) => d.toISOString().slice(0, 10) === today;

  const dayOffset = (isoStr: string) => {
    const d = new Date(isoStr);
    const diff = Math.floor(
      (d.getTime() - days[0].getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, diff);
  };

  const dayDiff = (startIso: string, endIso: string) => {
    const s = new Date(startIso);
    const e = new Date(endIso);
    return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const resourceEvents = (rid: number) =>
    timelineEvents.filter((e) => e.resource_id === rid);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
      {/* Top bar */}
      <div
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "white",
          flexShrink: 0,
        }}
      >
        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "#f3f4f6",
            padding: 3,
            borderRadius: 8,
          }}
        >
          {(["rooms", "timeline", "floors"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "none",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                textTransform: "capitalize",
                background: activeTab === tab ? "white" : "transparent",
                color: activeTab === tab ? "#111827" : "#6b7280",
                boxShadow:
                  activeTab === tab ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {tab === "rooms"
                ? "Rooms"
                : tab === "timeline"
                ? "Timeline"
                : "Floors"}
            </button>
          ))}
        </div>

        {/* Date nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => changeDate(-1)} style={navBtn}>
            ‹
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 13,
            }}
          />
          <button onClick={() => changeDate(1)} style={navBtn}>
            ›
          </button>
          <button
            onClick={() => setSelectedDate(today)}
            style={{ ...navBtn, background: "#003DA5", color: "white" }}
          >
            Today
          </button>
        </div>

        {/* Coins + tenant + new booking */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              background: "#fef3c7",
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {Math.round(coinBalance).toLocaleString()} coins
          </div>
          {(role === "admin" || role === "manager") && tenants.length > 0 && (
            <select
              value={selectedTenantId || ""}
              onChange={(e) => handleTenantChange(+e.target.value)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 13,
              }}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.company_name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              if (rooms.length > 0) setModalRoom(rooms[0]);
              setModalDate(selectedDate);
              setModalFrom("09:00");
              setModalTo("10:00");
              setShowModal(true);
            }}
            style={{
              padding: "6px 14px",
              background: "#003DA5",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + New Booking
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeTab === "rooms" && (
          <div style={{ height: "100%", padding: "0 8px" }}>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              resources={calendarResources}
              resourceIdAccessor="id"
              resourceTitleAccessor="title"
              defaultView={Views.DAY}
              views={[Views.DAY, Views.WEEK]}
              step={5}
              timeslots={12}
              min={new Date(0, 0, 0, 8, 0)}
              max={new Date(0, 0, 0, 20, 0)}
              date={new Date(selectedDate)}
              onNavigate={(date) =>
                setSelectedDate(date.toISOString().slice(0, 10))
              }
              selectable
              onSelectSlot={({ start, end, resourceId }) => {
                const room = rooms.find(
                  (r) => r.id === (resourceId as number)
                );
                setModalRoom(room || rooms[0] || null);
                setModalFrom(moment(start).format("HH:mm"));
                setModalTo(moment(end).format("HH:mm"));
                setModalDate(moment(start).format("YYYY-MM-DD"));
                setShowModal(true);
              }}
              onSelectEvent={(event) => {
                const booking = roomBookings.find(
                  (b) => b.id === (event as CalendarEvent).id
                );
                if (booking) {
                  setSelectedEvent(event as CalendarEvent);
                  setShowDetail(true);
                }
              }}
              eventPropGetter={() => ({
                style: {
                  background: "#003DA5",
                  border: "none",
                  borderRadius: 4,
                },
              })}
              style={{ height: "calc(100vh - 120px)" }}
            />
          </div>
        )}

        {activeTab === "timeline" && (
          <div style={{ display: "flex", overflow: "auto", height: "100%" }}>
            {/* Left: resource list */}
            <div
              style={{
                width: 200,
                flexShrink: 0,
                borderRight: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 2,
                }}
              >
                {["All", "Office", "Meeting Room", "Hot Desk", "Open Space"].map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        margin: "2px",
                        background: filter === f ? "#003DA5" : "#f3f4f6",
                        color: filter === f ? "white" : "#374151",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {f}
                    </button>
                  )
                )}
              </div>
              {filteredResources.map((r) => (
                <div
                  key={r.id}
                  style={{
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {r.seats ?? 0} seats
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Gantt grid */}
            <div
              style={{
                flex: 1,
                overflowX: "auto",
                position: "relative",
              }}
            >
              {/* Date header */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid #e5e7eb",
                  position: "sticky",
                  top: 0,
                  background: "white",
                  zIndex: 10,
                }}
              >
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    style={{
                      width: COL_WIDTH,
                      flexShrink: 0,
                      textAlign: "center",
                      padding: "6px 0",
                      fontSize: 11,
                      color: "#6b7280",
                      borderRight: "1px solid #f3f4f6",
                      background: isToday(day) ? "#eff6ff" : "white",
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>
                      {moment(day).format("D")}
                    </div>
                    <div>{moment(day).format("dd")}</div>
                  </div>
                ))}
              </div>

              {/* Resource rows */}
              {filteredResources.map((r) => (
                <div
                  key={r.id}
                  style={{
                    height: 48,
                    position: "relative",
                    borderBottom: "1px solid #f3f4f6",
                    display: "flex",
                  }}
                >
                  {/* Day cells */}
                  {days.map((day) => (
                    <div
                      key={day.toISOString()}
                      style={{
                        width: COL_WIDTH,
                        flexShrink: 0,
                        borderRight: "1px solid #f3f4f6",
                        background: isToday(day)
                          ? "#f8faff"
                          : "transparent",
                      }}
                    />
                  ))}

                  {/* Events overlay */}
                  {resourceEvents(r.id).map((ev) => {
                    const left = dayOffset(ev.start) * COL_WIDTH;
                    const width = Math.max(
                      dayDiff(ev.start, ev.end) * COL_WIDTH,
                      COL_WIDTH / 2
                    );
                    return (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setSelectedEvent(ev);
                          setShowDetail(true);
                        }}
                        title={ev.title}
                        style={{
                          position: "absolute",
                          top: 6,
                          height: 36,
                          left,
                          width: width - 4,
                          background: ev.color || "#003DA5",
                          borderRadius: 6,
                          padding: "0 6px",
                          display: "flex",
                          alignItems: "center",
                          color: "white",
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: "pointer",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          zIndex: 2,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "floors" && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            <a
              href="/dashboard/map"
              style={{
                color: "#003DA5",
                fontSize: 16,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Open Floor Map →
            </a>
          </div>
        )}
      </div>

      {/* Booking Modal */}
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
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 600 }}>
              New Booking
            </h3>

            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 }}>
              Room
              <select
                value={modalRoom?.id || ""}
                onChange={(e) =>
                  setModalRoom(rooms.find((r) => r.id === +e.target.value) || null)
                }
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
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.capacity} seats)
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 }}>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                From
                <select
                  value={modalFrom}
                  onChange={(e) => {
                    setModalFrom(e.target.value);
                    const fm = timeToMin(e.target.value);
                    if (timeToMin(modalTo) <= fm)
                      setModalTo(minToTime(Math.min(fm + 60, 20 * 60)));
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
                  {timeSlots.filter((t) => t < "20:00").map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
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
                  {timeSlots.filter((t) => t > modalFrom).map((t) => (
                    <option key={t} value={t}>{t}</option>
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

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
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
                disabled={saving || !modalRoom}
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

      {/* Event detail panel */}
      {showDetail && selectedEvent && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
          }}
          onMouseDown={() => {
            setShowDetail(false);
            setSelectedEvent(null);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 24,
              width: 360,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>
              {"title" in selectedEvent
                ? selectedEvent.title
                : "Event"}
            </h3>
            {"event_type" in selectedEvent && (
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
                Type: {(selectedEvent as TimelineEvent).event_type} ·{" "}
                {(selectedEvent as TimelineEvent).resource_name}
              </div>
            )}
            <button
              onClick={() => {
                setShowDetail(false);
                setSelectedEvent(null);
              }}
              style={{
                padding: "6px 14px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "white",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
