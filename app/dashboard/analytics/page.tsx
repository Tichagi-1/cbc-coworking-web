"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { api } from "@/lib/api";

const ACCENT = "#003DA5";
const COLORS = ["#003DA5", "#1F69FF", "#418FDE", "#DAE1E8", "#6366f1", "#f59e0b"];

const fmtUZS = (n: number) =>
  n >= 1000000
    ? `${(n / 1000000).toFixed(1)}M сум`
    : `${Math.round(n).toLocaleString()} сум`;

/* eslint-disable @typescript-eslint/no-explicit-any */

function KPICard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "white", borderRadius: 10, padding: "16px 20px", border: "1px solid #e5e7eb", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vacancy, setVacancy] = useState<any>(null);
  const [role, setRole] = useState("");
  const [showPurge, setShowPurge] = useState(false);
  const [purgePassword, setPurgePassword] = useState("");
  const [purgeError, setPurgeError] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeToast, setPurgeToast] = useState("");

  useEffect(() => {
    setRole(document.cookie.match(/cbc_role=([^;]+)/)?.[1] || "");
  }, []);

  const reload = () => {
    setLoading(true);
    api.get("/analytics/summary", { params: { period_days: period } }).then((r) => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
    api.get("/analytics/vacancy").then((r) => setVacancy(r.data)).catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    api
      .get(`/analytics/summary`, { params: { period_days: period } })
      .then((r) => setData(r.data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    api.get("/analytics/vacancy").then((r) => setVacancy(r.data)).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)", color: "#6b7280", fontSize: 14 }}>
        Loading analytics...
      </div>
    );
  }

  if (!data) return null;

  const kpi = data?.kpi || {};
  const bookings_by_day = data?.bookings_by_day || [];
  const room_utilization = data?.room_utilization || [];
  const coin_economy = data?.coin_economy || { total_balance: 0, spent_month: 0, revenue_month: 0 };
  const recent_bookings = data?.recent_bookings || [];
  const tenant_rankings = data?.tenant_rankings || [];

  return (
    <div style={{ padding: "20px 24px", background: "#f9fafb", minHeight: "calc(100vh - 64px)", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Analytics</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>Modera Coworking — operational overview</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "white", padding: 4, borderRadius: 8, border: "1px solid #e5e7eb" }}>
          {[7, 30, 90].map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer",
                background: period === p ? ACCENT : "transparent", color: period === p ? "white" : "#6b7280" }}>
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KPICard label="Occupancy Rate" value={kpi.occupancy_rate != null ? `${kpi.occupancy_rate}%` : "—"} sub="by area (GLA)"
          color={kpi.occupancy_rate != null ? (kpi.occupancy_rate > 70 ? "#16a34a" : kpi.occupancy_rate > 40 ? "#d97706" : "#dc2626") : "#9ca3af"} />
        <KPICard label="Active Tenants" value={kpi.active_tenants ?? 0} sub="companies" />
        <KPICard label="Bookings Today" value={kpi.bookings_today ?? 0} sub="sessions" />
        <KPICard label="Coins Spent" value={(kpi.coins_spent_month ?? 0).toLocaleString()} sub="this month" color={ACCENT} />
        <KPICard label="Cash Revenue" value={fmtUZS(kpi.revenue_month_uzs ?? 0)} sub="this month" color="#16a34a" />
        <KPICard label="Rooms Free" value={`${kpi.rooms_free_now ?? 0}/${kpi.total_rooms ?? 0}`} sub="now"
          color={(kpi.rooms_free_now ?? 0) > 0 ? "#16a34a" : "#dc2626"} />
      </div>

      {/* Vacancy overview */}
      {vacancy?.building && (
        <div style={{ background: "white", borderRadius: 10, padding: 20, border: "1px solid #e5e7eb", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: "#111827" }}>Vacancy Overview</div>

          {/* Building */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 500 }}>Building</span>
              <span style={{ color: "#6b7280" }}>
                {vacancy.building.occupied_area_m2} / {vacancy.building.total_area_m2} m² occupied
                {vacancy.building.vacancy_rate != null && ` · ${vacancy.building.vacancy_rate}% vacant`}
              </span>
            </div>
            {vacancy.building.total_area_m2 > 0 && (
              <div style={{ height: 10, background: "#f3f4f6", borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 5, background: "#003DA5", transition: "width 0.5s ease",
                  width: `${100 - (vacancy.building.vacancy_rate ?? 0)}%`,
                }} />
              </div>
            )}
          </div>

          {/* Per floor */}
          {(vacancy.floors || []).map((f: any) => (
            <div key={f.floor_id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#374151", fontWeight: 500 }}>
                  {f.floor_name}
                  <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 5px", borderRadius: 4, background: f.vacancy_metric === "seats" ? "#eff6ff" : "#f0fdf4", color: f.vacancy_metric === "seats" ? "#2563eb" : "#16a34a" }}>
                    {f.unit_label}
                  </span>
                </span>
                <span style={{ color: "#6b7280" }}>
                  {f.configured
                    ? `${f.occupied} / ${f.total} ${f.unit_label} · ${f.vacancy_rate ?? 0}% vacant`
                    : "Configure floor settings"}
                </span>
              </div>
              {f.configured && (
                <div style={{ height: 7, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4, background: "#003DA5", width: `${100 - (f.vacancy_rate ?? 0)}%` }} />
                </div>
              )}
            </div>
          ))}

          {vacancy.unassigned_count > 0 && (
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>{vacancy.unassigned_count} resources not assigned to a floor</div>
          )}
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Bookings by day */}
        <div style={{ background: "white", borderRadius: 10, padding: 20, border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: "#111827" }}>
            Bookings per day — last {period} days
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={bookings_by_day}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11, fill: "#9ca3af" }}
                interval={Math.floor(bookings_by_day.length / 6)} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
              <Tooltip formatter={(v: any) => [`${v} bookings`, ""]} labelFormatter={(l: any) => `Date: ${l}`}
                contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Line type="monotone" dataKey="bookings" stroke={ACCENT} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Coin economy donut */}
        <div style={{ background: "white", borderRadius: 10, padding: 20, border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: "#111827" }}>Coin Economy</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>this month</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={[
                { name: "Coins used", value: coin_economy.spent_month || 1 },
                { name: "Balance remaining", value: coin_economy.total_balance || 1 },
              ]} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                <Cell fill={ACCENT} />
                <Cell fill="#DAE1E8" />
              </Pie>
              <Tooltip formatter={(v: any) => [v.toLocaleString(), ""]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10, marginTop: 4, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#6b7280" }}>Cash collected</span>
            <span style={{ fontWeight: 600, color: "#16a34a" }}>{fmtUZS(coin_economy.revenue_month)}</span>
          </div>
        </div>
      </div>

      {/* Room utilization */}
      {room_utilization.length > 0 && (
        <div style={{ background: "white", borderRadius: 10, padding: 20, border: "1px solid #e5e7eb", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: "#111827" }}>
            Meeting Room Utilization — last {period} days
          </div>
          <ResponsiveContainer width="100%" height={Math.max(100, room_utilization.length * 40)}>
            <BarChart data={room_utilization} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis type="category" dataKey="room" width={100} tick={{ fontSize: 12, fill: "#374151" }} />
              <Tooltip formatter={(v: any, _: any, p: any) => [`${p.payload.hours}h (${v}%)`, "Utilization"]}
                contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {room_utilization.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom: Tenant rankings + Recent bookings */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
        {/* Tenant rankings */}
        <div style={{ background: "white", borderRadius: 10, padding: 20, border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: "#111827" }}>Tenant Activity</div>
          {tenant_rankings.map((t: any, i: number) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0",
              borderBottom: i < tenant_rankings.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{t.company}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{t.bookings} bookings</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 600,
                  color: t.risk === "high" ? "#dc2626" : t.risk === "medium" ? "#d97706" : "#16a34a" }}>
                  {t.coin_balance.toLocaleString()} coins
                </div>
                {t.risk === "high" && <div style={{ fontSize: 10, color: "#dc2626" }}>low balance</div>}
              </div>
            </div>
          ))}
          {tenant_rankings.length === 0 && (
            <div style={{ fontSize: 13, color: "#9ca3af" }}>No tenants yet.</div>
          )}
        </div>

        {/* Recent bookings */}
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, fontSize: 14, color: "#111827" }}>
            Recent Bookings
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Date", "Room", "Tenant", "Time", "Coins", "Cash"].map((h) => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, color: "#6b7280", fontWeight: 600, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent_bookings.map((b: any) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{b.date}</td>
                    <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 500, color: "#111827" }}>{b.room}</td>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: "#374151" }}>{b.tenant}</td>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{b.start}–{b.end}</td>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: b.coins > 0 ? ACCENT : "#9ca3af", fontWeight: b.coins > 0 ? 600 : 400 }}>
                      {b.coins > 0 ? b.coins : "—"}
                    </td>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: b.money_uzs > 0 ? "#16a34a" : "#9ca3af", fontWeight: b.money_uzs > 0 ? 600 : 400 }}>
                      {b.money_uzs > 0 ? fmtUZS(b.money_uzs) : "—"}
                    </td>
                  </tr>
                ))}
                {recent_bookings.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No bookings yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Admin: purge bookings */}
      {role === "admin" && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>Data Management</div>
          <button onClick={() => { setShowPurge(true); setPurgePassword(""); setPurgeError(""); }}
            style={{ padding: "6px 14px", border: "1px solid #fca5a5", borderRadius: 6, background: "white", color: "#dc2626", fontSize: 13, cursor: "pointer" }}>
            Purge all bookings
          </button>
          {purgeToast && (
            <span style={{ marginLeft: 12, fontSize: 13, color: "#16a34a" }}>{purgeToast}</span>
          )}
        </div>
      )}

      {/* Purge modal */}
      {showPurge && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
          onMouseDown={() => setShowPurge(false)}>
          <div style={{ background: "white", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 40 }}>⚠️</div>
              <h3 style={{ margin: "8px 0 0", fontSize: 17, fontWeight: 600, color: "#dc2626" }}>Purge Booking Data</h3>
            </div>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 16 }}>
              This will delete <strong>ALL bookings</strong> and reset all tenant coin balances to 0. This action is irreversible.
            </p>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 }}>
              Enter your password to confirm
              <input type="password" value={purgePassword} onChange={(e) => { setPurgePassword(e.target.value); setPurgeError(""); }}
                placeholder="Password"
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: `1px solid ${purgeError ? "#fca5a5" : "#d1d5db"}`, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
            </label>
            {purgeError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{purgeError}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowPurge(false)}
                style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>
                Cancel
              </button>
              <button
                disabled={purging || !purgePassword}
                onClick={async () => {
                  setPurging(true);
                  setPurgeError("");
                  try {
                    const res = await api.post<{ deleted_bookings: number }>("/bookings/purge", { password: purgePassword });
                    setShowPurge(false);
                    setPurgeToast(`Deleted ${res.data.deleted_bookings} bookings. Coin balances reset.`);
                    setTimeout(() => setPurgeToast(""), 5000);
                    reload();
                  } catch (e: unknown) {
                    const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                    if (detail === "Invalid password") {
                      setPurgeError("Wrong password");
                    } else {
                      setPurgeError(detail || "Failed");
                    }
                  } finally {
                    setPurging(false);
                  }
                }}
                style={{ padding: "8px 16px", background: "#dc2626", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, opacity: purging || !purgePassword ? 0.6 : 1 }}>
                {purging ? "Deleting..." : "Confirm Purge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
