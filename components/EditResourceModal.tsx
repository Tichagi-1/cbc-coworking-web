"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Resource } from "@/lib/types";

interface LockData {
  id: number;
  resource_id: number;
  salto_device_id: string;
  lock_name: string;
}

interface SaltoDevice {
  id: string;
  name: string;
}

interface Props {
  resource: Resource;
  onSave: (updated: Resource) => void;
  onClose: () => void;
}

export default function EditResourceModal({ resource, onSave, onClose }: Props) {
  const [name, setName] = useState(resource.name);
  const [status, setStatus] = useState<string>(resource.status || "vacant");
  const [tenantName, setTenantName] = useState(resource.tenant_name || "");
  const [areaM2, setAreaM2] = useState(resource.area_m2 || 0);
  const [seats, setSeats] = useState(resource.seats || 0);
  const [monthlyRate, setMonthlyRate] = useState(resource.monthly_rate || 0);
  const [capacity, setCapacity] = useState(resource.capacity || 0);
  const [coinsHr, setCoinsHr] = useState(resource.rate_coins_per_hour || 0);
  const [moneyHr, setMoneyHr] = useState(resource.rate_money_per_hour || 0);
  const [minAdvance, setMinAdvance] = useState(
    resource.min_advance_minutes || 0
  );
  const [residentDiscount, setResidentDiscount] = useState(
    resource.resident_discount_pct || 0
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Photos
  const [photos, setPhotos] = useState<string[]>(resource.photos || []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Salto lock state
  const [lock, setLock] = useState<LockData | null>(null);
  const [saltoDevices, setSaltoDevices] = useState<SaltoDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [lockName, setLockName] = useState("");
  const [lockSaving, setLockSaving] = useState(false);
  const [lockError, setLockError] = useState("");

  useEffect(() => {
    if (resource.resource_type === "meeting_room") {
      api.get<LockData>(`/resources/${resource.id}/lock`).then((r) => setLock(r.data)).catch(() => {});
      api.get<SaltoDevice[]>("/salto/devices").then((r) => setSaltoDevices(r.data)).catch(() => {});
    }
  }, [resource.id, resource.resource_type]);

  async function handleSaveLock() {
    if (!selectedDeviceId) return;
    setLockSaving(true);
    setLockError("");
    try {
      const res = await api.put<LockData>(`/resources/${resource.id}/lock`, {
        salto_device_id: selectedDeviceId,
        lock_name: lockName.trim() || selectedDeviceId,
      });
      setLock(res.data);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setLockError(detail || "Failed to link lock");
    } finally {
      setLockSaving(false);
    }
  }

  async function handleRemoveLock() {
    if (!confirm("Remove Salto lock from this resource?")) return;
    setLockSaving(true);
    setLockError("");
    try {
      await api.delete(`/resources/${resource.id}/lock`);
      setLock(null);
    } catch {
      setLockError("Failed to remove lock");
    } finally {
      setLockSaving(false);
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 5) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<{ photos: string[] }>(
        `/resources/${resource.id}/photos`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setPhotos(res.data.photos || []);
    } catch {
      setError("Photo upload failed");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    try {
      const res = await api.delete<{ photos: string[] }>(
        `/resources/${resource.id}/photos`,
        { data: { url: photoUrl } }
      );
      setPhotos(res.data.photos || []);
    } catch {
      setError("Failed to delete photo");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { name, status };
      if (status === "occupied") payload.tenant_name = tenantName;
      if (
        resource.resource_type === "office" ||
        resource.resource_type === "hot_desk" ||
        resource.resource_type === "open_space"
      ) {
        payload.area_m2 = areaM2;
        payload.seats = seats;
        payload.monthly_rate = monthlyRate;
      }
      if (resource.resource_type === "meeting_room") {
        payload.capacity = capacity;
        payload.rate_coins_per_hour = coinsHr;
        payload.rate_money_per_hour = moneyHr;
      }
      payload.min_advance_minutes = minAdvance;
      payload.resident_discount_pct = residentDiscount;
      const res = await api.patch<Resource>(
        `/resources/${resource.id}`,
        payload
      );
      onSave(res.data);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: 4,
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
  };

  return (
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
      onMouseDown={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 28,
          width: 480,
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            Edit Resource
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#666",
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#dc2626",
              padding: "8px 12px",
              borderRadius: 6,
              marginBottom: 12,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={labelStyle}>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={inputStyle}
            >
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
            </select>
          </label>

          {status === "occupied" && (
            <label style={labelStyle}>
              Tenant Name
              <input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                style={inputStyle}
              />
            </label>
          )}

          {(resource.resource_type === "office" ||
            resource.resource_type === "hot_desk" ||
            resource.resource_type === "open_space") && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <label style={labelStyle}>
                  Area m²
                  <input
                    type="number"
                    value={areaM2}
                    onChange={(e) => setAreaM2(+e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Seats
                  <input
                    type="number"
                    value={seats}
                    onChange={(e) => setSeats(+e.target.value)}
                    style={inputStyle}
                  />
                </label>
              </div>
              <label style={labelStyle}>
                Monthly Rate
                <input
                  type="number"
                  value={monthlyRate}
                  onChange={(e) => setMonthlyRate(+e.target.value)}
                  style={inputStyle}
                />
              </label>
            </>
          )}

          {resource.resource_type === "meeting_room" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <label style={labelStyle}>
                  Capacity
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(+e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Coins/hr
                  <input
                    type="number"
                    value={coinsHr}
                    onChange={(e) => setCoinsHr(+e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  $/hr
                  <input
                    type="number"
                    value={moneyHr}
                    onChange={(e) => setMoneyHr(+e.target.value)}
                    style={inputStyle}
                  />
                </label>
              </div>
            </>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <label style={labelStyle}>
              Min advance (min)
              <input
                type="number"
                value={minAdvance}
                onChange={(e) => setMinAdvance(+e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Resident discount %
              <input
                type="number"
                min={0}
                max={100}
                value={residentDiscount}
                onChange={(e) => setResidentDiscount(+e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        {/* Access Control — Salto lock (meeting rooms only) */}
        {resource.resource_type === "meeting_room" && (
          <div style={{ marginTop: 20, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Access Control</div>
            {lockError && (
              <div style={{ background: "#fee2e2", color: "#dc2626", padding: "6px 10px", borderRadius: 6, marginBottom: 10, fontSize: 12 }}>{lockError}</div>
            )}
            {lock ? (
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#065f46" }}>Salto lock configured</div>
                  <div style={{ fontSize: 12, color: "#047857" }}>Device: {lock.lock_name} ({lock.salto_device_id})</div>
                </div>
                <button onClick={handleRemoveLock} disabled={lockSaving}
                  style={{ padding: "4px 10px", border: "1px solid #fca5a5", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 12, color: "#dc2626", opacity: lockSaving ? 0.5 : 1 }}>
                  Remove
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={labelStyle}>
                  Salto Device
                  <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)} style={inputStyle}>
                    <option value="">-- Select device --</option>
                    {saltoDevices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
                  </select>
                </label>
                <label style={labelStyle}>
                  Lock Name
                  <input value={lockName} onChange={(e) => setLockName(e.target.value)} placeholder="e.g. Meeting Room A lock" style={inputStyle} />
                </label>
                <button onClick={handleSaveLock} disabled={lockSaving || !selectedDeviceId}
                  style={{ alignSelf: "flex-start", padding: "6px 14px", background: "#003DA5", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, opacity: lockSaving || !selectedDeviceId ? 0.5 : 1 }}>
                  {lockSaving ? "Linking..." : "Link Lock"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Photos */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 8 }}>
            Photos ({photos.length}/5)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
            {Array.from({ length: 5 }).map((_, i) => {
              const photo = photos[i];
              const fullUrl = photo
                ? photo.startsWith("http") ? photo : `${process.env.NEXT_PUBLIC_API_URL || ""}${photo}`
                : null;
              return (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1", borderRadius: 6, overflow: "hidden",
                    border: fullUrl ? "1px solid #e5e7eb" : "2px dashed #d1d5db",
                    background: fullUrl ? "transparent" : "#f9fafb",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: fullUrl ? "default" : photos.length < 5 ? "pointer" : "not-allowed",
                    position: "relative",
                  }}
                  onClick={() => !fullUrl && photos.length < 5 && fileInputRef.current?.click()}
                >
                  {fullUrl ? (
                    <>
                      <img src={fullUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo); }}
                        style={{
                          position: "absolute", top: 3, right: 3,
                          background: "rgba(0,0,0,0.65)", color: "white",
                          border: "none", borderRadius: "50%", width: 20, height: 20,
                          cursor: "pointer", fontSize: 12, display: "flex",
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 22, color: "#d1d5db" }}>
                      {uploadingPhoto && i === photos.length ? "..." : "+"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handlePhotoUpload} />
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "6px 0 0" }}>Click empty slot to upload. JPG/PNG/WebP, max 5MB each.</p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 24,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
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
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 18px",
              border: "none",
              borderRadius: 6,
              background: "#003DA5",
              color: "white",
              cursor: "pointer",
              fontSize: 14,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
