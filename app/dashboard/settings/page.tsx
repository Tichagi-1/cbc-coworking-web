"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const TABS = ["General", "Branding", "Operations", "Roles", "Salto"] as const;
type Tab = (typeof TABS)[number];

const PERMISSIONS_LIST = [
  { key: "create_booking", label: "Create bookings" },
  { key: "cancel_booking", label: "Cancel bookings" },
  { key: "create_tenant", label: "Create tenants" },
  { key: "edit_tenant", label: "Edit tenants" },
  { key: "adjust_coins", label: "Adjust coin balances" },
  { key: "manage_resources", label: "Manage resources" },
  { key: "manage_plans", label: "Manage plans" },
  { key: "manage_roles", label: "Manage roles" },
  { key: "manage_settings", label: "Manage settings" },
  { key: "view_analytics", label: "View analytics" },
  { key: "view_tenants", label: "View tenants" },
  { key: "view_workspace", label: "View workspace" },
];

const ROLES = ["admin", "manager", "receptionist", "tenant"];

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 4, padding: "8px 10px",
  border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 14,
};

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("General");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(document.cookie.match(/cbc_role=([^;]+)/)?.[1] || "");
    api.get<Record<string, string>>("/settings").then((r) => setSettings(r.data)).catch(() => {});
    api.get<Record<string, Record<string, boolean>>>("/permissions").then((r) => setPermissions(r.data)).catch(() => {});
  }, []);

  const isAdmin = role === "admin";

  async function saveSetting(key: string, value: string) {
    setSaving(true);
    try {
      await api.put("/settings", { key, value });
      setSettings((prev) => ({ ...prev, [key]: value }));
      setToast("Saved");
      setTimeout(() => setToast(null), 2000);
    } catch {
      /* noop */
    } finally {
      setSaving(false);
    }
  }

  async function togglePermission(r: string, perm: string, enabled: boolean) {
    try {
      await api.put("/permissions", { role: r, permission: perm, enabled });
      setPermissions((prev) => ({
        ...prev,
        [r]: { ...(prev[r] || {}), [perm]: enabled },
      }));
      setToast("Permission updated");
      setTimeout(() => setToast(null), 2000);
    } catch {
      /* noop */
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Settings</h1>
        <div style={{ color: "#6b7280", fontSize: 14 }}>Admin access required.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Settings</h1>

      {toast && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #e5e7eb" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px", border: "none", borderBottom: tab === t ? "2px solid #003DA5" : "2px solid transparent",
              background: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", marginBottom: -1,
              color: tab === t ? "#003DA5" : "#6b7280",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === "General" && (
        <div style={{ maxWidth: 500 }}>
          {["company_name", "building_name", "address", "phone", "email"].map((key) => (
            <label key={key} style={labelStyle}>
              {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              <input
                value={settings[key] || ""}
                onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.value }))}
                onBlur={() => saveSetting(key, settings[key] || "")}
                style={inputStyle}
              />
            </label>
          ))}
        </div>
      )}

      {/* Branding */}
      {tab === "Branding" && (
        <div style={{ maxWidth: 500 }}>
          <label style={labelStyle}>
            Accent Color
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                type="color"
                value={settings.accent_color || "#003DA5"}
                onChange={(e) => {
                  setSettings((p) => ({ ...p, accent_color: e.target.value }));
                  document.documentElement.style.setProperty("--cbc-accent", e.target.value);
                }}
                onBlur={() => saveSetting("accent_color", settings.accent_color || "#003DA5")}
                style={{ width: 48, height: 36, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}
              />
              <input
                value={settings.accent_color || "#003DA5"}
                onChange={(e) => setSettings((p) => ({ ...p, accent_color: e.target.value }))}
                onBlur={() => saveSetting("accent_color", settings.accent_color || "#003DA5")}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          </label>
          <label style={labelStyle}>
            Logo
            <div style={{ marginTop: 4 }}>
              {settings.logo_url && (
                <img src={settings.logo_url} alt="Logo" style={{ height: 40, marginBottom: 8, borderRadius: 4 }} />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append("file", file);
                  try {
                    const res = await api.post<{ logo_url: string }>("/settings/logo", form, {
                      headers: { "Content-Type": "multipart/form-data" },
                    });
                    setSettings((p) => ({ ...p, logo_url: res.data.logo_url }));
                    setToast("Logo uploaded");
                    setTimeout(() => setToast(null), 2000);
                  } catch {
                    /* noop */
                  }
                }}
                style={{ fontSize: 13 }}
              />
            </div>
          </label>
        </div>
      )}

      {/* Operations */}
      {tab === "Operations" && (
        <div style={{ maxWidth: 500 }}>
          <label style={labelStyle}>
            UZS Exchange Rate (1 USD =)
            <input
              type="number"
              value={settings.uzs_rate || "12800"}
              onChange={(e) => setSettings((p) => ({ ...p, uzs_rate: e.target.value }))}
              onBlur={() => saveSetting("uzs_rate", settings.uzs_rate || "12800")}
              style={inputStyle}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={labelStyle}>
              Working Hours Start
              <input
                type="time"
                value={settings.working_hours_start || "08:00"}
                onChange={(e) => setSettings((p) => ({ ...p, working_hours_start: e.target.value }))}
                onBlur={() => saveSetting("working_hours_start", settings.working_hours_start || "08:00")}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Working Hours End
              <input
                type="time"
                value={settings.working_hours_end || "20:00"}
                onChange={(e) => setSettings((p) => ({ ...p, working_hours_end: e.target.value }))}
                onBlur={() => saveSetting("working_hours_end", settings.working_hours_end || "20:00")}
                style={inputStyle}
              />
            </label>
          </div>
          <label style={labelStyle}>
            Minimum Booking (minutes)
            <select
              value={settings.min_booking_minutes || "5"}
              onChange={(e) => {
                setSettings((p) => ({ ...p, min_booking_minutes: e.target.value }));
                saveSetting("min_booking_minutes", e.target.value);
              }}
              style={inputStyle}
            >
              {[5, 15, 30, 60].map((m) => (
                <option key={m} value={String(m)}>{m} minutes</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Salto */}
      {tab === "Salto" && <SaltoTab settings={settings} saveSetting={saveSetting} saving={saving} />}

      {/* Roles & Permissions */}
      {tab === "Roles" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>
                  Permission
                </th>
                {ROLES.map((r) => (
                  <th key={r} style={{ textAlign: "center", padding: "8px 12px", fontWeight: 600, color: "#374151", textTransform: "capitalize" }}>
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS_LIST.map((perm) => (
                <tr key={perm.key} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 12px", color: "#374151" }}>{perm.label}</td>
                  {ROLES.map((r) => {
                    const checked = permissions[r]?.[perm.key] ?? false;
                    const locked = r === "admin";
                    return (
                      <td key={r} style={{ textAlign: "center", padding: "8px 12px" }}>
                        <input
                          type="checkbox"
                          checked={locked ? true : checked}
                          disabled={locked}
                          onChange={(e) => togglePermission(r, perm.key, e.target.checked)}
                          style={{ width: 16, height: 16, cursor: locked ? "not-allowed" : "pointer", accentColor: "#003DA5" }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
            Admin permissions are always enabled. Changes take effect on next login.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Salto KS tab ─────────────────────────────────────────────────────────

function SaltoTab({
  settings,
  saveSetting,
  saving,
}: {
  settings: Record<string, string>;
  saveSetting: (key: string, value: string) => Promise<void>;
  saving: boolean;
}) {
  const [apiKey, setApiKey] = useState(settings.salto_api_key || "");
  const [siteId, setSiteId] = useState(settings.salto_site_id || "");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setApiKey(settings.salto_api_key || "");
    setSiteId(settings.salto_site_id || "");
  }, [settings.salto_api_key, settings.salto_site_id]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setTestError(false);
    try {
      const res = await api.get<{ ok: boolean; device_count?: number; error?: string }>("/salto/test");
      if (res.data.ok) {
        setTestResult(`Connected — ${res.data.device_count ?? 0} devices found`);
        setTestError(false);
      } else {
        setTestResult(res.data.error || "Connection failed");
        setTestError(true);
      }
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setTestResult(detail || "Connection test failed");
      setTestError(true);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={{ maxWidth: 500 }}>
      <div style={{ fontSize: 13, color: "#0369a1", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        Salto KS Integration
      </div>

      <label style={labelStyle}>
        API Key
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onBlur={() => saveSetting("salto_api_key", apiKey)}
          placeholder="Enter Salto API key"
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Site ID
        <input
          type="text"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          onBlur={() => saveSetting("salto_site_id", siteId)}
          placeholder="Enter Salto Site ID"
          style={inputStyle}
        />
      </label>

      <button
        onClick={handleTest}
        disabled={testing || saving}
        style={{
          padding: "8px 16px", background: "#003DA5", color: "white", border: "none",
          borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 500,
          opacity: testing ? 0.6 : 1, marginBottom: 12,
        }}
      >
        {testing ? "Testing..." : "Test Connection"}
      </button>

      {testResult && (
        <div style={{
          padding: "10px 14px", borderRadius: 6, fontSize: 13, marginTop: 8,
          background: testError ? "#fee2e2" : "#ecfdf5",
          color: testError ? "#dc2626" : "#065f46",
          border: `1px solid ${testError ? "#fca5a5" : "#a7f3d0"}`,
        }}>
          {testResult}
        </div>
      )}
    </div>
  );
}
