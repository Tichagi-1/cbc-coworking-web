"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import Cookies from "js-cookie";

import { api, buildAssetUrl, ROLE_COOKIE } from "@/lib/api";
import type { Building, Floor, Unit, UserRole, Zone } from "@/lib/types";
import ZonePanel from "@/components/ZonePanel";

// FloorCanvas uses fabric (browser-only) — load with SSR disabled.
const FloorCanvas = dynamic(() => import("@/components/FloorCanvas"), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-gray-500 p-8">Loading canvas…</div>
  ),
});

type Mode = "view" | "edit";

export default function MapPage() {
  const [role, setRole] = useState<UserRole | undefined>(undefined);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingId, setBuildingId] = useState<number | null>(null);

  const [floors, setFloors] = useState<Floor[]>([]);
  const [floorId, setFloorId] = useState<number | null>(null);

  const [zones, setZones] = useState<Zone[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [mode, setMode] = useState<Mode>("view");
  const [historyDate, setHistoryDate] = useState<string>(
    dayjs().format("YYYY-MM-DD")
  );

  const [error, setError] = useState<string | null>(null);

  // Read role from cookie on mount
  useEffect(() => {
    const r = Cookies.get(ROLE_COOKIE) as UserRole | undefined;
    setRole(r);
  }, []);

  const isAdmin = role === "admin" || role === "manager";

  // Fetch buildings
  useEffect(() => {
    api
      .get<Building[]>("/buildings/")
      .then((res) => {
        setBuildings(res.data);
        if (res.data.length > 0 && buildingId === null) {
          setBuildingId(res.data[0].id);
        }
      })
      .catch((e) => setError(e?.message || "Failed to load buildings"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch floors when building changes
  useEffect(() => {
    if (buildingId === null) return;
    api
      .get<Floor[]>(`/buildings/${buildingId}/floors`)
      .then((res) => {
        setFloors(res.data);
        setFloorId(res.data[0]?.id ?? null);
      })
      .catch((e) => setError(e?.message || "Failed to load floors"));
  }, [buildingId]);

  // Fetch zones + units when floor changes
  useEffect(() => {
    if (buildingId === null || floorId === null) {
      setZones([]);
      setUnits([]);
      return;
    }
    Promise.all([
      api.get<Zone[]>(`/buildings/${buildingId}/floors/${floorId}/zones`),
      api.get<Unit[]>(`/units/`, { params: { floor_id: floorId } }),
    ])
      .then(([zRes, uRes]) => {
        setUnits(uRes.data);
        // Join unit status into zones for canvas coloring
        const unitStatusById = new Map(uRes.data.map((u) => [u.id, u.status]));
        const enriched = zRes.data.map((z) => ({
          ...z,
          status: z.unit_id ? unitStatusById.get(z.unit_id) : undefined,
        }));
        setZones(enriched);
      })
      .catch((e) => setError(e?.message || "Failed to load floor data"));
  }, [buildingId, floorId]);

  const currentFloor = useMemo(
    () => floors.find((f) => f.id === floorId) ?? null,
    [floors, floorId]
  );

  const planUrl = buildAssetUrl(currentFloor?.floor_plan_url);

  function handleZoneClick(zone: Zone) {
    if (zone.unit_id == null) return;
    const unit = units.find((u) => u.id === zone.unit_id) ?? null;
    setSelectedUnit(unit);
    setPanelOpen(true);
  }

  function handlePanelClose() {
    setPanelOpen(false);
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
            Building
          </label>
          <select
            value={buildingId ?? ""}
            onChange={(e) => setBuildingId(Number(e.target.value) || null)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            {buildings.length === 0 && <option value="">— none —</option>}
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
            Floor
          </label>
          <select
            value={floorId ?? ""}
            onChange={(e) => setFloorId(Number(e.target.value) || null)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            {floors.length === 0 && <option value="">— none —</option>}
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name ?? `Floor ${f.number}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
            History date
          </label>
          <input
            type="date"
            value={historyDate}
            onChange={(e) => setHistoryDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          />
        </div>

        {isAdmin && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
              Mode
            </label>
            <button
              onClick={() => setMode((m) => (m === "view" ? "edit" : "view"))}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition ${
                mode === "edit"
                  ? "bg-cbc-blue text-white border-cbc-blue"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {mode === "view" ? "View" : "Edit"}
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-500/40 border border-green-600" />
            Occupied
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500/40 border border-red-600" />
            Vacant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-yellow-500/40 border border-yellow-600" />
            Reserved
          </span>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      <FloorCanvas
        floorPlanUrl={planUrl}
        zones={zones}
        mode={mode}
        onZoneClick={handleZoneClick}
      />

      <ZonePanel
        unit={selectedUnit}
        open={panelOpen}
        role={role}
        onClose={handlePanelClose}
      />
    </div>
  );
}
