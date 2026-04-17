"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type {
  Resource,
  ResourceType,
  UnitStatus,
  UserRole,
} from "@/lib/types";

export interface ResourcePatchPayload {
  name?: string;
  area_m2?: number;
  seats?: number;
  monthly_rate?: number;
  capacity?: number;
  rate_coins_per_hour?: number;
  rate_money_per_hour?: number;
  status?: UnitStatus;
  tenant_id?: number | null;
  tenant_name?: string | null;
}

interface ZonePanelProps {
  resource: Resource | null;
  open: boolean;
  role?: UserRole;
  loading?: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave?: (
    id: number,
    patch: ResourcePatchPayload
  ) => Promise<Resource | null>;
}

const STATUS_PILL: Record<UnitStatus, string> = {
  occupied: "bg-green-100 text-green-800 border-green-200",
  vacant: "bg-red-100 text-red-800 border-red-200",
  reserved: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const TYPE_LABEL: Record<ResourceType, string> = {
  office: "Office",
  meeting_room: "Meeting Room",
  hot_desk: "Hot Desk",
  open_space: "Open Space",
  amenity: "Amenity",
  event_zone: "Event Zone",
  zoom_cabin: "Zoom Cabin",
};

export default function ZonePanel({
  resource,
  open,
  role,
  loading = false,
  saving = false,
  onClose,
  onSave,
}: ZonePanelProps) {
  const canEdit = role === "admin" || role === "manager";

  const [editing, setEditing] = useState(false);

  // Common
  const [name, setName] = useState("");
  const [status, setStatus] = useState<UnitStatus>("vacant");
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [tenants, setTenants] = useState<{ id: number; company_name: string }[]>([]);

  // Office / hot_desk / open_space
  const [area, setArea] = useState("0");
  const [seats, setSeats] = useState("1");
  const [rate, setRate] = useState("0");

  // Meeting room
  const [capacity, setCapacity] = useState("0");
  const [coinsHr, setCoinsHr] = useState("0");
  const [moneyHr, setMoneyHr] = useState("0");

  useEffect(() => {
    if (resource) {
      setName(resource.name);
      setStatus(resource.status);
      setTenantId(resource.tenant_id ?? null);
      setTenantName(resource.tenant_name ?? "");
      api.get<{ id: number; company_name: string }[]>("/tenants/").then((r) => setTenants(r.data)).catch(() => {});
      setArea(String(resource.area_m2 ?? 0));
      setSeats(String(resource.seats ?? 1));
      setRate(String(resource.monthly_rate ?? 0));
      setCapacity(String(resource.capacity ?? 0));
      setCoinsHr(String(resource.rate_coins_per_hour ?? 0));
      setMoneyHr(String(resource.rate_money_per_hour ?? 0));
    }
    setEditing(false);
  }, [resource?.id]);

  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  // Office requires tenant when occupied or reserved
  const isOfficeType = resource?.resource_type === "office" || resource?.resource_type === "open_space" || resource?.resource_type === "hot_desk";
  const tenantRequired = isOfficeType && (status === "occupied" || status === "reserved") && !tenantId;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!resource || !onSave) return;
    if (tenantRequired) return;

    const patch: ResourcePatchPayload = {
      name: name.trim(),
      status,
      tenant_id: status === "vacant" ? null : tenantId,
      tenant_name: status === "vacant" ? null : (tenantName.trim() || null),
    };

    if (
      resource.resource_type === "office" ||
      resource.resource_type === "hot_desk" ||
      resource.resource_type === "open_space"
    ) {
      patch.area_m2 = parseFloat(area) || 0;
      patch.seats = parseInt(seats, 10) || 1;
      patch.monthly_rate = parseFloat(rate) || 0;
    } else if (["meeting_room", "zoom_cabin", "event_zone"].includes(resource.resource_type)) {
      patch.capacity = parseInt(capacity, 10) || 0;
      patch.rate_coins_per_hour = parseFloat(coinsHr) || 0;
      patch.rate_money_per_hour = parseFloat(moneyHr) || 0;
    }

    const updated = await onSave(resource.id, patch);
    if (updated) setEditing(false);
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-40 transform transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200">
          <div className="min-w-0 flex-1 pr-4">
            {resource ? (
              <>
                <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 rounded">
                  {TYPE_LABEL[resource.resource_type]}
                </span>
                <h3 className="text-xl font-semibold text-gray-900 mt-1.5 truncate">
                  {resource.name}
                </h3>
              </>
            ) : (
              <h3 className="text-xl font-semibold text-gray-900">
                {loading ? "Loading…" : "Resource"}
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
          {!resource && loading && (
            <div className="text-sm text-gray-500">Fetching resource…</div>
          )}

          {resource && !editing && (
            <div className="space-y-5">
              <div>
                <span
                  className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${
                    STATUS_PILL[resource.status]
                  }`}
                >
                  {resource.status.toUpperCase()}
                </span>
              </div>

              {resource.status === "occupied" && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Tenant
                  </div>
                  <div className="text-sm text-gray-900 font-medium">
                    {resource.tenant_name || (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                {resource.area_m2 != null && (
                  <>
                    <dt className="text-gray-500">Area</dt>
                    <dd className="text-gray-900 font-medium">
                      {resource.area_m2} m²
                    </dd>
                  </>
                )}
                {resource.seats != null && (
                  <>
                    <dt className="text-gray-500">Seats</dt>
                    <dd className="text-gray-900 font-medium">
                      {resource.seats}
                    </dd>
                  </>
                )}
                {resource.capacity != null && (
                  <>
                    <dt className="text-gray-500">Capacity</dt>
                    <dd className="text-gray-900 font-medium">
                      {resource.capacity}
                    </dd>
                  </>
                )}
                {resource.monthly_rate != null && (
                  <>
                    <dt className="text-gray-500">Rate</dt>
                    <dd className="text-gray-900 font-medium">
                      ${resource.monthly_rate.toLocaleString()}{" "}
                      <span className="text-gray-500">
                        / {resource.rate_period ?? "month"}
                      </span>
                    </dd>
                  </>
                )}
                {resource.rate_coins_per_hour != null &&
                  ["meeting_room", "zoom_cabin", "event_zone"].includes(resource.resource_type) && (
                    <>
                      <dt className="text-gray-500">Rate / hr</dt>
                      <dd className="text-gray-900 font-medium">
                        {resource.rate_coins_per_hour} coins / $
                        {resource.rate_money_per_hour ?? 0} per hr
                      </dd>
                    </>
                  )}
              </dl>

              {resource.description && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Description
                  </div>
                  <p className="text-sm text-gray-700">{resource.description}</p>
                </div>
              )}

              <div className="pt-2">
                <Link
                  href="/dashboard/resources"
                  className="text-xs text-cbc-blue hover:underline"
                >
                  View in catalog →
                </Link>
              </div>
            </div>
          )}

          {resource && editing && (
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
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UnitStatus)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="vacant">vacant</option>
                  <option value="occupied">occupied</option>
                  <option value="reserved">reserved</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Tenant {tenantRequired && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={tenantId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    setTenantId(id);
                    if (id) {
                      const t = tenants.find((x) => x.id === id);
                      if (t) setTenantName(t.company_name);
                      setStatus("occupied");
                    } else {
                      setTenantName("");
                      setStatus("vacant");
                    }
                  }}
                  className={`w-full rounded-md border px-3 py-2 text-sm bg-white ${tenantRequired ? "border-red-400" : "border-gray-300"}`}
                >
                  <option value="">— Vacant (no tenant) —</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.company_name}</option>
                  ))}
                </select>
                {tenantRequired && (
                  <p className="text-xs text-red-500 mt-1">Required for occupied/reserved office</p>
                )}
              </div>

              {(resource.resource_type === "office" ||
                resource.resource_type === "hot_desk" ||
                resource.resource_type === "open_space") && (
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
                      className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
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
                      className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
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
                      className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              {["meeting_room", "zoom_cabin", "event_zone"].includes(resource.resource_type) && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Capacity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Coins/hr
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={coinsHr}
                      onChange={(e) => setCoinsHr(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                      $/hr
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={moneyHr}
                      onChange={(e) => setMoneyHr(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {resource && canEdit && (
          <div className="p-5 border-t border-gray-200 flex gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex-1 rounded-md bg-cbc-blue hover:bg-cbc-bright-blue text-white font-medium py-2 transition"
              >
                Edit
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
                  disabled={saving || tenantRequired}
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
