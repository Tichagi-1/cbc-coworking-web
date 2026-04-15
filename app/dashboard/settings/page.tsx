"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const TABS = ["General", "Branding", "Operations", "Roles", "Salto", "Users"] as const;
type Tab = (typeof TABS)[number];

const PERMISSIONS_LIST = [
  { key: "view_properties", label: "View properties" },
  { key: "view_analytics", label: "View analytics" },
  { key: "view_tenants", label: "View tenants" },
  { key: "view_floor_map", label: "View floor map" },
  { key: "view_workspace", label: "View workspace" },
  { key: "edit_floor_map", label: "Edit floor map" },
  { key: "create_booking", label: "Create bookings" },
  { key: "cancel_booking", label: "Cancel bookings" },
  { key: "create_tenant", label: "Create tenants" },
  { key: "edit_tenant", label: "Edit tenants" },
  { key: "adjust_coins", label: "Adjust coins" },
  { key: "manage_resources", label: "Manage resources" },
  { key: "manage_plans", label: "Manage plans" },
  { key: "manage_users", label: "Manage users" },
  { key: "manage_settings", label: "Manage settings" },
  { key: "manage_properties", label: "Manage properties" },
  { key: "purge_data", label: "Purge data" },
];

const ROLES = ["admin", "manager", "receptionist", "owner", "tenant"];

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

          <ZoneColorsSection settings={settings} setSettings={setSettings} setToast={setToast} />
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

      {/* Users */}
      {tab === "Users" && <UsersTab />}
    </div>
  );
}

// ── Users management tab ────────────────────────────────────────────────

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
}

const ROLE_BADGE: Record<string, string> = {
  admin: "background:#fef2f2;color:#dc2626",
  manager: "background:#f5f3ff;color:#7c3aed",
  receptionist: "background:#eff6ff;color:#2563eb",
  tenant: "background:#f3f4f6;color:#6b7280",
};

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", role: "tenant" });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [toast, setToast] = useState("");

  const currentUserId = (() => {
    try {
      const token = document.cookie.match(/cbc_token=([^;]+)/)?.[1];
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return parseInt(payload.sub);
    } catch { return null; }
  })();

  const loadUsers = () => {
    api.get<UserRow[]>("/auth/users").then((r) => setUsers(r.data)).catch(() => {});
  };
  useEffect(() => { loadUsers(); }, []);

  const handleAdd = async () => {
    setAddSaving(true);
    setAddError("");
    try {
      await api.post("/auth/register", addForm);
      setShowAdd(false);
      setAddForm({ name: "", email: "", password: "", role: "tenant" });
      loadUsers();
      setToast("User created");
      setTimeout(() => setToast(""), 3000);
    } catch (e: unknown) {
      setAddError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally {
      setAddSaving(false);
    }
  };

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const changeRole = async (userId: number, newRole: string) => {
    try {
      await api.patch(`/auth/users/${userId}`, { role: newRole });
      loadUsers();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    }
  };

  const toggleActive = async (userId: number, active: boolean) => {
    if (!active && !confirm("Deactivate this user? They will not be able to log in.")) return;
    try {
      await api.patch(`/auth/users/${userId}`, { is_active: active });
      loadUsers();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    }
  };

  const saveUserEdit = async (userId: number) => {
    try {
      await api.patch(`/auth/users/${userId}`, { name: editName, email: editEmail });
      setEditingUserId(null);
      loadUsers();
      setToast("User updated");
      setTimeout(() => setToast(""), 3000);
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    }
  };

  const deleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Delete user "${userName}"? This will unlink all assigned resources.`)) return;
    try {
      await api.delete(`/auth/users/${userId}`);
      loadUsers();
      setToast("User deleted");
      setTimeout(() => setToast(""), 3000);
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    }
  };

  // Password reset
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    setNewPassword(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
  };

  const handleResetPassword = async () => {
    if (!resetUser || newPassword.length < 6) return;
    setResetSaving(true);
    try {
      await api.patch(`/auth/users/${resetUser.id}/reset-password`, { new_password: newPassword });
      setResetDone(true);
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed");
    } finally {
      setResetSaving(false);
    }
  };

  const iStyle: React.CSSProperties = {
    display: "block", width: "100%", marginTop: 4, padding: "8px 10px",
    border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>System Users</div>
        <button onClick={() => setShowAdd(true)}
          style={{ padding: "6px 14px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          + Add User
        </button>
      </div>

      {toast && <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{toast}</div>}

      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
            {["Name", "Email", "Role", "Status", "Actions"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#374151" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <tr key={u.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                  {editingUserId === u.id ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      style={{ padding: "3px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, width: 120 }} />
                  ) : u.name}
                </td>
                <td style={{ padding: "8px 12px", color: "#6b7280" }}>
                  {editingUserId === u.id ? (
                    <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                      style={{ padding: "3px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, width: 160 }} />
                  ) : u.email}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {isSelf ? (
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, ...(ROLE_BADGE[u.role] ? { cssText: ROLE_BADGE[u.role] } : {}) } as React.CSSProperties}>
                      {u.role}
                    </span>
                  ) : (
                    <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}
                      style={{ padding: "3px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12, cursor: "pointer" }}>
                      {["admin", "manager", "receptionist", "owner", "tenant"].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: u.is_active ? "#16a34a" : "#dc2626" }}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {editingUserId === u.id ? (
                      <>
                        <button onClick={() => saveUserEdit(u.id)} style={{ fontSize: 11, padding: "3px 8px", border: "1px solid #a7f3d0", borderRadius: 4, background: "#ecfdf5", color: "#065f46", cursor: "pointer" }}>Save</button>
                        <button onClick={() => setEditingUserId(null)} style={{ fontSize: 11, padding: "3px 8px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", cursor: "pointer" }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        {!isSelf && (
                          <button onClick={() => { setEditingUserId(u.id); setEditName(u.name); setEditEmail(u.email); }}
                            style={{ fontSize: 11, padding: "3px 8px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", cursor: "pointer" }}>Edit</button>
                        )}
                        {!isSelf && (
                          <button onClick={() => { setResetUser(u); setNewPassword(""); setResetDone(false); }}
                            title="Reset password"
                            style={{ fontSize: 11, padding: "3px 8px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", cursor: "pointer" }}>🔑</button>
                        )}
                        {!isSelf && (
                          <button onClick={() => toggleActive(u.id, !u.is_active)}
                            style={{ fontSize: 11, padding: "3px 8px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", cursor: "pointer", color: u.is_active ? "#dc2626" : "#16a34a" }}>
                            {u.is_active ? "Off" : "On"}
                          </button>
                        )}
                        {!isSelf && (
                          <button onClick={() => deleteUser(u.id, u.name)}
                            style={{ fontSize: 11, padding: "3px 8px", border: "1px solid #fca5a5", borderRadius: 4, background: "#fef2f2", color: "#dc2626", cursor: "pointer" }}>Del</button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Add User Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
          onMouseDown={() => setShowAdd(false)}>
          <div style={{ background: "white", borderRadius: 12, padding: 28, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onMouseDown={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 600 }}>Add User</h3>
            {addError && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{addError}</div>}
            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 }}>
              Name
              <input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} style={iStyle} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 }}>
              Email
              <input type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} style={iStyle} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 }}>
              Password
              <input type="password" value={addForm.password} onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))} style={iStyle} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 12 }}>
              Role
              <select value={addForm.role} onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))} style={iStyle}>
                {["admin", "manager", "receptionist", "owner", "tenant"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={handleAdd} disabled={addSaving || !addForm.name || !addForm.email || !addForm.password}
                style={{ padding: "8px 16px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, opacity: addSaving ? 0.7 : 1 }}>
                {addSaving ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setResetUser(null); }}>
          <div style={{ background: "white", borderRadius: 12, padding: 24, maxWidth: 400, width: "100%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Reset Password</h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>{resetUser.name} ({resetUser.email})</p>

            {!resetDone ? (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    style={{ flex: 1, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}
                  />
                  <button onClick={generatePassword}
                    style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, background: "#f9fafb", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
                    Generate
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={() => setResetUser(null)}
                    style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>
                    Cancel
                  </button>
                  <button onClick={handleResetPassword} disabled={resetSaving || newPassword.length < 6}
                    style={{ padding: "8px 16px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, opacity: resetSaving || newPassword.length < 6 ? 0.5 : 1 }}>
                    {resetSaving ? "Resetting..." : "Reset"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "#065f46", marginBottom: 4 }}>Password reset successfully. Copy it now:</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#111827", letterSpacing: 1 }}>{newPassword}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => setResetUser(null)}
                    style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>
                    Done
                  </button>
                </div>
              </>
            )}
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

// ── Zone Colors Section ──────────────────────────────────────────────────

const COLOR_DEFAULTS: Record<string, string> = {
  color_office_occupied: "#22C55E",
  color_office_vacant: "#EF4444",
  color_office_reserved: "#EAB308",
  color_open_space_occupied: "#059669",
  color_open_space_vacant: "#EF4444",
  color_hot_desk_occupied: "#0891B2",
  color_hot_desk_vacant: "#EF4444",
  color_meeting_room_fill: "#7C3AED",
  color_zoom_cabin: "#9333EA",
  color_event_zone: "#DC2626",
  zone_opacity: "0.35",
  zone_opacity_hover: "0.5",
};

const COLOR_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  { title: "Офисы (Office)", items: [
    { key: "color_office_occupied", label: "Occupied" },
    { key: "color_office_vacant", label: "Vacant" },
    { key: "color_office_reserved", label: "Reserved" },
  ]},
  { title: "Open Space", items: [
    { key: "color_open_space_occupied", label: "Occupied" },
    { key: "color_open_space_vacant", label: "Vacant" },
  ]},
  { title: "Hot Desk", items: [
    { key: "color_hot_desk_occupied", label: "Occupied" },
    { key: "color_hot_desk_vacant", label: "Vacant" },
  ]},
  { title: "Переговорные и зоны", items: [
    { key: "color_meeting_room_fill", label: "Meeting Room" },
    { key: "color_zoom_cabin", label: "Zoom Cabin" },
    { key: "color_event_zone", label: "Event Zone" },
  ]},
];

function ZoneColorsSection({
  settings, setSettings, setToast,
}: {
  settings: Record<string, string>;
  setSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setToast: (t: string | null) => void;
}) {
  const debouncers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const update = (key: string, value: string) => {
    setSettings((p) => ({ ...p, [key]: value }));
    if (debouncers.current[key]) clearTimeout(debouncers.current[key]);
    debouncers.current[key] = setTimeout(async () => {
      try {
        await api.patch("/settings/colors", { [key]: value });
        setToast("Цвет сохранён");
        setTimeout(() => setToast(null), 1500);
      } catch { /* noop */ }
    }, 500);
  };

  const resetDefaults = async () => {
    if (!confirm("Сбросить все цвета зон к значениям по умолчанию?")) return;
    setSettings((p) => ({ ...p, ...COLOR_DEFAULTS }));
    try {
      await api.patch("/settings/colors", COLOR_DEFAULTS);
      setToast("Сброшено по умолчанию");
      setTimeout(() => setToast(null), 1500);
    } catch { /* noop */ }
  };

  const pickerRow = (key: string, label: string) => (
    <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#374151", marginBottom: 6 }}>
      <input
        type="color"
        value={settings[key] || COLOR_DEFAULTS[key] || "#94a3b8"}
        onChange={(e) => update(key, e.target.value)}
        style={{ width: 36, height: 36, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", padding: 2 }}
      />
      <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 4, background: settings[key] || COLOR_DEFAULTS[key], border: "1px solid #e5e7eb" }} />
      <span style={{ minWidth: 100 }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{settings[key] || COLOR_DEFAULTS[key]}</span>
    </label>
  );

  const opacity = parseFloat(settings.zone_opacity || "0.35");
  const opacityHover = parseFloat(settings.zone_opacity_hover || "0.5");

  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Цвета зон</div>
        <button onClick={resetDefaults}
          style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 12, cursor: "pointer", color: "#374151" }}>
          Сбросить по умолчанию
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {COLOR_GROUPS.map((g) => (
          <div key={g.title}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{g.title}</div>
            {g.items.map((it) => pickerRow(it.key, it.label))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Прозрачность</div>
        <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
          Заливка: <strong style={{ color: "#111827" }}>{opacity.toFixed(2)}</strong>
          <input
            type="range" min={0.1} max={0.8} step={0.05}
            value={opacity}
            onChange={(e) => update("zone_opacity", e.target.value)}
            style={{ display: "block", width: 320, marginTop: 4 }}
          />
        </label>
        <label style={{ display: "block", fontSize: 12, color: "#6b7280" }}>
          При наведении: <strong style={{ color: "#111827" }}>{opacityHover.toFixed(2)}</strong>
          <input
            type="range" min={0.2} max={0.9} step={0.05}
            value={opacityHover}
            onChange={(e) => update("zone_opacity_hover", e.target.value)}
            style={{ display: "block", width: 320, marginTop: 4 }}
          />
        </label>
      </div>
    </div>
  );
}
