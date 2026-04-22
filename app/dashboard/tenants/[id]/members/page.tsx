"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Member {
  id: number;
  tenant_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  salto_user_id: string | null;
  is_active: boolean;
  created_at: string;
}

export default function TenantMembersPage() {
  const params = useParams();
  const tenantId = params.id as string;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  // Add form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [createInSalto, setCreateInSalto] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [tenantId]);

  async function loadMembers() {
    setLoading(true);
    try {
      const res = await api.get<Member[]>(`/tenants/${tenantId}/members`);
      setMembers(res.data);
    } catch {
      setError("Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/tenants/${tenantId}/members`, {
        name: newName.trim(),
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
        create_in_salto: createInSalto,
      });
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setCreateInSalto(true);
      setShowAdd(false);
      await loadMembers();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Failed to add member");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(memberId: number) {
    if (!confirm("Remove this member?")) return;
    try {
      await api.delete(`/tenants/${tenantId}/members/${memberId}`);
      await loadMembers();
    } catch {
      setError("Failed to remove member");
    }
  }

  const inputStyle: React.CSSProperties = {
    display: "block", width: "100%", marginTop: 4, padding: "8px 10px",
    border: "1px solid var(--color-gray-300)", borderRadius: 6, fontSize: 14, boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)", display: "block", marginBottom: 12,
  };

  return (
    <div className="p-6">
      <div style={{ marginBottom: 8 }}>
        <a href="/dashboard/tenants" style={{ fontSize: 13, color: "#003DA5", textDecoration: "none" }}>
          &larr; Back to Tenants
        </a>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="text-2xl font-semibold text-gray-900">Tenant Members</h1>
        <button
          onClick={() => setShowAdd(true)}
          style={{ padding: "8px 16px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer", fontWeight: 500 }}
        >
          + Add Member
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", border: "none", background: "none", color: "#dc2626", cursor: "pointer" }}>x</button>
        </div>
      )}

      {loading ? (
        <div style={{ color: "var(--color-gray-400)", fontSize: 14 }}>Loading...</div>
      ) : members.length === 0 ? (
        <div className="text-sm text-gray-500 p-8 border border-dashed border-gray-300 rounded-md">
          No members found for this tenant.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Salto Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Active</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-gray-500">{m.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{m.phone || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {m.salto_user_id ? (
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: "#d1fae5", color: "#065f46" }}>
                        Linked
                      </span>
                    ) : (
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: "#fef3c7", color: "#92400e" }}>
                        Not linked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.is_active ? (
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: "#d1fae5", color: "#065f46" }}>YES</span>
                    ) : (
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: "var(--color-gray-100)", color: "var(--color-gray-500)" }}>NO</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleRemove(m.id)}
                      style={{ padding: "4px 10px", border: "1px solid #fca5a5", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#dc2626" }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Member Modal */}
      {showAdd && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
          onMouseDown={() => setShowAdd(false)}
        >
          <div
            style={{ background: "white", borderRadius: 12, padding: 28, width: 440, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Add Member</h2>
              <button onClick={() => setShowAdd(false)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#666" }}>x</button>
            </div>

            <label style={labelStyle}>
              Name *
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Email
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="member@company.com" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Phone
              <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+998 ..." style={inputStyle} />
            </label>

            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-gray-700)", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input type="checkbox" checked={createInSalto} onChange={(e) => setCreateInSalto(e.target.checked)} />
              Create in Salto KS automatically
            </label>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: "8px 16px", border: "1px solid var(--color-gray-300)", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={handleAdd} disabled={saving || !newName.trim()}
                style={{ padding: "8px 16px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, opacity: saving || !newName.trim() ? 0.5 : 1 }}>
                {saving ? "Adding..." : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
