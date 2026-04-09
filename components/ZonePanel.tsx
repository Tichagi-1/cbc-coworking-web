"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Unit, UnitStatus, UnitType, UserRole } from "@/lib/types";

export interface UnitPatchPayload {
  name?: string;
  area_m2?: number;
  seats?: number;
  monthly_rate?: number;
  status?: UnitStatus;
  tenant_name?: string | null;
}

interface ZonePanelProps {
  unit: Unit | null;
  open: boolean;
  role?: UserRole;
  loading?: boolean;
  saving?: boolean;
  onClose: () => void;
  /** Patch the unit on the server, then resolve with the fresh unit. */
  onSave?: (id: number, patch: UnitPatchPayload) => Promise<Unit | null>;
}

const STATUS_PILL: Record<UnitStatus, string> = {
  occupied: "bg-green-100 text-green-800 border-green-200",
  vacant: "bg-red-100 text-red-800 border-red-200",
  reserved: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const TYPE_LABEL: Record<UnitType, string> = {
  office: "Office",
  meeting_room: "Meeting Room",
  hot_desk: "Hot Desk",
  open_space: "Open Space",
};

export default function ZonePanel({
  unit,
  open,
  role,
  loading = false,
  saving = false,
  onClose,
  onSave,
}: ZonePanelProps) {
  const canEdit = role === "admin" || role === "manager";

  const [editing, setEditing] = useState(false);

  // Edit form state
  const [name, setName] = useState("");
  const [area, setArea] = useState("0");
  const [seats, setSeats] = useState("1");
  const [rate, setRate] = useState("0");
  const [status, setStatus] = useState<UnitStatus>("vacant");
  const [tenantName, setTenantName] = useState("");

  // Reset edit state whenever the unit being shown changes or the panel closes
  useEffect(() => {
    if (unit) {
      setName(unit.name);
      setArea(String(unit.area_m2));
      setSeats(String(unit.seats));
      setRate(String(unit.monthly_rate));
      setStatus(unit.status);
      setTenantName(unit.tenant_name ?? "");
    }
    setEditing(false);
  }, [unit?.id]);

  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!unit || !onSave) return;

    const patch: UnitPatchPayload = {
      name: name.trim(),
      area_m2: parseFloat(area) || 0,
      seats: parseInt(seats, 10) || 1,
      monthly_rate: parseFloat(rate) || 0,
      status,
      tenant_name: tenantName.trim() || null,
    };

    const updated = await onSave(unit.id, patch);
    if (updated) {
      setEditing(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-40 transform transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200">
          <div className="min-w-0 flex-1 pr-4">
            {unit ? (
              <>
                <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 rounded">
                  {TYPE_LABEL[unit.unit_type]}
                </span>
                <h3 className="text-xl font-semibold text-gray-900 mt-1.5 truncate">
                  {unit.name}
                </h3>
              </>
            ) : (
              <h3 className="text-xl font-semibold text-gray-900">
                {loading ? "Loading…" : "Unit"}
              </h3>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none flex-shrink-0"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-auto">
          {!unit && loading && (
            <div className="text-sm text-gray-500">Fetching unit details…</div>
          )}

          {unit && !editing && (
            <div className="space-y-5">
              <div>
                <span
                  className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${
                    STATUS_PILL[unit.status]
                  }`}
                >
                  {unit.status.toUpperCase()}
                </span>
              </div>

              {unit.status === "occupied" && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Tenant
                  </div>
                  <div className="text-sm text-gray-900 font-medium">
                    {unit.tenant_name || (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <dt className="text-gray-500">Area</dt>
                <dd className="text-gray-900 font-medium">{unit.area_m2} m²</dd>

                <dt className="text-gray-500">Seats</dt>
                <dd className="text-gray-900 font-medium">{unit.seats}</dd>

                <dt className="text-gray-500">Rate</dt>
                <dd className="text-gray-900 font-medium">
                  ${unit.monthly_rate.toLocaleString()}
                  {unit.rate_period && unit.rate_period !== "month" && (
                    <span className="text-gray-500"> / {unit.rate_period}</span>
                  )}
                  {(!unit.rate_period || unit.rate_period === "month") && (
                    <span className="text-gray-500"> / month</span>
                  )}
                </dd>
              </dl>

              {unit.description && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Description
                  </div>
                  <p className="text-sm text-gray-700">{unit.description}</p>
                </div>
              )}

              {unit.status === "occupied" && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                    Active Lease
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <span className="font-medium text-green-800">
                        Currently leased
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly rate</span>
                      <span className="font-medium text-gray-900">
                        ${unit.monthly_rate.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 pt-1">
                      Lease detail endpoint coming soon.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {unit && editing && (
            <form id="zone-edit-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UnitStatus)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none bg-white"
                >
                  <option value="vacant">vacant</option>
                  <option value="occupied">occupied</option>
                  <option value="reserved">reserved</option>
                </select>
              </div>

              {status === "occupied" && (
                <div>
                  <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Tenant
                  </label>
                  <input
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Tenant company or person"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Future: synced from Zoho Contracts.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Area m²
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={seats}
                    onChange={(e) => setSeats(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Rate
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:border-cbc-blue focus:ring-1 focus:ring-cbc-blue outline-none"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {unit && canEdit && (
          <div className="p-5 border-t border-gray-200 flex gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex-1 rounded-md bg-cbc-blue hover:bg-cbc-bright-blue text-white font-medium py-2 transition"
              >
                Edit Unit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="flex-1 rounded-md border border-gray-300 text-gray-700 font-medium py-2 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="zone-edit-form"
                  disabled={saving}
                  className="flex-1 rounded-md bg-cbc-blue hover:bg-cbc-bright-blue text-white font-medium py-2 transition disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
