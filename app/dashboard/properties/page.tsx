"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ROLE_COOKIE } from "@/lib/api";
import type { Building, PropertyType, PropertyClass } from "@/lib/types";
import Cookies from "js-cookie";

const TYPE_LABEL: Record<string, string> = {
  office: "Business Center",
  retail: "Retail",
  warehouse: "Warehouse",
  industrial: "Industrial",
  mixed_use: "Mixed-use",
  residential: "Residential",
};

const CLASS_COLOR: Record<string, string> = {
  "A+": "#16a34a",
  A: "#22c55e",
  "B+": "#eab308",
  B: "#facc15",
  C: "#9ca3af",
};

const TYPE_VALUES: { value: PropertyType; label: string }[] = [
  { value: "office", label: "Business Center" },
  { value: "retail", label: "Retail" },
  { value: "warehouse", label: "Warehouse" },
  { value: "industrial", label: "Industrial" },
  { value: "mixed_use", label: "Mixed-use" },
  { value: "residential", label: "Residential" },
];

const CLASS_VALUES: PropertyClass[] = ["A+", "A", "B+", "B", "C"];

interface CreateForm {
  name: string;
  property_type: PropertyType;
  property_class: PropertyClass;
  address: string;
  city: string;
  gba_m2: string;
  gla_m2: string;
  floors_count: string;
  year_built: string;
  parking_spaces: string;
  owner_name: string;
  description: string;
}

const EMPTY_FORM: CreateForm = {
  name: "",
  property_type: "office",
  property_class: "B",
  address: "",
  city: "Tashkent",
  gba_m2: "",
  gla_m2: "",
  floors_count: "",
  year_built: "",
  parking_spaces: "",
  owner_name: "",
  description: "",
};

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const role = Cookies.get(ROLE_COOKIE) || "";

  useEffect(() => {
    api
      .get<Building[]>("/properties/", { params: { is_active: true } })
      .then((r) => setProperties(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        property_type: form.property_type,
        property_class: form.property_class,
        address: form.address.trim(),
        city: form.city.trim() || "Tashkent",
        building_class: form.property_class,
        total_area: 0,
        leasable_area: 0,
      };
      if (form.gba_m2) body.gba_m2 = parseFloat(form.gba_m2);
      if (form.gla_m2) body.gla_m2 = parseFloat(form.gla_m2);
      if (form.floors_count) body.floors_count = parseInt(form.floors_count);
      if (form.year_built) body.year_built = parseInt(form.year_built);
      if (form.parking_spaces) body.parking_spaces = parseInt(form.parking_spaces);
      if (form.owner_name) body.owner_name = form.owner_name.trim();
      if (form.description) body.description = form.description.trim();

      const res = await api.post<Building>("/properties/", body);
      router.push(`/dashboard/properties/${res.data.id}`);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to create property");
    } finally {
      setCreating(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "#6b7280",
    marginBottom: 4,
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0A1730" }}>Properties</h1>
        {role === "admin" && (
          <button
            onClick={() => { setForm({ ...EMPTY_FORM }); setShowCreate(true); setError(""); }}
            style={{
              padding: "10px 20px",
              background: "#1F69FF",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Create Property
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Loading...</div>
      ) : properties.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
          No properties found. Create your first property to get started.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340, 1fr))", gap: 20 }}>
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} onClick={() => router.push(`/dashboard/properties/${p.id}`)} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 520, padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0A1730", marginBottom: 20 }}>Create Property</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Business Center Modera"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Property Type</label>
                  <select
                    style={{ ...inputStyle, background: "white" }}
                    value={form.property_type}
                    onChange={(e) => setForm({ ...form, property_type: e.target.value as PropertyType })}
                  >
                    {TYPE_VALUES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Class</label>
                  <select
                    style={{ ...inputStyle, background: "white" }}
                    value={form.property_class}
                    onChange={(e) => setForm({ ...form, property_class: e.target.value as PropertyClass })}
                  >
                    {CLASS_VALUES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Year Built</label>
                  <input style={inputStyle} type="number" value={form.year_built} onChange={(e) => setForm({ ...form, year_built: e.target.value })} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>GBA m2</label>
                  <input style={inputStyle} type="number" value={form.gba_m2} onChange={(e) => setForm({ ...form, gba_m2: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>GLA m2</label>
                  <input style={inputStyle} type="number" value={form.gla_m2} onChange={(e) => setForm({ ...form, gla_m2: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Floors</label>
                  <input style={inputStyle} type="number" value={form.floors_count} onChange={(e) => setForm({ ...form, floors_count: e.target.value })} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Parking Spaces</label>
                  <input style={inputStyle} type="number" value={form.parking_spaces} onChange={(e) => setForm({ ...form, parking_spaces: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Owner</label>
                  <input style={inputStyle} value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#991b1b", fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{ padding: "8px 18px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 14, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.name.trim()}
                style={{
                  padding: "8px 18px",
                  background: creating || !form.name.trim() ? "#93c5fd" : "#1F69FF",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: creating ? "default" : "pointer",
                }}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyCard({ property: p, onClick }: { property: Building; onClick: () => void }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const photoSrc = p.photo_url
    ? p.photo_url.startsWith("http") ? p.photo_url : `${apiUrl}${p.photo_url}`
    : null;

  const typeLabel = TYPE_LABEL[p.property_type || ""] || p.property_type || "";
  const cls = p.property_class || p.building_class || "";
  const clsColor = CLASS_COLOR[cls] || "#9ca3af";

  return (
    <div
      onClick={onClick}
      style={{
        background: "#DAE1E8",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
        transition: "box-shadow 0.2s, transform 0.15s",
        border: "1px solid #c8d1db",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(10,23,48,0.15)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      {/* Photo / placeholder */}
      <div style={{ height: 160, background: "linear-gradient(135deg, #0A1730 0%, #1F69FF 100%)", position: "relative", overflow: "hidden" }}>
        {photoSrc ? (
          <img src={photoSrc} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 48, opacity: 0.3 }}>
            🏢
          </div>
        )}
        {/* Badges */}
        <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 6 }}>
          {typeLabel && (
            <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "rgba(0,0,0,0.6)", color: "white" }}>
              {typeLabel}
            </span>
          )}
          {cls && (
            <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: clsColor, color: "#fff" }}>
              Class {cls}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#0A1730", marginBottom: 4 }}>{p.name}</div>
        {p.address && (
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>{p.address}</div>
        )}

        {/* Metrics */}
        <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
          {(p.gla_m2 != null && p.gla_m2 > 0) && (
            <div>
              <span style={{ fontWeight: 600, color: "#0A1730" }}>{p.gla_m2.toLocaleString()}</span>
              <span style={{ color: "#9ca3af", marginLeft: 3 }}>m2 GLA</span>
            </div>
          )}
          {(p.floors_count != null && p.floors_count > 0) && (
            <div>
              <span style={{ fontWeight: 600, color: "#0A1730" }}>{p.floors_count}</span>
              <span style={{ color: "#9ca3af", marginLeft: 3 }}>floors</span>
            </div>
          )}
        </div>

        <button
          style={{
            marginTop: 12,
            width: "100%",
            padding: "8px 0",
            background: "#1F69FF",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Open
        </button>
      </div>
    </div>
  );
}
