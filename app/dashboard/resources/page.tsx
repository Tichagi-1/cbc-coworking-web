"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";

import { api, ROLE_COOKIE } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { formatMoney } from "@/lib/currency";
import { useProperty } from "@/lib/PropertyContext";
import EditResourceModal from "@/components/EditResourceModal";
import type {
  Floor,
  Plan,
  RatePeriod,
  Resource,
  ResourceType,
  UnitStatus,
  UserRole,
} from "@/lib/types";

const TYPE_TABS: { id: "all" | ResourceType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "office", label: "Offices" },
  { id: "meeting_room", label: "Meeting Rooms" },
  { id: "hot_desk", label: "Hot Desks" },
  { id: "open_space", label: "Open Space" },
  { id: "amenity", label: "Amenities" },
  { id: "event_zone", label: "Event Zones" },
  { id: "zoom_cabin", label: "Zoom Cabins" },
];

const TYPE_BADGE: Record<ResourceType, string> = {
  office: "bg-blue-100 text-blue-800",
  meeting_room: "bg-purple-100 text-purple-800",
  hot_desk: "bg-cyan-100 text-cyan-800",
  open_space: "bg-emerald-100 text-emerald-800",
  amenity: "bg-sky-100 text-sky-800",
  event_zone: "bg-red-100 text-red-800",
  zoom_cabin: "bg-violet-100 text-violet-800",
};

const STATUS_PILL: Record<UnitStatus, string> = {
  occupied: "bg-green-100 text-green-800 border-green-200",
  vacant: "bg-red-100 text-red-800 border-red-200",
  reserved: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

function formatRate(r: Resource): string {
  if (r.resource_type === "meeting_room") {
    const c = r.rate_coins_per_hour ?? 0;
    const m = r.rate_money_per_hour ?? 0;
    return `${c} coins / $${m} per hr`;
  }
  if (r.resource_type === "amenity") {
    return r.rate_per_hour ? `$${r.rate_per_hour} / hr` : "—";
  }
  if (r.effective_monthly_rate != null) {
    return `${formatMoney(r.effective_monthly_rate)} / month`;
  }
  if (r.monthly_rate == null) return "—";
  const period = r.rate_period && r.rate_period !== "month" ? r.rate_period : "month";
  return `$${r.monthly_rate.toLocaleString()} / ${period}`;
}

function computePlanRate(plan: Plan, seats: number | null): number {
  if (plan.billing_mode === "per_seat") {
    return plan.base_rate_uzs * (seats ?? 1);
  }
  return plan.base_rate_uzs;
}

// Currency formatting moved to lib/currency.ts

export default function ResourcesPage() {
  const { propertyId: BUILDING_ID } = useProperty();
  const [role, setRole] = useState<UserRole | undefined>(undefined);
  useEffect(() => {
    setRole(Cookies.get(ROLE_COOKIE) as UserRole | undefined);
  }, []);
  const isAdmin = hasPermission("manage_resources");

  const [resources, setResources] = useState<Resource[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | ResourceType>("all");
  const [floorFilter, setFloorFilter] = useState<number | "all" | "none">("all");
  const [selected, setSelected] = useState<Resource | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit state in the PARENT — the edit modal is rendered as a top-level portal
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  async function loadResources() {
    try {
      const res = await api.get<Resource[]>("/resources", {
        params: { building_id: BUILDING_ID },
      });
      setResources(res.data);
    } catch (e) {
      setError((e as Error)?.message || "Failed to load resources");
    }
  }

  useEffect(() => {
    loadResources();
    api
      .get<Floor[]>(`/buildings/${BUILDING_ID}/floors`)
      .then((res) => setFloors(res.data))
      .catch(() => undefined);
    api
      .get<Plan[]>(`/plans?building_id=${BUILDING_ID}`)
      .then((res) => setPlans(res.data))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [BUILDING_ID]);

  const filtered = useMemo(() => {
    let list = activeTab === "all" ? resources : resources.filter((r) => r.resource_type === activeTab);
    if (floorFilter === "none") list = list.filter((r) => !r.floor_id);
    else if (floorFilter !== "all") list = list.filter((r) => r.floor_id === floorFilter);
    return list;
  }, [resources, activeTab, floorFilter]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Resources</h1>
        {isAdmin && (
          <button
            onClick={() => setAddOpen(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md"
          >
            + Add Resource
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200">
        {TYPE_TABS.map((t) => {
          const active = activeTab === t.id;
          const count =
            t.id === "all"
              ? resources.length
              : resources.filter((r) => r.resource_type === t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                active
                  ? "border-cbc-blue text-cbc-blue"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {t.label}{" "}
              <span
                className={`ml-1 text-xs ${
                  active ? "text-cbc-blue" : "text-gray-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Floor filter pills */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {[{ id: "all" as const, label: "All Floors" }, ...floors.map((f) => ({ id: f.id, label: f.name || `Floor ${f.number}` })), { id: "none" as const, label: "Unassigned" }].map((item) => (
          <button
            key={String(item.id)}
            onClick={() => setFloorFilter(item.id as number | "all" | "none")}
            style={{
              padding: "4px 12px", borderRadius: 999, fontSize: 12, border: "none", cursor: "pointer",
              background: floorFilter === item.id ? "#003DA5" : "#f3f4f6",
              color: floorFilter === item.id ? "white" : "#374151",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">
            ×
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-sm text-gray-500 p-8 border border-dashed border-gray-300 rounded-md">
          No resources in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const floor = floors.find((f) => f.id === r.floor_id);
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-cbc-blue hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                      TYPE_BADGE[r.resource_type]
                    }`}
                  >
                    {r.resource_type.replace("_", " ")}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                      STATUS_PILL[r.status]
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="font-semibold text-gray-900 truncate">
                  {r.name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {floor ? floor.name ?? `Floor ${floor.number}` : "Unassigned"}
                </div>
                <div className="text-sm text-gray-700 mt-2">
                  {formatRate(r)}
                </div>
                {r.plan && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                    {r.plan.name}
                  </span>
                )}
                {r.resident_discount_pct > 0 && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-semibold">
                    -{r.resident_discount_pct}% resident
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Read-only detail panel — NO edit form here */}
      {selected && (
        <ResourceDetail
          resource={selected}
          floor={floors.find((f) => f.id === selected.floor_id) ?? null}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onEditRequest={() => setEditingResource(selected)}
          onDeleted={async () => {
            await loadResources();
            setSelected(null);
          }}
        />
      )}

      {/* Edit modal — standalone component rendered as top-level portal */}
      {editingResource && (
        <EditResourceModal
          resource={editingResource}
          onSave={(updated) => {
            setResources((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            if (selected?.id === updated.id) setSelected(updated);
            setEditingResource(null);
          }}
          onClose={() => setEditingResource(null)}
        />
      )}

      {/* Add modal */}
      {addOpen && (
        <AddResourceModal
          floors={floors}
          plans={plans}
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            setAddOpen(false);
            await loadResources();
          }}
        />
      )}
    </div>
  );
}

// ── Read-only detail panel (NO editing state) ─────────────────────────────

function ResourceDetail({
  resource,
  floor,
  isAdmin,
  onClose,
  onEditRequest,
  onDeleted,
}: {
  resource: Resource;
  floor: Floor | null;
  isAdmin: boolean;
  onClose: () => void;
  onEditRequest: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function remove() {
    if (!confirm(`Delete "${resource.name}"? This cannot be undone.`)) return;
    setSubmitting(true);
    try {
      await api.delete(`/resources/${resource.id}`);
      await onDeleted();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-40 flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-4">
            <span
              className={`inline-block text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                TYPE_BADGE[resource.resource_type]
              }`}
            >
              {resource.resource_type.replace("_", " ")}
            </span>
            <h2 className="text-xl font-semibold text-gray-900 mt-1.5 truncate">
              {resource.name}
            </h2>
            <div className="text-xs text-gray-500 mt-0.5">
              {floor ? floor.name ?? `Floor ${floor.number}` : "Unassigned"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 flex-1 overflow-auto space-y-4">
          <span
            className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${
              STATUS_PILL[resource.status]
            }`}
          >
            {resource.status.toUpperCase()}
          </span>

          {resource.tenant_name && (
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Tenant
              </div>
              <div className="text-sm text-gray-900 font-medium">
                {resource.tenant_name}
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            {resource.area_m2 != null && (
              <>
                <dt className="text-gray-500">Area</dt>
                <dd className="text-gray-900 font-medium">{resource.area_m2} m²</dd>
              </>
            )}
            {resource.seats != null && (
              <>
                <dt className="text-gray-500">Seats</dt>
                <dd className="text-gray-900 font-medium">{resource.seats}</dd>
              </>
            )}
            {resource.capacity != null && (
              <>
                <dt className="text-gray-500">Capacity</dt>
                <dd className="text-gray-900 font-medium">{resource.capacity}</dd>
              </>
            )}
            <dt className="text-gray-500">Rate</dt>
            <dd className="text-gray-900 font-medium">{formatRate(resource)}</dd>
            {resource.plan && (
              <>
                <dt className="text-gray-500">Plan</dt>
                <dd>
                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                    {resource.plan.name}
                  </span>
                </dd>
              </>
            )}
          </dl>

          {resource.amenities && resource.amenities.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Amenities
              </div>
              <div className="flex flex-wrap gap-1">
                {resource.amenities.map((a) => (
                  <span
                    key={a}
                    className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="p-5 border-t border-gray-200 flex gap-2">
            <button
              onClick={remove}
              disabled={submitting}
              className="flex-1 rounded-md border border-red-300 text-red-700 font-medium py-2 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
            <button
              onClick={() => onEditRequest()}
              className="flex-1 rounded-md bg-cbc-blue hover:bg-cbc-bright-blue text-white font-medium py-2"
            >
              Edit
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

// ── Add resource modal ────────────────────────────────────────────────────

function AddResourceModal({
  floors,
  plans,
  onClose,
  onCreated,
}: {
  floors: Floor[];
  plans: Plan[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { propertyId: BUILDING_ID } = useProperty();
  const [name, setName] = useState("");
  const [type, setType] = useState<ResourceType>("office");
  const [floorId, setFloorId] = useState<number | null>(floors[0]?.id ?? null);
  const [areaM2, setAreaM2] = useState("0");
  const [seats, setSeats] = useState("1");
  const [monthlyRate, setMonthlyRate] = useState("0");
  const [ratePeriod, setRatePeriod] = useState<RatePeriod>("month");
  const [capacity, setCapacity] = useState("4");
  const [coinsHr, setCoinsHr] = useState("0");
  const [moneyHr, setMoneyHr] = useState("0");
  const [planId, setPlanId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const addPlanRatePreview = selectedPlan
    ? computePlanRate(selectedPlan, parseInt(seats, 10) || 1)
    : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        building_id: BUILDING_ID,
        floor_id: floorId,
        name: name.trim(),
        resource_type: type,
        status: "vacant",
        plan_id: planId,
      };
      if (type === "meeting_room") {
        body.capacity = parseInt(capacity, 10) || 0;
        body.rate_coins_per_hour = parseFloat(coinsHr) || 0;
        body.rate_money_per_hour = parseFloat(moneyHr) || 0;
      } else if (type === "amenity") {
        body.rate_per_hour = parseFloat(moneyHr) || 0;
      } else {
        body.area_m2 = parseFloat(areaM2) || 0;
        body.seats = parseInt(seats, 10) || 1;
        body.monthly_rate = parseFloat(monthlyRate) || 0;
        body.rate_period = ratePeriod;
      }
      await api.post("/resources", body);
      await onCreated();
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to create resource");
    } finally {
      setSubmitting(false);
    }
  }

  const showFlex = type === "office" || type === "hot_desk" || type === "open_space";
  const showMeeting = type === "meeting_room";
  const showAmenity = type === "amenity";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold text-gray-900">Add resource</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ResourceType)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white">
              <option value="office">Office</option>
              <option value="meeting_room">Meeting Room</option>
              <option value="hot_desk">Hot Desk</option>
              <option value="open_space">Open Space</option>
              <option value="amenity">Amenity</option>
              <option value="event_zone">Event Zone</option>
              <option value="zoom_cabin">Zoom Cabin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Floor</label>
            <select value={floorId ?? ""} onChange={(e) => setFloorId(Number(e.target.value) || null)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white">
              <option value="">— Unassigned —</option>
              {floors.map((f) => (<option key={f.id} value={f.id}>{f.name ?? `Floor ${f.number}`}</option>))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        {showFlex && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Area m²</label><input type="number" min="0" value={areaM2} onChange={(e) => setAreaM2(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm" /></div>
              <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Seats</label><input type="number" min="1" value={seats} onChange={(e) => setSeats(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm" /></div>
              <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Rate</label><input type="number" min="0" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm" /></div>
            </div>
            {(type === "hot_desk" || type === "open_space") && (
              <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Pricing period</label><select value={ratePeriod} onChange={(e) => setRatePeriod(e.target.value as RatePeriod)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"><option value="day">per day</option><option value="biweekly">per 2 weeks</option><option value="month">per month</option></select></div>
            )}
          </>
        )}

        {showMeeting && (
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Capacity</label><input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm" /></div>
            <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Coins/hr</label><input type="number" min="0" value={coinsHr} onChange={(e) => setCoinsHr(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm" /></div>
            <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">$/hr</label><input type="number" min="0" value={moneyHr} onChange={(e) => setMoneyHr(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm" /></div>
          </div>
        )}

        {showAmenity && (
          <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Rate $/hr</label><input type="number" min="0" value={moneyHr} onChange={(e) => setMoneyHr(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
        )}

        {showFlex && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Tariff Plan</label>
            <select value={planId ?? ""} onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : null)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white">
              <option value="">-- No plan (manual rate) --</option>
              {plans.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.billing_mode === "per_unit" ? "per unit" : "per seat"})</option>))}
            </select>
            {selectedPlan && addPlanRatePreview != null && (
              <div className="text-xs text-gray-500 mt-1">{selectedPlan.billing_mode === "per_seat" ? `= ${formatMoney(selectedPlan.base_rate_uzs)} x ${parseInt(seats, 10) || 1} seats = ${formatMoney(addPlanRatePreview)}/month` : `= ${formatMoney(addPlanRatePreview)}/month`}</div>
            )}
          </div>
        )}

        {error && (<div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>)}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={submitting || !name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md disabled:opacity-50">{submitting ? "Saving…" : "Create"}</button>
        </div>
      </form>
    </div>
  );
}
