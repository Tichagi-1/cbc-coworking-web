"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { api } from "@/lib/api";
import type { Plan, Tenant } from "@/lib/types";

interface CoinSummary {
  tenant_id: number;
  company_name: string;
  coin_balance: number;
  coin_last_reset: string | null;
  next_reset: string | null;
  projected_coins: number;
  breakdown: { resource_name: string; monthly_rate_uzs: number; coin_pct: number; coins: number }[];
}

interface CoinTx {
  id: number;
  delta: number;
  reason: string;
  note: string | null;
  created_at: string;
}

function balanceColor(bal: number): string {
  if (bal >= 1000) return "#059669";
  if (bal >= 100) return "#D97706";
  return "#DC2626";
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [coinModalTenant, setCoinModalTenant] = useState<Tenant | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(document.cookie.match(/cbc_role=([^;]+)/)?.[1] || "");
    loadTenants();
  }, []);

  const isAdmin = role === "admin" || role === "manager";

  async function loadTenants() {
    try {
      const res = await api.get<Tenant[]>("/tenants/");
      setTenants(res.data);
    } catch (e) {
      setError((e as Error)?.message || "Failed to load tenants");
    }
  }

  async function handleDeleteTenant() {
    if (!deleteTarget) return;
    setDeletingTenant(true);
    try {
      await api.delete(`/tenants/${deleteTarget.id}`);
      setTenants((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      setToast("Tenant deleted");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError((e as Error)?.message || "Failed to delete tenant");
    }
    setDeletingTenant(false);
  }

  return (
    <div className="p-6">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="text-2xl font-semibold text-gray-900">Tenants</h1>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: "8px 16px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer", fontWeight: 500 }}
          >
            + New Tenant
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">×</button>
        </div>
      )}
      {toast && (
        <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md p-3 mb-4">
          {toast}
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="text-sm text-gray-500 p-8 border border-dashed border-gray-300 rounded-md">
          No tenants found.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Company</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Unit</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Plan</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Coin Balance</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Last Reset</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Resident</th>
                {isAdmin && (
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div style={{ fontWeight: 500, color: "#111827" }}>{t.company_name}</div>
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: t.tenant_type === "individual" ? "#fef3c7" : "#eff6ff", color: t.tenant_type === "individual" ? "#92400e" : "#1e40af", fontWeight: 600 }}>
                      {t.tenant_type === "individual" ? "👤 Individual" : "🏢 Company"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{t.unit_number || "—"}</td>
                  <td className="px-4 py-3">
                    {t.plan_type ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                        {t.plan_type}
                      </span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: balanceColor(t.coin_balance) }}>
                    {Math.round(t.coin_balance).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {t.coin_last_reset ? dayjs(t.coin_last_reset).format("MMM D, YYYY") : "--"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.is_resident ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-semibold">YES</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-semibold">NO</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-center">
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        <button
                          onClick={() => setEditTenant(t)}
                          style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setCoinModalTenant(t)}
                          style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
                        >
                          Coins
                        </button>
                        <a
                          href={`/dashboard/tenants/${t.id}/members`}
                          style={{padding:'4px 10px', border:'1px solid #d1d5db', borderRadius:6, background:'white', cursor:'pointer', fontSize:12, fontWeight:500, textDecoration:'none', color:'#374151'}}
                        >
                          Members
                        </a>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          title="Delete tenant"
                          style={{padding:'4px 10px', border:'1px solid #fecaca', borderRadius:6, background:'white', cursor:'pointer', fontSize:12, fontWeight:500, color:'#dc2626'}}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Coin management modal */}
      {coinModalTenant && (
        <CoinModal
          tenant={coinModalTenant}
          onClose={() => setCoinModalTenant(null)}
          onUpdated={async () => {
            await loadTenants();
            const fresh = await api.get<Tenant[]>("/tenants/");
            const updated = fresh.data.find((t) => t.id === coinModalTenant.id);
            if (updated) setCoinModalTenant(updated);
            setToast("Coins updated");
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {/* Create tenant modal */}
      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await loadTenants();
            setToast("Tenant created!");
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {/* Edit tenant modal */}
      {editTenant && (
        <EditTenantModal
          tenant={editTenant}
          onClose={() => setEditTenant(null)}
          onSaved={async () => {
            setEditTenant(null);
            await loadTenants();
            setToast("Tenant updated");
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {/* Delete tenant confirmation */}
      {deleteTarget && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div style={{ background: "white", borderRadius: 12, padding: 24, maxWidth: 420, width: "100%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Delete tenant?</h3>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 6 }}>
              <strong>{deleteTarget.company_name}</strong>
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>
              All linked resources will be unassigned. Booking history will be preserved.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ padding: "8px 18px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 14, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTenant}
                disabled={deletingTenant}
                style={{ padding: "8px 18px", background: deletingTenant ? "#fca5a5" : "#dc2626", color: "white", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: deletingTenant ? "default" : "pointer" }}
              >
                {deletingTenant ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Coin management modal ─────────────────────────────────────────────────

function CoinModal({
  tenant,
  onClose,
  onUpdated,
}: {
  tenant: Tenant;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CoinTx[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [summary, setSummary] = useState<CoinSummary | null>(null);

  useEffect(() => {
    // Load tx history
    setLoadingHistory(true);
    api
      .get<CoinTx[]>(`/tenants/${tenant.id}/coins/history`)
      .then((r) => setHistory(r.data.slice(0, 10)))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));

    // Load summary for accrual info
    api
      .get<CoinSummary>(`/tenants/${tenant.id}/coin-summary`)
      .then((r) => setSummary(r.data))
      .catch(() => {});
  }, [tenant.id]);

  async function handleAdjust() {
    if (adjustAmount === 0) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/tenants/${tenant.id}/coins/adjust`, {
        delta: adjustAmount,
        note: adjustNote || null,
      });
      setAdjustAmount(0);
      setAdjustNote("");
      await onUpdated();
      // Refresh history
      const h = await api.get<CoinTx[]>(`/tenants/${tenant.id}/coins/history`);
      setHistory(h.data.slice(0, 10));
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to adjust");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("This will REPLACE the current coin balance with the newly calculated accrual amount. Continue?"))
      return;
    setResetting(true);
    setError("");
    try {
      await api.post(`/tenants/${tenant.id}/coins/reset`);
      await onUpdated();
      const h = await api.get<CoinTx[]>(`/tenants/${tenant.id}/coins/history`);
      setHistory(h.data.slice(0, 10));
      const s = await api.get<CoinSummary>(`/tenants/${tenant.id}/coin-summary`);
      setSummary(s.data);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to reset");
    } finally {
      setResetting(false);
    }
  }

  const projectedCoins = summary?.projected_coins ?? Math.round(tenant.monthly_rate * 0.25);
  const inputStyle: React.CSSProperties = {
    display: "block", width: "100%", marginTop: 4, padding: "8px 10px",
    border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
      onMouseDown={onClose}
    >
      <div
        style={{ background: "white", borderRadius: 12, padding: 28, width: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            Coin Management — {tenant.company_name}
          </h2>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#666" }}>×</button>
        </div>

        {/* Current balance */}
        <div style={{ background: "#fef3c7", padding: 16, borderRadius: 8, textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#92400e" }}>Current Balance</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: balanceColor(tenant.coin_balance) }}>
            {Math.round(tenant.coin_balance).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "#92400e" }}>coins</div>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", color: "#dc2626", padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>
        )}

        {/* ACTION 1 — Adjust */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Add / Deduct Coins</div>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
            Amount (+ to add, − to deduct)
            <input type="number" value={adjustAmount || ""} onChange={(e) => setAdjustAmount(+e.target.value)} placeholder="e.g. 500 or -200" style={inputStyle} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginTop: 8, display: "block" }}>
            Reason (optional)
            <input type="text" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="Manual adjustment" style={inputStyle} />
          </label>
          {adjustAmount !== 0 && (
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
              New balance: <strong style={{ color: balanceColor(tenant.coin_balance + adjustAmount) }}>
                {Math.round(tenant.coin_balance + adjustAmount).toLocaleString()}
              </strong> coins
            </div>
          )}
          <button onClick={handleAdjust} disabled={saving || adjustAmount === 0}
            style={{ marginTop: 10, padding: "8px 16px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, opacity: saving || adjustAmount === 0 ? 0.5 : 1 }}>
            {saving ? "Applying..." : "Apply Adjustment"}
          </button>
        </div>

        {/* ACTION 2 — Monthly Reset */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Monthly Coin Reset</div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.8, marginBottom: 12 }}>
            Projected accrual: <strong>{projectedCoins.toLocaleString()}</strong> coins<br />
            {summary?.breakdown && summary.breakdown.length > 0 && (
              <>Based on {summary.breakdown.length} occupied resource(s)<br /></>
            )}
            Last reset: {tenant.coin_last_reset ? dayjs(tenant.coin_last_reset).format("MMM D, YYYY") : "Never"}
          </div>
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#92400e", marginBottom: 10 }}>
            This will REPLACE current balance with the newly calculated amount.
          </div>
          <button onClick={handleReset} disabled={resetting}
            style={{ padding: "8px 16px", border: "1px solid #f59e0b", borderRadius: 6, background: "white", color: "#92400e", cursor: "pointer", fontSize: 14, fontWeight: 500, opacity: resetting ? 0.5 : 1 }}>
            {resetting ? "Resetting..." : "Reset & Accrue for This Month"}
          </button>
        </div>

        {/* Transaction history */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Recent Transactions</div>
          {loadingHistory ? (
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Loading...</div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: 13, color: "#9ca3af" }}>No transactions yet.</div>
          ) : (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "#6b7280", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "4px 6px", fontWeight: 500 }}>Date</th>
                  <th style={{ padding: "4px 6px", fontWeight: 500, textAlign: "right" }}>Change</th>
                  <th style={{ padding: "4px 6px", fontWeight: 500 }}>Reason</th>
                  <th style={{ padding: "4px 6px", fontWeight: 500 }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "4px 6px", color: "#6b7280" }}>
                      {dayjs(tx.created_at).format("MMM D, HH:mm")}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600, color: tx.delta >= 0 ? "#059669" : "#DC2626" }}>
                      {tx.delta >= 0 ? "+" : ""}{Math.round(tx.delta).toLocaleString()}
                    </td>
                    <td style={{ padding: "4px 6px", color: "#374151" }}>
                      {tx.reason.replace("_", " ")}
                    </td>
                    <td style={{ padding: "4px 6px", color: "#9ca3af", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.note || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create tenant modal ───────────────────────────────────────────────────

function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenantType, setTenantType] = useState("company");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [isResident, setIsResident] = useState(true);
  const [planId, setPlanId] = useState<number | null>(null);
  const [monthlyRate, setMonthlyRate] = useState(0);
  const [seatCount, setSeatCount] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Plan[]>("/plans", { params: { building_id: 1 } })
      .then((r) => setPlans(r.data))
      .catch(() => {});
  }, []);

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;

  useEffect(() => {
    if (!selectedPlan) return;
    if (selectedPlan.billing_mode === "per_seat") {
      setMonthlyRate(selectedPlan.base_rate_uzs * seatCount);
    } else {
      setMonthlyRate(selectedPlan.base_rate_uzs);
    }
  }, [selectedPlan, seatCount]);

  const coinPreview = Math.round(monthlyRate * ((selectedPlan?.coin_pct ?? 25) / 100));

  async function handleSubmit() {
    if (!companyName.trim() || !email.trim() || !password || !userName.trim()) {
      setError("Company name, email, password, and name are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Step 1: Create user account
      const userRes = await api.post<{ access_token: string; role: string; name: string }>("/auth/register", {
        email: email.trim(),
        password,
        name: userName.trim(),
        role: "tenant",
      });
      // Extract user_id from token payload (sub claim)
      const token = userRes.data.access_token;
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = parseInt(payload.sub);

      // Step 2: Create tenant
      await api.post("/tenants/", {
        user_id: userId,
        tenant_type: tenantType,
        company_name: companyName.trim(),
        contact_name: tenantType === "company" ? (contactName.trim() || null) : null,
        contact_phone: contactPhone.trim() || null,
        unit_number: unitNumber.trim() || null,
        notes: notes.trim() || null,
        plan_type: selectedPlan?.name || null,
        monthly_rate: monthlyRate,
        is_resident: isResident,
      });

      await onCreated();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Failed to create tenant");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    display: "block", width: "100%", marginTop: 4, padding: "8px 10px",
    border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
      onMouseDown={onClose}>
      <div style={{ background: "white", borderRadius: 12, padding: 28, width: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>New Tenant</h2>

        {error && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#0369a1" }}>
          User Account (login credentials)
        </div>

        <label style={labelStyle}>
          Email (login)
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tenant@company.com" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Name
          <input type="text" required value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Full name" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Password (min 8 chars)
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
        </label>

        <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 8, paddingTop: 16, marginBottom: 8 }}>
          {/* Type selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["company", "individual"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTenantType(t)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 6, cursor: "pointer", fontSize: 13, textTransform: "capitalize",
                  border: `2px solid ${tenantType === t ? "#003DA5" : "#e5e7eb"}`,
                  background: tenantType === t ? "#eff6ff" : "white",
                  color: tenantType === t ? "#003DA5" : "#6b7280",
                  fontWeight: tenantType === t ? 600 : 400,
                }}>
                {t === "company" ? "🏢 Company" : "👤 Individual"}
              </button>
            ))}
          </div>
        </div>

        <label style={labelStyle}>
          {tenantType === "company" ? "Company Name *" : "Full Name *"}
          <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: tenantType === "company" ? "1fr 1fr" : "1fr", gap: 12 }}>
          {tenantType === "company" && (
            <label style={labelStyle}>
              Contact Name
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} style={inputStyle} />
            </label>
          )}
          <label style={labelStyle}>
            Phone
            <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label style={labelStyle}>
          Office / Unit Number
          <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="e.g. 417, Floor 3, Desk A4" style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." rows={3}
            style={{ ...inputStyle, resize: "vertical" as const }} />
        </label>

        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={isResident} onChange={(e) => setIsResident(e.target.checked)} />
          Is Resident
        </label>

        <label style={labelStyle}>
          Plan
          <select value={planId ?? ""} onChange={(e) => setPlanId(e.target.value ? +e.target.value : null)} style={inputStyle}>
            <option value="">-- No plan --</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.billing_mode})</option>)}
          </select>
        </label>

        {selectedPlan?.billing_mode === "per_seat" && (
          <label style={labelStyle}>
            Seats
            <input type="number" min={1} value={seatCount} onChange={(e) => setSeatCount(+e.target.value || 1)} style={inputStyle} />
          </label>
        )}

        <label style={labelStyle}>
          Monthly Rate (сум)
          <input type="number" min={0} value={monthlyRate} onChange={(e) => setMonthlyRate(+e.target.value)} style={inputStyle} />
        </label>

        <div style={{ background: "#fef3c7", padding: 10, borderRadius: 6, fontSize: 12, color: "#92400e", marginBottom: 16 }}>
          Will receive <strong>{coinPreview.toLocaleString()}</strong> coins on first reset
          ({selectedPlan?.coin_pct ?? 25}% of {monthlyRate.toLocaleString()} сум)
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: "8px 16px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Creating..." : "Create Tenant"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit tenant modal ─────────────────────────────────────────────────────

function EditTenantModal({ tenant, onClose, onSaved }: { tenant: Tenant; onClose: () => void; onSaved: () => Promise<void> }) {
  const [companyName, setCompanyName] = useState(tenant.company_name);
  const [contactName, setContactName] = useState(tenant.contact_name || "");
  const [planType, setPlanType] = useState(tenant.plan_type || "");
  const [monthlyRate, setMonthlyRate] = useState(tenant.monthly_rate);
  const [unitNumber, setUnitNumber] = useState(tenant.unit_number || "");
  const [notes, setNotes] = useState(tenant.notes || "");
  const [isResident, setIsResident] = useState(tenant.is_resident);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/tenants/${tenant.id}`, {
        company_name: companyName.trim(),
        contact_name: contactName.trim() || null,
        plan_type: planType.trim() || null,
        monthly_rate: monthlyRate,
        is_resident: isResident,
        unit_number: unitNumber.trim() || null,
        notes: notes.trim() || null,
      });
      await onSaved();
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    display: "block", width: "100%", marginTop: 4, padding: "8px 10px",
    border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
      onMouseDown={onClose}>
      <div style={{ background: "white", borderRadius: 12, padding: 28, width: 440, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>Edit Tenant</h2>

        {error && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <label style={labelStyle}>
          Company Name
          <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Contact Name
          <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Office / Unit Number
          <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="e.g. 417, Floor 3" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." rows={2} style={{ ...inputStyle, resize: "vertical" as const }} />
        </label>
        <label style={labelStyle}>
          Plan Type
          <input type="text" value={planType} onChange={(e) => setPlanType(e.target.value)} placeholder="e.g. Enterprise" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Monthly Rate (сум)
          <input type="number" min={0} value={monthlyRate} onChange={(e) => setMonthlyRate(+e.target.value)} style={inputStyle} />
        </label>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={isResident} onChange={(e) => setIsResident(e.target.checked)} />
          Is Resident
        </label>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
