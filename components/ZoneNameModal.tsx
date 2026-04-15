"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Resource, ResourceType } from "@/lib/types";

interface ZoneNameModalProps {
  open: boolean;
  buildingId: number;
  floorId: number;
  /** Resources already linked elsewhere — shown but flagged. */
  excludeResourceIds?: number[];
  submitting?: boolean;
  /** If set, the modal is in "re-assign" mode for an existing zone. */
  currentResourceId?: number | null;
  currentResourceName?: string | null;
  onClose: () => void;
  /** Called with the resource id (existing or freshly created) to link the zone to. */
  onLinked: (resourceId: number) => Promise<void> | void;
  /** Called to unlink the zone (set resource_id to null). Only shown in re-assign mode. */
  onUnlink?: () => void;
}

const TYPE_LABEL: Record<ResourceType, string> = {
  office: "Office",
  meeting_room: "Meeting Room",
  hot_desk: "Hot Desk",
  open_space: "Open Space",
  amenity: "Amenity",
  event_zone: "Event Zone",
  zoom_cabin: "Zoom Cabin",
};

export default function ZoneNameModal({
  open,
  buildingId,
  floorId,
  excludeResourceIds = [],
  submitting = false,
  currentResourceId = null,
  currentResourceName = null,
  onClose,
  onLinked,
  onUnlink,
}: ZoneNameModalProps) {
  const isReassign = currentResourceId != null;
  // tab: pick existing | create new
  const [tab, setTab] = useState<"pick" | "new">("pick");
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");

  // create-new sub-form
  const [name, setName] = useState("");
  const [type, setType] = useState<ResourceType>("office");
  const [areaM2, setAreaM2] = useState("0");
  const [seats, setSeats] = useState("1");
  const [rate, setRate] = useState("0");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab("pick");
    setSearch("");
    setName("");
    setType("office");
    setAreaM2("0");
    setSeats("1");
    setRate("0");
    setError(null);

    setLoadingList(true);
    api
      .get<Resource[]>("/resources", { params: { building_id: buildingId } })
      .then((res) => setResources(res.data))
      .catch(() => setResources([]))
      .finally(() => setLoadingList(false));
  }, [open, buildingId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.resource_type.toLowerCase().includes(q)
    );
  }, [resources, search]);

  async function handlePick(r: Resource) {
    await onLinked(r.id);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        building_id: buildingId,
        floor_id: floorId,
        name: name.trim(),
        resource_type: type,
        status: "vacant",
      };
      if (type === "office" || type === "hot_desk" || type === "open_space") {
        body.area_m2 = parseFloat(areaM2) || 0;
        body.seats = parseInt(seats, 10) || 1;
        body.monthly_rate = parseFloat(rate) || 0;
      } else if (type === "meeting_room") {
        body.capacity = parseInt(seats, 10) || 1;
        body.rate_money_per_hour = parseFloat(rate) || 0;
      }
      const created = await api.post<Resource>("/resources", body);
      await onLinked(created.data.id);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to create resource");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {isReassign ? `Re-assign zone: ${currentResourceName}` : "Link this zone"}
        </h3>

        {isReassign && onUnlink && (
          <button
            type="button"
            onClick={onUnlink}
            disabled={submitting}
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            Unlink from resource (make unmapped)
          </button>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab("pick")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "pick"
                ? "border-cbc-blue text-cbc-blue"
                : "border-transparent text-gray-600"
            }`}
          >
            Pick existing
          </button>
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "new"
                ? "border-cbc-blue text-cbc-blue"
                : "border-transparent text-gray-600"
            }`}
          >
            Create new
          </button>
        </div>

        {/* Pick existing */}
        {tab === "pick" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search by name or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="max-h-72 overflow-auto border border-gray-200 rounded-md divide-y divide-gray-100">
              {loadingList ? (
                <div className="p-4 text-sm text-gray-500">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  No resources match.
                </div>
              ) : (
                filtered.map((r) => {
                  const linked = excludeResourceIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handlePick(r)}
                      disabled={submitting}
                      className="w-full text-left p-3 hover:bg-gray-50 transition disabled:opacity-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {r.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {TYPE_LABEL[r.resource_type]} · {r.status}
                        </div>
                      </div>
                      {linked && (
                        <span className="text-[10px] uppercase font-semibold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">
                          already linked
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Create new */}
        {tab === "new" && (
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Name
              </label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ResourceType)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                <option value="office">Office</option>
                <option value="meeting_room">Meeting Room</option>
                <option value="hot_desk">Hot Desk</option>
                <option value="open_space">Open Space</option>
                <option value="amenity">Amenity</option>
                <option value="event_zone">Event Zone</option>
                <option value="zoom_cabin">Zoom Cabin</option>
              </select>
            </div>
            {(type === "office" ||
              type === "hot_desk" ||
              type === "open_space") && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Area m²
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={areaM2}
                    onChange={(e) => setAreaM2(e.target.value)}
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
                    $/mo
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
            {type === "meeting_room" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Capacity
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
                    $/hr
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

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create & link"}
              </button>
            </div>
          </form>
        )}

        {/* Universal cancel for "pick" tab (form has its own) */}
        {tab === "pick" && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
