"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import Cookies from "js-cookie";

import { api, buildAssetUrl, ROLE_COOKIE } from "@/lib/api";
import type {
  Building,
  Floor,
  Point,
  Unit,
  UnitType,
  UserRole,
  Zone,
} from "@/lib/types";
import ZonePanel, { UnitPatchPayload } from "@/components/ZonePanel";
import AddFloorModal from "@/components/AddFloorModal";
import ZoneNameModal, { ZoneFormData } from "@/components/ZoneNameModal";
import ConfirmModal from "@/components/ConfirmModal";

// FloorCanvas uses fabric (browser-only) — load with SSR disabled.
const FloorCanvas = dynamic(() => import("@/components/FloorCanvas"), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-gray-500 p-8">Loading canvas…</div>
  ),
});

type Mode = "view" | "edit" | "history";

const BUILDING_ID = 1; // Modera Coworking — single-building MVP

export default function MapPage() {
  // ── Auth/role ───────────────────────────────────────────────────────────
  const [role, setRole] = useState<UserRole | undefined>(undefined);
  useEffect(() => {
    setRole(Cookies.get(ROLE_COOKIE) as UserRole | undefined);
  }, []);
  const isAdmin = role === "admin" || role === "manager";

  // ── Building/floor state ────────────────────────────────────────────────
  const [floors, setFloors] = useState<Floor[]>([]);
  const [floorId, setFloorId] = useState<number | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);

  // ── Zones / units ───────────────────────────────────────────────────────
  const [savedZones, setSavedZones] = useState<Zone[]>([]);
  const [pendingZones, setPendingZones] = useState<Zone[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // ── Panel + modals ──────────────────────────────────────────────────────
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelSaving, setPanelSaving] = useState(false);
  const [addFloorOpen, setAddFloorOpen] = useState(false);
  const [addFloorSubmitting, setAddFloorSubmitting] = useState(false);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneModalSubmitting, setZoneModalSubmitting] = useState(false);
  const pendingPolygonPointsRef = useRef<Point[] | null>(null);

  // Floor edit/delete
  const [renamingFloorId, setRenamingFloorId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [deleteFloorOpen, setDeleteFloorOpen] = useState(false);
  const [deleteFloorSubmitting, setDeleteFloorSubmitting] = useState(false);

  // Per-unit cache for click drill-down (avoids duplicate /units/{id} fetches)
  const unitCacheRef = useRef<Map<number, Unit>>(new Map());

  // ── Edit state ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("view");
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [defaultZoneType, setDefaultZoneType] = useState<UnitType>("office");
  const [savingZones, setSavingZones] = useState(false);

  // ── Misc ────────────────────────────────────────────────────────────────
  const [historyDate, setHistoryDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ── Load building (id=1, MVP) ──────────────────────────────────────────
  useEffect(() => {
    api
      .get<Building>(`/buildings/${BUILDING_ID}`)
      .then((res) => setBuilding(res.data))
      .catch(() => {
        // /buildings/{id} doesn't exist as a single-resource endpoint;
        // fall back to listing.
        api
          .get<Building[]>("/buildings/")
          .then((res) =>
            setBuilding(res.data.find((b) => b.id === BUILDING_ID) ?? null)
          )
          .catch((e) => setError(e?.message || "Failed to load building"));
      });
  }, []);

  // ── Load floors ─────────────────────────────────────────────────────────
  const loadFloors = useCallback(
    async (selectFloorId?: number) => {
      try {
        const res = await api.get<Floor[]>(
          `/buildings/${BUILDING_ID}/floors`
        );
        setFloors(res.data);
        if (selectFloorId !== undefined) {
          setFloorId(selectFloorId);
        } else if (res.data.length > 0 && floorId == null) {
          setFloorId(res.data[0].id);
        }
      } catch (e) {
        setError((e as Error)?.message || "Failed to load floors");
      }
    },
    [floorId]
  );

  useEffect(() => {
    loadFloors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load floor data: zones (live) or snapshot (history) ─────────────────
  const loadFloorData = useCallback(
    async (fid: number, viewMode: Mode, date: string) => {
      try {
        // Always refresh units for the floor — drives stats, panel cache,
        // and the live status join. Warms the per-unit cache too.
        const uRes = await api.get<Unit[]>(`/units/`, {
          params: { floor_id: fid },
        });
        setUnits(uRes.data);
        uRes.data.forEach((u) => unitCacheRef.current.set(u.id, u));

        let enriched: Zone[];
        if (viewMode === "history") {
          const sRes = await api.get<Zone[]>(
            `/buildings/${BUILDING_ID}/floors/${fid}/snapshot`,
            { params: { date } }
          );
          // The snapshot endpoint already returns status synthesized from
          // lease history at `date`.
          enriched = sRes.data;
        } else {
          const zRes = await api.get<Zone[]>(
            `/buildings/${BUILDING_ID}/floors/${fid}/zones`
          );
          const unitById = new Map(uRes.data.map((u) => [u.id, u]));
          enriched = zRes.data.map((z) => {
            const unit = z.unit_id ? unitById.get(z.unit_id) : undefined;
            return {
              ...z,
              status: unit?.status,
              label: z.label || unit?.name || null,
            };
          });
        }
        setSavedZones(enriched);
        setPendingZones([]);
      } catch (e) {
        setError((e as Error)?.message || "Failed to load floor data");
      }
    },
    []
  );

  useEffect(() => {
    if (floorId == null) {
      setSavedZones([]);
      setPendingZones([]);
      setUnits([]);
      return;
    }
    loadFloorData(floorId, mode, historyDate);
  }, [floorId, mode, historyDate, loadFloorData]);

  // ── Per-unit cache helper (used by zone click) ──────────────────────────
  const getUnit = useCallback(async (id: number): Promise<Unit | null> => {
    const cached = unitCacheRef.current.get(id);
    if (cached) return cached;
    try {
      const res = await api.get<Unit>(`/units/${id}`);
      unitCacheRef.current.set(id, res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────
  const currentFloor = useMemo(
    () => floors.find((f) => f.id === floorId) ?? null,
    [floors, floorId]
  );
  const planUrl = buildAssetUrl(currentFloor?.floor_plan_url);
  const allZones = useMemo(
    () => [...savedZones, ...pendingZones],
    [savedZones, pendingZones]
  );

  // Stats for the legend row
  const occupiedCount = useMemo(
    () => units.filter((u) => u.status === "occupied").length,
    [units]
  );
  const totalUnits = units.length;

  // ── Handlers: zone click / select ───────────────────────────────────────
  async function handleZoneClick(zone: Zone) {
    if (zone.unit_id == null) return;
    // Show panel immediately with whatever's already in cache, then
    // refetch in background to make sure we display the latest unit data.
    const cached = unitCacheRef.current.get(zone.unit_id) ?? null;
    setSelectedUnit(cached);
    setPanelOpen(true);
    setPanelLoading(true);
    const fresh = await getUnit(zone.unit_id);
    setSelectedUnit(fresh);
    setPanelLoading(false);
  }

  function handleZoneSelect(zone: Zone) {
    setSelectedZoneId(zone.id);
  }

  // ── Handlers: add floor ─────────────────────────────────────────────────
  async function handleAddFloor(data: { number: number; name: string | null }) {
    setAddFloorSubmitting(true);
    try {
      const res = await api.post<Floor>(
        `/buildings/${BUILDING_ID}/floors`,
        data
      );
      setAddFloorOpen(false);
      await loadFloors(res.data.id);
    } catch (e) {
      setError((e as Error)?.message || "Failed to create floor");
    } finally {
      setAddFloorSubmitting(false);
    }
  }

  // ── Handlers: rename floor ──────────────────────────────────────────────
  function startRenameFloor() {
    if (!currentFloor) return;
    setRenameValue(currentFloor.name ?? "");
    setRenamingFloorId(currentFloor.id);
  }

  function cancelRenameFloor() {
    setRenamingFloorId(null);
    setRenameValue("");
  }

  async function submitRenameFloor() {
    if (renamingFloorId == null) return;
    setRenameSubmitting(true);
    try {
      await api.patch<Floor>(
        `/buildings/${BUILDING_ID}/floors/${renamingFloorId}`,
        { name: renameValue.trim() || null }
      );
      await loadFloors(renamingFloorId);
      cancelRenameFloor();
    } catch (e) {
      setError((e as Error)?.message || "Failed to rename floor");
    } finally {
      setRenameSubmitting(false);
    }
  }

  // ── Handlers: delete floor ──────────────────────────────────────────────
  async function handleDeleteFloor() {
    if (floorId == null) return;
    setDeleteFloorSubmitting(true);
    try {
      await api.delete(`/buildings/${BUILDING_ID}/floors/${floorId}`);
      setDeleteFloorOpen(false);
      // Reload list and let it auto-select the first remaining floor
      const fresh = await api.get<Floor[]>(
        `/buildings/${BUILDING_ID}/floors`
      );
      setFloors(fresh.data);
      setFloorId(fresh.data[0]?.id ?? null);
    } catch (e) {
      setError((e as Error)?.message || "Failed to delete floor");
    } finally {
      setDeleteFloorSubmitting(false);
    }
  }

  // ── Handlers: PATCH unit from panel ─────────────────────────────────────
  async function handleUnitSave(
    id: number,
    patch: UnitPatchPayload
  ): Promise<Unit | null> {
    setPanelSaving(true);
    try {
      const res = await api.patch<Unit>(`/units/${id}`, patch);
      const fresh = res.data;
      // Update cache, units list, and currently displayed unit
      unitCacheRef.current.set(fresh.id, fresh);
      setUnits((prev) => prev.map((u) => (u.id === fresh.id ? fresh : u)));
      setSelectedUnit(fresh);
      // Refresh canvas zones so border (status) updates
      if (floorId != null) {
        await loadFloorData(floorId, mode, historyDate);
      }
      return fresh;
    } catch (e) {
      setError((e as Error)?.message || "Failed to save unit");
      return null;
    } finally {
      setPanelSaving(false);
    }
  }

  // ── Handlers: upload floor plan ─────────────────────────────────────────
  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || floorId == null) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(
        `/buildings/${BUILDING_ID}/floors/${floorId}/plan`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      // Refresh floors list to pick up new floor_plan_url
      await loadFloors(floorId);
    } catch (err) {
      setError((err as Error)?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // ── Handlers: draw → name → create unit + pending zone ─────────────────
  function handleZoneCreated(points: Point[]) {
    pendingPolygonPointsRef.current = points;
    setZoneModalOpen(true);
  }

  async function handleZoneFormSubmit(data: ZoneFormData) {
    if (!pendingPolygonPointsRef.current || floorId == null) return;
    setZoneModalSubmitting(true);
    try {
      // Create the unit first
      const unitRes = await api.post<Unit>("/units/", {
        floor_id: floorId,
        name: data.name,
        unit_type: data.unit_type,
        area_m2: data.area_m2,
        seats: data.seats,
        monthly_rate: data.monthly_rate,
        rate_period: data.rate_period,
      });
      const newUnit = unitRes.data;
      setUnits((prev) => [...prev, newUnit]);

      // Stage a pending zone (negative id so it doesn't collide with saved)
      const tempId = -(Date.now() % 1_000_000);
      const newZone: Zone = {
        id: tempId,
        floor_id: floorId,
        unit_id: newUnit.id,
        points: pendingPolygonPointsRef.current,
        label: newUnit.name,
        zone_type: newUnit.unit_type,
        status: newUnit.status,
      };
      setPendingZones((prev) => [...prev, newZone]);

      pendingPolygonPointsRef.current = null;
      setZoneModalOpen(false);
    } catch (e) {
      setError((e as Error)?.message || "Failed to create zone");
    } finally {
      setZoneModalSubmitting(false);
    }
  }

  function handleZoneFormCancel() {
    pendingPolygonPointsRef.current = null;
    setZoneModalOpen(false);
  }

  // ── Handlers: save / clear / mode ───────────────────────────────────────
  async function handleSaveZones() {
    if (floorId == null) return;
    setSavingZones(true);
    try {
      const payload = allZones.map((z) => ({
        unit_id: z.unit_id,
        points: z.points,
        label: z.label,
        zone_type: z.zone_type,
      }));
      await api.put(
        `/buildings/${BUILDING_ID}/floors/${floorId}/zones`,
        payload
      );
      await loadFloorData(floorId, mode, historyDate);
      setSelectedZoneId(null);
    } catch (e) {
      setError((e as Error)?.message || "Failed to save zones");
    } finally {
      setSavingZones(false);
    }
  }

  function handleClearSelected() {
    if (selectedZoneId == null) return;
    setPendingZones((prev) => prev.filter((z) => z.id !== selectedZoneId));
    setSavedZones((prev) => prev.filter((z) => z.id !== selectedZoneId));
    setSelectedZoneId(null);
  }

  function handleModeChange(next: Mode) {
    setMode(next);
    if (next !== "edit") {
      setDrawingEnabled(false);
      setSelectedZoneId(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* TOP BAR */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
            Floor
          </label>
          {renamingFloorId != null ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRenameFloor();
                  if (e.key === "Escape") cancelRenameFloor();
                }}
                autoFocus
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white min-w-[180px]"
              />
              <button
                onClick={submitRenameFloor}
                disabled={renameSubmitting}
                className="px-3 py-2 text-sm font-medium text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md disabled:opacity-50"
              >
                {renameSubmitting ? "…" : "Save"}
              </button>
              <button
                onClick={cancelRenameFloor}
                disabled={renameSubmitting}
                className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <select
                value={floorId ?? ""}
                onChange={(e) => setFloorId(Number(e.target.value) || null)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white min-w-[180px]"
              >
                {floors.length === 0 && <option value="">— none —</option>}
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name ?? `Floor ${f.number}`}
                  </option>
                ))}
              </select>

              {isAdmin && currentFloor && (
                <>
                  <button
                    type="button"
                    onClick={startRenameFloor}
                    title="Rename floor"
                    className="p-2 text-gray-500 hover:text-cbc-blue rounded-md hover:bg-gray-100"
                  >
                    {/* pencil icon (inline svg) */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteFloorOpen(true)}
                    title="Delete floor"
                    className="p-2 text-gray-500 hover:text-red-600 rounded-md hover:bg-gray-100"
                  >
                    {/* trash icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={() => setAddFloorOpen(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-cbc-blue hover:bg-cbc-bright-blue rounded-md"
          >
            + Add Floor
          </button>
        )}

        <div className="ml-auto flex items-end gap-3">
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
            {(["view", "edit", "history"] as Mode[]).map((m) => {
              const active = mode === m;
              const disabled = m === "edit" && !isAdmin;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleModeChange(m)}
                  className={`px-4 py-2 text-sm font-medium transition border-r last:border-r-0 border-gray-300 ${
                    active
                      ? "bg-cbc-blue text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {m.toUpperCase()}
                </button>
              );
            })}
          </div>

          {mode === "history" && (
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
            />
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex items-start justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* CANVAS AREA */}
      <div
        className="w-full overflow-auto"
        style={{ height: "calc(100vh - 200px)" }}
      >
        {floorId == null ? (
          <div className="text-sm text-gray-500 p-8 border border-dashed border-gray-300 rounded-md">
            No floors yet.{" "}
            {isAdmin && "Click \u201c+ Add Floor\u201d to create one."}
          </div>
        ) : !planUrl ? (
          <UploadDropzone
            uploading={uploading}
            onFile={handleFileUpload}
            canUpload={isAdmin}
          />
        ) : (
          <FloorCanvas
            floorPlanUrl={planUrl}
            zones={allZones}
            mode={mode}
            drawingEnabled={drawingEnabled}
            selectedZoneId={selectedZoneId}
            onZoneClick={handleZoneClick}
            onZoneSelect={handleZoneSelect}
            onZoneCreated={handleZoneCreated}
          />
        )}
      </div>

      {/* EDIT MODE TOOLBAR */}
      {mode === "edit" && planUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-2 p-3 bg-white border border-gray-200 rounded-md">
          <button
            type="button"
            onClick={() => setDrawingEnabled((d) => !d)}
            className={`px-3 py-2 text-sm font-medium rounded-md border transition ${
              drawingEnabled
                ? "bg-cbc-blue text-white border-cbc-blue"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {drawingEnabled ? "Drawing… (dbl-click to finish)" : "Draw Zone"}
          </button>

          <button
            type="button"
            onClick={handleSaveZones}
            disabled={savingZones || pendingZones.length === 0}
            className="px-3 py-2 text-sm font-medium rounded-md border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >
            {savingZones
              ? "Saving…"
              : `Save Zones${
                  pendingZones.length ? ` (${pendingZones.length})` : ""
                }`}
          </button>

          <button
            type="button"
            onClick={handleClearSelected}
            disabled={selectedZoneId == null}
            className="px-3 py-2 text-sm font-medium rounded-md border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >
            Clear Selected
          </button>

          <div className="ml-2 flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Type
            </span>
            <select
              value={defaultZoneType}
              onChange={(e) => setDefaultZoneType(e.target.value as UnitType)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            >
              <option value="office">Office</option>
              <option value="meeting_room">Meeting Room</option>
              <option value="hot_desk">Hot Desk</option>
              <option value="open_space">Open Space</option>
            </select>
          </div>
        </div>
      )}

      {/* STATUS LEGEND + STATS */}
      <div className="mt-4 space-y-2 text-xs text-gray-600">
        {/* Row 1: status fills */}
        <div className="flex flex-wrap items-center gap-5">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold w-14">
            Status
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border border-green-600"
              style={{ backgroundColor: "rgba(34, 197, 94, 0.45)" }}
            />
            Occupied
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border border-red-600"
              style={{ backgroundColor: "rgba(239, 68, 68, 0.45)" }}
            />
            Vacant
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border border-yellow-600"
              style={{ backgroundColor: "rgba(234, 179, 8, 0.45)" }}
            />
            Reserved
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border border-gray-500"
              style={{ backgroundColor: "rgba(156, 163, 175, 0.20)" }}
            />
            Unmapped
          </span>

          <span className="font-medium text-gray-800 ml-2">
            {occupiedCount} of {totalUnits} units occupied
            {totalUnits > 0 && (
              <span className="text-gray-500 ml-1">
                ({Math.round((occupiedCount / totalUnits) * 100)}%)
              </span>
            )}
          </span>

          {building && (
            <span className="ml-auto text-gray-500">
              {building.name} · {building.address}
            </span>
          )}
        </div>

        {/* Row 2: type borders */}
        <div className="flex flex-wrap items-center gap-5">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold w-14">
            Type
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm bg-white"
              style={{ border: "2px solid #003DA5" }}
            />
            Office
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm bg-white"
              style={{ border: "2px solid #7C3AED" }}
            />
            Meeting Room
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm bg-white"
              style={{ border: "2px solid #0891B2" }}
            />
            Hot Desk
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm bg-white"
              style={{ border: "2px solid #059669" }}
            />
            Open Space
          </span>
        </div>
      </div>

      {/* MODALS / PANELS */}
      <AddFloorModal
        open={addFloorOpen}
        submitting={addFloorSubmitting}
        onClose={() => setAddFloorOpen(false)}
        onSubmit={handleAddFloor}
      />

      <ZoneNameModal
        open={zoneModalOpen}
        defaultType={defaultZoneType}
        submitting={zoneModalSubmitting}
        onClose={handleZoneFormCancel}
        onSubmit={handleZoneFormSubmit}
      />

      <ZonePanel
        unit={selectedUnit}
        open={panelOpen}
        role={role}
        loading={panelLoading}
        saving={panelSaving}
        onClose={() => setPanelOpen(false)}
        onSave={handleUnitSave}
      />

      <ConfirmModal
        open={deleteFloorOpen}
        title="Delete floor"
        message={
          currentFloor
            ? `Permanently delete "${
                currentFloor.name ?? `Floor ${currentFloor.number}`
              }" and all of its zones? Units linked to this floor will remain.`
            : "Delete this floor?"
        }
        confirmLabel="Delete"
        destructive
        submitting={deleteFloorSubmitting}
        onCancel={() => setDeleteFloorOpen(false)}
        onConfirm={handleDeleteFloor}
      />
    </div>
  );
}

// ── Inline upload dropzone ────────────────────────────────────────────────

function UploadDropzone({
  uploading,
  onFile,
  canUpload,
}: {
  uploading: boolean;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
  canUpload: boolean;
}) {
  return (
    <label
      className={`flex flex-col items-center justify-center h-80 border-2 border-dashed rounded-md text-gray-500 ${
        canUpload
          ? "border-gray-300 hover:border-cbc-blue hover:text-cbc-blue cursor-pointer"
          : "border-gray-200 cursor-not-allowed opacity-60"
      }`}
    >
      <div className="text-4xl mb-2">⬆</div>
      <div className="text-sm font-medium">
        {uploading
          ? "Uploading…"
          : canUpload
          ? "Drop PNG or PDF here, or click to upload"
          : "No floor plan uploaded yet"}
      </div>
      {canUpload && (
        <input
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          onChange={onFile}
          className="hidden"
          disabled={uploading}
        />
      )}
    </label>
  );
}
