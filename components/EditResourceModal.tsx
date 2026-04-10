"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Resource } from "@/lib/types";

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
