"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api, ROLE_COOKIE } from "@/lib/api";
import type { Building, Floor, PropertySummary, FloorSummary, PropertyType, PropertyClass, Resource } from "@/lib/types";
import type { FacadeZoneData } from "@/components/FacadeCanvas";
import Cookies from "js-cookie";

const FacadeCanvas = dynamic(() => import("@/components/FacadeCanvas"), {
  ssr: false,
  loading: () => <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading canvas...</div>,
});

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

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  office: "Office",
  meeting_room: "Meeting Room",
  hot_desk: "Hot Desk",
  open_space: "Open Space",
  amenity: "Amenity",
  event_zone: "Event Zone",
  zoom_cabin: "Zoom Cabin",
};

const STATUS_DOT: Record<string, string> = {
  vacant: "#ef4444",
  occupied: "#22c55e",
  reserved: "#eab308",
};

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = Number(params.id);
  const role = Cookies.get(ROLE_COOKIE) || "";

  const [summary, setSummary] = useState<PropertySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null);
  const [floorResources, setFloorResources] = useState<Record<number, Resource[]>>({});
  const [loadingFloorRes, setLoadingFloorRes] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Facade state
  const [facadeZones, setFacadeZones] = useState<FacadeZoneData[]>([]);
  const [facadeImageUrl, setFacadeImageUrl] = useState<string | null>(null);
  const [facadeMode, setFacadeMode] = useState<"view" | "edit">("view");
  const [facadeEditZones, setFacadeEditZones] = useState<FacadeZoneData[]>([]);
  const [savingFacade, setSavingFacade] = useState(false);
  const [uploadingFacade, setUploadingFacade] = useState(false);
  const [allFloors, setAllFloors] = useState<Floor[]>([]);
  const facadeInputRef = useRef<HTMLInputElement>(null);

  function reload() {
    setLoading(true);
    api
      .get<PropertySummary>(`/properties/${propertyId}/summary`)
      .then((r) => setSummary(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function loadFacade() {
    api.get<{ facade_image_url: string | null; zones: FacadeZoneData[] }>(`/properties/${propertyId}/facade-zones`)
      .then((r) => {
        setFacadeImageUrl(r.data.facade_image_url);
        setFacadeZones(r.data.zones);
      })
      .catch(() => {});
    api.get<Floor[]>(`/buildings/${propertyId}/floors`)
      .then((r) => setAllFloors(r.data))
      .catch(() => {});
  }

  useEffect(() => {
    reload();
    loadFacade();
  }, [propertyId]);

  async function toggleFloor(floorId: number) {
    if (expandedFloor === floorId) {
      setExpandedFloor(null);
      return;
    }
    setExpandedFloor(floorId);
    if (!floorResources[floorId]) {
      setLoadingFloorRes(floorId);
      try {
        const r = await api.get<Resource[]>("/resources", { params: { building_id: propertyId, floor_id: floorId } });
        setFloorResources((prev) => ({ ...prev, [floorId]: r.data }));
      } catch { /* ignore */ }
      setLoadingFloorRes(null);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/properties/${propertyId}/photo`, fd);
      reload();
    } catch { /* ignore */ }
    setUploadingPhoto(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/properties/${propertyId}`);
      router.push("/dashboard/properties");
    } catch { /* ignore */ }
    setDeleting(false);
  }

  async function handleFacadeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFacade(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<{ facade_image_url: string }>(`/properties/${propertyId}/facade`, fd);
      setFacadeImageUrl(res.data.facade_image_url);
    } catch { /* ignore */ }
    setUploadingFacade(false);
    if (facadeInputRef.current) facadeInputRef.current.value = "";
  }

  async function handleSaveFacadeZones() {
    setSavingFacade(true);
    try {
      const body = {
        zones: facadeEditZones.map((z) => ({
          floor_id: z.floor_id,
          points: z.points,
          label: z.label || null,
        })),
      };
      await api.put(`/properties/${propertyId}/facade-zones`, body);
      loadFacade();
      setFacadeMode("view");
    } catch { /* ignore */ }
    setSavingFacade(false);
  }

  if (loading || !summary) {
    return <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>Loading...</div>;
  }

  const p = summary.property;
  const t = summary.totals;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const photoSrc = p.photo_url ? (p.photo_url.startsWith("http") ? p.photo_url : `${apiUrl}${p.photo_url}`) : null;
  const typeLabel = TYPE_LABEL[p.property_type || ""] || p.property_type || "";
  const cls = p.property_class || p.building_class || "";
  const clsColor = CLASS_COLOR[cls] || "#9ca3af";
  // Use the backend's area/seats-based vacancy rate, NOT resource count
  const occupancyPct = t.vacancy_rate_m2 != null ? Math.round(100 - t.vacancy_rate_m2) : null;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard/properties")}
        style={{ border: "none", background: "none", color: "#1F69FF", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 16, padding: 0 }}
      >
        &larr; All Properties
      </button>

      {/* A) Property Header */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, background: "white", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb" }}>
        {/* Photo */}
        <div
          style={{ width: 200, height: 150, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg, #0A1730, #1F69FF)", position: "relative", cursor: role === "admin" ? "pointer" : "default" }}
          onClick={() => role === "admin" && photoInputRef.current?.click()}
        >
          {photoSrc ? (
            <img src={photoSrc} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 48, opacity: 0.3 }}>🏢</div>
          )}
          {role === "admin" && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: uploadingPhoto ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0)",
              transition: "background 0.2s", fontSize: 14, color: "white", fontWeight: 500,
            }}
              onMouseEnter={(e) => { if (!uploadingPhoto) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.4)"; }}
              onMouseLeave={(e) => { if (!uploadingPhoto) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0)"; }}
            >
              {uploadingPhoto ? "Uploading..." : "Upload Photo"}
            </div>
          )}
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0A1730", margin: 0 }}>{p.name}</h1>
            {typeLabel && (
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#e0e7ff", color: "#3730a3" }}>
                {typeLabel}
              </span>
            )}
            {cls && (
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: clsColor, color: "#fff" }}>
                {cls}
              </span>
            )}
          </div>

          {p.address && <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>{p.address}</div>}
          {p.owner_name && <div style={{ fontSize: 13, color: "#9ca3af" }}>Owner: {p.owner_name}</div>}
          {p.management_start_date && (
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              Managed since: {new Date(p.management_start_date).toLocaleDateString()}
            </div>
          )}
          {p.description && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>{p.description}</div>}

          {role === "admin" && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setShowEdit(true)}
                style={{ padding: "6px 14px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 13, cursor: "pointer" }}
              >
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ padding: "6px 14px", border: "1px solid #fecaca", borderRadius: 6, background: "white", fontSize: 13, cursor: "pointer", color: "#dc2626" }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* B) Facade Canvas */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A1730", margin: 0 }}>Facade Map</h2>
          {role === "admin" && facadeImageUrl && (
            <div style={{ display: "flex", gap: 8 }}>
              {facadeMode === "view" ? (
                <button
                  onClick={() => { setFacadeMode("edit"); setFacadeEditZones([...facadeZones]); }}
                  style={{ padding: "5px 12px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 12, cursor: "pointer" }}
                >
                  Edit Zones
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSaveFacadeZones}
                    disabled={savingFacade}
                    style={{ padding: "5px 12px", background: savingFacade ? "#93c5fd" : "#1F69FF", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {savingFacade ? "Saving..." : "Save Zones"}
                  </button>
                  <button
                    onClick={() => { setFacadeMode("view"); setFacadeEditZones([]); }}
                    style={{ padding: "5px 12px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 12, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {facadeImageUrl ? (
          <>
            <FacadeCanvas
              facadeImageUrl={facadeImageUrl}
              zones={facadeMode === "edit" ? facadeEditZones : facadeZones}
              mode={facadeMode}
              floors={allFloors}
              onZoneClick={(zone) => router.push(`/dashboard/map?floor=${zone.floor_id}`)}
              onZonesChange={(zones) => setFacadeEditZones(zones)}
            />
            {role === "admin" && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => facadeInputRef.current?.click()}
                  disabled={uploadingFacade}
                  style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: "pointer", color: "#6b7280" }}
                >
                  {uploadingFacade ? "Uploading..." : "Replace facade photo"}
                </button>
                <input ref={facadeInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFacadeUpload} />
              </div>
            )}
          </>
        ) : (
          <div
            onClick={() => role === "admin" && facadeInputRef.current?.click()}
            style={{
              border: "2px dashed #d1d5db",
              borderRadius: 8,
              padding: 40,
              textAlign: "center",
              cursor: role === "admin" ? "pointer" : "default",
              color: "#9ca3af",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
            <div style={{ fontSize: 14 }}>
              {role === "admin" ? "Upload a facade photo to enable zone mapping" : "No facade photo uploaded"}
            </div>
            {uploadingFacade && <div style={{ fontSize: 13, marginTop: 8, color: "#1F69FF" }}>Uploading...</div>}
            <input ref={facadeInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFacadeUpload} />
          </div>
        )}
      </div>

      {/* C) Key Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <MetricCard label="GLA" value={t.gla_m2 ? `${t.gla_m2.toLocaleString()} m2` : "---"} />
        <MetricCard
          label="Occupancy"
          value={occupancyPct != null ? `${occupancyPct}%` : "—"}
          color={occupancyPct != null ? (occupancyPct >= 70 ? "#16a34a" : occupancyPct >= 40 ? "#eab308" : "#ef4444") : "#9ca3af"}
        />
        <MetricCard label="Floors" value={String(t.total_floors)} />
        <MetricCard label="Tenants" value={String(t.total_tenants)} />
      </div>

      {/* C) Stacking Plan */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A1730", margin: 0 }}>Stacking Plan</h2>
        </div>

        {summary.floors.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            No floors configured. Go to Floor Map to add floors.
          </div>
        ) : (
          <div>
            {[...summary.floors].reverse().map((floor) => (
              <FloorRow
                key={floor.id}
                floor={floor}
                propertyId={propertyId}
                expanded={expandedFloor === floor.id}
                onToggle={() => toggleFloor(floor.id)}
                resources={floorResources[floor.id] || null}
                loadingResources={loadingFloorRes === floor.id}
                onNavigate={() => router.push(`/dashboard/map?floor=${floor.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditPropertyModal
          property={p}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); reload(); }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
        >
          <div style={{ background: "white", borderRadius: 12, padding: 24, maxWidth: 400, width: "100%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0A1730", marginBottom: 8 }}>Delete property?</h3>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
              <strong>{p.name}</strong> will be deactivated. All data will be preserved.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: "8px 18px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 14, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ padding: "8px 18px", background: deleting ? "#fca5a5" : "#dc2626", color: "white", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: deleting ? "default" : "pointer" }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "white", borderRadius: 10, padding: "14px 18px", border: "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "#0A1730" }}>{value}</div>
    </div>
  );
}

function FloorRow({
  floor,
  propertyId,
  expanded,
  onToggle,
  resources,
  loadingResources,
  onNavigate,
}: {
  floor: FloorSummary;
  propertyId: number;
  expanded: boolean;
  onToggle: () => void;
  resources: Resource[] | null;
  loadingResources: boolean;
  onNavigate: () => void;
}) {
  // Use backend's area/seats-based vacancy_rate (never resource count)
  const isConfigured = floor.vacancy_rate != null;
  const occupancy = isConfigured ? Math.round(100 - floor.vacancy_rate!) : 0;
  const barColor = !isConfigured ? "#9ca3af" : occupancy >= 70 ? "#22c55e" : occupancy >= 40 ? "#eab308" : "#ef4444";
  const isSeats = floor.vacancy_metric === "seats";
  const total = isSeats ? (floor.total_seats ?? 0) : (floor.total_area_m2 ?? 0);
  const unit = isSeats ? "seats" : "m2";

  return (
    <div style={{ borderBottom: "1px solid #f3f4f6" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60px 1fr 200px 140px 40px 40px",
          alignItems: "center",
          padding: "12px 16px",
          cursor: "pointer",
          transition: "background 0.1s",
        }}
        onClick={onToggle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
      >
        {/* Floor number badge */}
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: "#0A1730",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
        }}>
          {floor.number}F
        </div>

        {/* Floor name */}
        <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
          {floor.name || `Floor ${floor.number}`}
        </div>

        {/* Progress bar */}
        <div>
          {isConfigured ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${occupancy}%`, height: "100%", background: barColor, borderRadius: 4, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: barColor, minWidth: 36, textAlign: "right" }}>{occupancy}%</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "#d1d5db" }}>Configure floor GLA</span>
          )}
        </div>

        {/* Capacity label */}
        <div style={{ fontSize: 13, color: "#6b7280", textAlign: "right" }}>
          {isConfigured ? `${floor.occupied_resources}/${floor.total_resources} res` : ""}
          {total > 0 && <span style={{ marginLeft: 6, color: "#9ca3af" }}>({total} {unit})</span>}
        </div>

        {/* Navigate to map */}
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          title="Open floor map"
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, padding: 4 }}
        >
          🗺️
        </button>

        {/* Expand arrow */}
        <div style={{ fontSize: 14, color: "#9ca3af", textAlign: "center", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "" }}>
          ▼
        </div>
      </div>

      {/* Expanded: resources table */}
      {expanded && (
        <div style={{ padding: "0 16px 16px 76px", background: "#fafbfc" }}>
          {loadingResources ? (
            <div style={{ padding: 12, fontSize: 13, color: "#9ca3af" }}>Loading resources...</div>
          ) : !resources || resources.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: "#9ca3af" }}>No resources on this floor.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "#9ca3af", fontWeight: 500 }}>Name</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "#9ca3af", fontWeight: 500 }}>Type</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "#9ca3af", fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "#9ca3af", fontWeight: 500 }}>Tenant</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "#9ca3af", fontWeight: 500 }}>Area</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 500, color: "#111827" }}>{r.name}</td>
                    <td style={{ padding: "6px 8px", color: "#6b7280" }}>{RESOURCE_TYPE_LABEL[r.resource_type] || r.resource_type}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_DOT[r.status] || "#9ca3af" }} />
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px", color: "#6b7280" }}>{r.tenant_name || "---"}</td>
                    <td style={{ padding: "6px 8px", color: "#6b7280", textAlign: "right" }}>{r.area_m2 ? `${r.area_m2} m2` : "---"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Edit Property Modal ────────────────────────────────────────────── */

function EditPropertyModal({
  property: p,
  onClose,
  onSaved,
}: {
  property: Building;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: p.name || "",
    address: p.address || "",
    property_type: (p.property_type || "office") as PropertyType,
    property_class: (p.property_class || p.building_class || "B") as PropertyClass,
    city: p.city || "",
    gba_m2: p.gba_m2 != null ? String(p.gba_m2) : "",
    gla_m2: p.gla_m2 != null ? String(p.gla_m2) : "",
    rentable_area_m2: p.rentable_area_m2 != null ? String(p.rentable_area_m2) : "",
    floors_count: p.floors_count != null ? String(p.floors_count) : "",
    year_built: p.year_built != null ? String(p.year_built) : "",
    parking_spaces: p.parking_spaces != null ? String(p.parking_spaces) : "",
    owner_name: p.owner_name || "",
    description: p.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        address: form.address.trim(),
        property_type: form.property_type,
        property_class: form.property_class,
        building_class: form.property_class,
        city: form.city.trim(),
        owner_name: form.owner_name.trim() || null,
        description: form.description.trim() || null,
      };
      if (form.gba_m2) body.gba_m2 = parseFloat(form.gba_m2);
      if (form.gla_m2) body.gla_m2 = parseFloat(form.gla_m2);
      if (form.rentable_area_m2) body.rentable_area_m2 = parseFloat(form.rentable_area_m2);
      if (form.floors_count) body.floors_count = parseInt(form.floors_count);
      if (form.year_built) body.year_built = parseInt(form.year_built);
      if (form.parking_spaces) body.parking_spaces = parseInt(form.parking_spaces);

      await api.patch(`/properties/${p.id}`, body);
      onSaved();
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to save");
    } finally {
      setSaving(false);
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
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 520, padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0A1730", marginBottom: 20 }}>Edit Property</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Property Type</label>
              <select style={{ ...inputStyle, background: "white" }} value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value as PropertyType })}>
                {TYPE_VALUES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Class</label>
              <select style={{ ...inputStyle, background: "white" }} value={form.property_class} onChange={(e) => setForm({ ...form, property_class: e.target.value as PropertyClass })}>
                {CLASS_VALUES.map((c) => <option key={c} value={c}>{c}</option>)}
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
              <label style={labelStyle}>Rentable m2</label>
              <input style={inputStyle} type="number" value={form.rentable_area_m2} onChange={(e) => setForm({ ...form, rentable_area_m2: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Floors</label>
              <input style={inputStyle} type="number" value={form.floors_count} onChange={(e) => setForm({ ...form, floors_count: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Parking</label>
              <input style={inputStyle} type="number" value={form.parking_spaces} onChange={(e) => setForm({ ...form, parking_spaces: e.target.value })} />
            </div>
            <div />
          </div>
          <div>
            <label style={labelStyle}>Owner</label>
            <input style={inputStyle} value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#991b1b", fontSize: 13 }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: "8px 18px", background: saving ? "#93c5fd" : "#1F69FF", color: "white", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
