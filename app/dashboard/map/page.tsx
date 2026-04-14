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
  Resource,
  UserRole,
  Zone,
} from "@/lib/types";
import type { FloorCanvasHandle } from "@/components/FloorCanvas";
import ZonePanel, { ResourcePatchPayload } from "@/components/ZonePanel";
import AddFloorModal from "@/components/AddFloorModal";
import ZoneNameModal from "@/components/ZoneNameModal";
import ConfirmModal from "@/components/ConfirmModal";

const FloorCanvas = dynamic(() => import("@/components/FloorCanvas"), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-gray-500 p-8">Loading canvas…</div>
  ),
});

type Mode = "view" | "edit" | "history";

const BUILDING_ID = 1;

export default function MapPage() {
  const [role, setRole] = useState<UserRole | undefined>(undefined);
  useEffect(() => {
    setRole(Cookies.get(ROLE_COOKIE) as UserRole | undefined);
  }, []);
  const isAdmin = role === "admin" || role === "manager";

  const [floors, setFloors] = useState<Floor[]>([]);
  const [floorId, setFloorId] = useState<number | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);

  const [savedZones, setSavedZones] = useState<Zone[]>([]);
  const [pendingZones, setPendingZones] = useState<Zone[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelSaving, setPanelSaving] = useState(false);

  const [addFloorOpen, setAddFloorOpen] = useState(false);
  const [addFloorSubmitting, setAddFloorSubmitting] = useState(false);

  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneModalSubmitting, setZoneModalSubmitting] = useState(false);
  const pendingPolygonPointsRef = useRef<Point[] | null>(null);

  // Re-assign mode: editing an existing zone's resource link
  const [reassignZone, setReassignZone] = useState<Zone | null>(null);

  const [renamingFloorId, setRenamingFloorId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [deleteFloorOpen, setDeleteFloorOpen] = useState(false);
  const [deleteFloorSubmitting, setDeleteFloorSubmitting] = useState(false);

  const resourceCacheRef = useRef<Map<number, Resource>>(new Map());
  const floorCanvasRef = useRef<FloorCanvasHandle>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [mode, setMode] = useState<Mode>("view");
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [savingZones, setSavingZones] = useState(false);

  const [historyDate, setHistoryDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ── Building ───────────────────────────────────────────────────────────
  useEffect(() => {
    api
      .get<Building[]>("/buildings/")
      .then((res) =>
        setBuilding(res.data.find((b) => b.id === BUILDING_ID) ?? null)
      )
      .catch((e) => setError(e?.message || "Failed to load building"));
  }, []);

  // ── Floors ─────────────────────────────────────────────────────────────
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

  // ── Floor data: zones (live) or snapshot (history) ─────────────────────
  const loadFloorData = useCallback(
    async (fid: number, viewMode: Mode, date: string) => {
      try {
        const rRes = await api.get<Resource[]>("/resources", {
          params: { building_id: BUILDING_ID, floor_id: fid },
        });
        setResources(rRes.data);
        rRes.data.forEach((r) => resourceCacheRef.current.set(r.id, r));

        const path =
          viewMode === "history"
            ? `/buildings/${BUILDING_ID}/floors/${fid}/snapshot`
            : `/buildings/${BUILDING_ID}/floors/${fid}/zones`;
        const params = viewMode === "history" ? { date } : undefined;

        const zRes = await api.get<Zone[]>(path, { params });
        setSavedZones(zRes.data);
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
      setResources([]);
      return;
    }
    loadFloorData(floorId, mode, historyDate);
  }, [floorId, mode, historyDate, loadFloorData]);

  // ── Per-resource cache helper ───────────────────────────────────────────
  const getResource = useCallback(async (id: number): Promise<Resource | null> => {
    const cached = resourceCacheRef.current.get(id);
    if (cached) return cached;
    try {
      const res = await api.get<Resource>(`/resources/${id}`);
      resourceCacheRef.current.set(id, res.data);
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

  const occupiedCount = useMemo(
    () => resources.filter((r) => r.status === "occupied").length,
    [resources]
  );
  const totalResources = resources.length;

  // ── Handlers: zone click / select ───────────────────────────────────────
  async function handleZoneClick(zone: Zone) {
    if (zone.resource_id == null) return;
    const cached = resourceCacheRef.current.get(zone.resource_id) ?? null;
    setSelectedResource(cached);
    setPanelOpen(true);
    setPanelLoading(true);
    const fresh = await getResource(zone.resource_id);
    setSelectedResource(fresh);
    setPanelLoading(false);
  }

  function handleZoneSelect(zone: Zone) {
    setSelectedZoneId(zone.id);
    if (zone.resource_id != null) {
      // Zone has a resource → open re-assign modal
      setReassignZone(zone);
      setZoneModalOpen(true);
    } else {
      // Zone is unmapped → open link modal (same as drawing a new zone,
      // but targeting this existing zone instead of pending points)
      setReassignZone(zone);
      setZoneModalOpen(true);
    }
  }

  // ── Add / rename / delete floor ─────────────────────────────────────────
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

  async function handleDeleteFloorPlanOnly() {
    if (floorId == null) return;
    setDeleteFloorSubmitting(true);
    try {
      await api.delete(`/buildings/${BUILDING_ID}/floors/${floorId}/plan`);
      setDeleteFloorOpen(false);
      await loadFloors(floorId);
    } catch (e) {
      setError((e as Error)?.message || "Failed to delete floor plan");
    } finally {
      setDeleteFloorSubmitting(false);
    }
  }

  async function handleDeleteFloor() {
    if (floorId == null) return;
    setDeleteFloorSubmitting(true);
    try {
      await api.delete(`/buildings/${BUILDING_ID}/floors/${floorId}`);
      setDeleteFloorOpen(false);
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

  // ── Upload ──────────────────────────────────────────────────────────────
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
      await loadFloors(floorId);
    } catch (err) {
      setError((err as Error)?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // ── Draw → link to resource ────────────────────────────────────────────
  function handleZoneCreated(points: Point[]) {
    pendingPolygonPointsRef.current = points;
    setZoneModalOpen(true);
  }

  async function handleZoneLinked(resourceId: number) {
    if (!pendingPolygonPointsRef.current || floorId == null) return;
    setZoneModalSubmitting(true);
    try {
      // Make sure we have the resource details (cache + state)
      const fresh = await getResource(resourceId);
      if (fresh) {
        setResources((prev) => {
          const without = prev.filter((r) => r.id !== fresh.id);
          return [...without, fresh];
        });
      }

      const tempId = -(Date.now() % 1_000_000);
      const newZone: Zone = {
        id: tempId,
        floor_id: floorId,
        resource_id: resourceId,
        points: pendingPolygonPointsRef.current,
        label: fresh?.name ?? null,
        resource_type: fresh?.resource_type ?? null,
        status: fresh?.status ?? null,
      };
      // Auto-save immediately: combine current zones + new zone and PUT to server
      const allCurrent = [...savedZones, ...pendingZones, newZone];
      await saveAllZonesToServer(allCurrent);

      pendingPolygonPointsRef.current = null;
      setZoneModalOpen(false);
    } catch (e) {
      setError((e as Error)?.message || "Failed to link zone");
    } finally {
      setZoneModalSubmitting(false);
    }
  }

  function handleZoneFormCancel() {
    pendingPolygonPointsRef.current = null;
    setReassignZone(null);
    setZoneModalOpen(false);
  }

  async function handleReassignLinked(resourceId: number) {
    if (!reassignZone) return;
    setZoneModalSubmitting(true);
    try {
      const fresh = await getResource(resourceId);
      // Update zone and auto-save immediately
      const updatedZones = savedZones.map((z) =>
        z.id === reassignZone.id
          ? {
              ...z,
              resource_id: resourceId,
              label: fresh?.name ?? z.label,
              resource_type: fresh?.resource_type ?? z.resource_type,
              status: fresh?.status ?? z.status,
            }
          : z
      );
      await saveAllZonesToServer([...updatedZones, ...pendingZones]);
      setReassignZone(null);
      setZoneModalOpen(false);
    } catch (e) {
      setError((e as Error)?.message || "Failed to reassign zone");
    } finally {
      setZoneModalSubmitting(false);
    }
  }

  async function handleUnlinkZone() {
    if (!reassignZone) return;
    const updatedZones = savedZones.map((z) =>
      z.id === reassignZone.id
        ? { ...z, resource_id: null, label: null, resource_type: null, status: null }
        : z
    );
    try {
      await saveAllZonesToServer([...updatedZones, ...pendingZones]);
    } catch (e) {
      setError((e as Error)?.message || "Failed to unlink zone");
    }
    setReassignZone(null);
    setZoneModalOpen(false);
  }

  // ── Save helpers ────────────────────────────────────────────────────────
  async function saveAllZonesToServer(zones: Zone[]) {
    if (floorId == null) return;
    const payload = zones.map((z) => ({
      resource_id: z.resource_id,
      points: z.points,
      label: z.label,
    }));
    await api.put(
      `/buildings/${BUILDING_ID}/floors/${floorId}/zones`,
      payload
    );
    await loadFloorData(floorId, mode, historyDate);
    setHasUnsavedChanges(false);
    setPendingZones([]);
    setSelectedZoneId(null);
  }

  async function handleSaveZones() {
    if (floorId == null) return;
    setSavingZones(true);
    try {
      await saveAllZonesToServer(allZones);
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
    setHasUnsavedChanges(true);
  }

  function handleModeChange(next: Mode) {
    if (hasUnsavedChanges && next !== mode) {
      const ok = window.confirm(
        "You have unsaved zone changes. Discard and switch mode?"
      );
      if (!ok) return;
      setHasUnsavedChanges(false);
    }
    setMode(next);
    if (next !== "edit") {
      setDrawingEnabled(false);
      setSelectedZoneId(null);
    }
  }

  // ── PATCH resource from panel ──────────────────────────────────────────
  async function handleResourceSave(
    id: number,
    patch: ResourcePatchPayload
  ): Promise<Resource | null> {
    setPanelSaving(true);
    try {
      const res = await api.patch<Resource>(`/resources/${id}`, patch);
      const fresh = res.data;
      resourceCacheRef.current.set(fresh.id, fresh);
      setResources((prev) => prev.map((r) => (r.id === fresh.id ? fresh : r)));
      setSelectedResource(fresh);
      // Immediately update zone labels in local state so the canvas
      // re-renders with the new name before loadFloorData round-trips.
      setSavedZones((prev) =>
        prev.map((z) =>
          z.resource_id === fresh.id
            ? { ...z, label: fresh.name, status: fresh.status, resource_type: fresh.resource_type }
            : z
        )
      );
      if (floorId != null) {
        await loadFloorData(floorId, mode, historyDate);
      }
      return fresh;
    } catch (e) {
      setError((e as Error)?.message || "Failed to save resource");
      return null;
    } finally {
      setPanelSaving(false);
    }
  }

  const linkedResourceIds = useMemo(
    () =>
      allZones
        .map((z) => z.resource_id)
        .filter((id): id is number => id != null),
    [allZones]
  );

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

          {/* Export buttons — use fabric canvas export */}
          <button
            type="button"
            onClick={() => {
              const dataURL = floorCanvasRef.current?.exportPNG();
              if (!dataURL) { alert("No floor plan loaded"); return; }
              const link = document.createElement("a");
              link.download = `floor-plan-${floorId}-${dayjs().format("YYYY-MM-DD")}.png`;
              link.href = dataURL;
              link.click();
            }}
            className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            PNG
          </button>
          <button
            type="button"
            onClick={async () => {
              const dataURL = floorCanvasRef.current?.exportPNG();
              if (!dataURL) { alert("No floor plan loaded"); return; }
              // Load image to get natural dimensions
              const img = new window.Image();
              img.src = dataURL;
              await new Promise<void>((resolve) => { img.onload = () => resolve(); });
              const cW = img.naturalWidth;
              const cH = img.naturalHeight;
              const ratio = cW / cH;
              const { jsPDF } = await import("jspdf");
              const orientation = ratio >= 1 ? "landscape" : "portrait";
              const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
              const pw = pdf.internal.pageSize.getWidth();
              const ph = pdf.internal.pageSize.getHeight();
              const margin = 10;
              const maxW = pw - margin * 2;
              const maxH = ph - margin * 2;
              let imgW = maxW;
              let imgH = imgW / ratio;
              if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
              const x = (pw - imgW) / 2;
              const y = (ph - imgH) / 2;
              pdf.addImage(dataURL, "PNG", x, y, imgW, imgH);
              pdf.save(`floor-plan-${dayjs().format("YYYY-MM-DD")}.pdf`);
            }}
            className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            PDF
          </button>

          {/* History mode — date picker + quick buttons */}
          {mode === "history" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="date"
                value={historyDate || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setHistoryDate(e.target.value)}
                style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px", fontSize: 13 }}
              />
              {[
                { label: "Today", days: 0 },
                { label: "7d ago", days: -7 },
                { label: "30d ago", days: -30 },
              ].map(({ label, days }) => {
                const d = new Date();
                d.setDate(d.getDate() + days);
                return (
                  <button
                    key={label}
                    onClick={() => setHistoryDate(d.toISOString().slice(0, 10))}
                    style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 4, background: "white", cursor: "pointer", color: "#6b7280" }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
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
          <div className="floor-canvas-wrapper">
            <FloorCanvas
              ref={floorCanvasRef}
              floorPlanUrl={planUrl}
              zones={allZones}
              mode={mode}
              drawingEnabled={drawingEnabled}
              selectedZoneId={selectedZoneId}
              onZoneClick={handleZoneClick}
              onZoneSelect={handleZoneSelect}
              onZoneCreated={handleZoneCreated}
            />
          </div>
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
        </div>
      )}

      {/* STATUS LEGEND + STATS */}
      <div className="mt-4 space-y-2 text-xs text-gray-600">
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
            {occupiedCount} of {totalResources} resources occupied
            {totalResources > 0 && (
              <span className="text-gray-500 ml-1">
                ({Math.round((occupiedCount / totalResources) * 100)}%)
              </span>
            )}
          </span>

          {building && (
            <span className="ml-auto text-gray-500">
              {building.name} · {building.address}
            </span>
          )}
        </div>

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
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm bg-white"
              style={{ border: "2px solid #0EA5E9" }}
            />
            Amenity
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

      {floorId != null && (
        <ZoneNameModal
          open={zoneModalOpen}
          buildingId={BUILDING_ID}
          floorId={floorId}
          excludeResourceIds={linkedResourceIds}
          submitting={zoneModalSubmitting}
          currentResourceId={reassignZone?.resource_id}
          currentResourceName={reassignZone?.label}
          onClose={handleZoneFormCancel}
          onLinked={reassignZone ? handleReassignLinked : handleZoneLinked}
          onUnlink={reassignZone ? handleUnlinkZone : undefined}
        />
      )}

      <ZonePanel
        resource={selectedResource}
        open={panelOpen}
        role={role}
        loading={panelLoading}
        saving={panelSaving}
        onClose={() => setPanelOpen(false)}
        onSave={handleResourceSave}
      />

      {/* Delete floor options modal */}
      {deleteFloorOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
          onMouseDown={() => { if (!deleteFloorSubmitting) setDeleteFloorOpen(false); }}
        >
          <div
            style={{ background: "white", borderRadius: 12, padding: 28, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 600 }}>
              {currentFloor?.name ?? `Floor ${currentFloor?.number}`}
            </h3>

            {/* Option 1: Plan only */}
            <button
              onClick={handleDeleteFloorPlanOnly}
              disabled={deleteFloorSubmitting || !currentFloor?.floor_plan_url}
              style={{
                width: "100%", textAlign: "left", padding: 14, borderRadius: 8,
                border: "1px solid #e5e7eb", background: "white", cursor: "pointer",
                marginBottom: 10, opacity: deleteFloorSubmitting || !currentFloor?.floor_plan_url ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                Remove floor plan image only
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Keeps all zones, resources, and bookings. You can re-upload a new image.
              </div>
            </button>

            {/* Option 2: Full delete */}
            <button
              onClick={handleDeleteFloor}
              disabled={deleteFloorSubmitting}
              style={{
                width: "100%", textAlign: "left", padding: 14, borderRadius: 8,
                border: "1px solid #fca5a5", background: "#fef2f2", cursor: "pointer",
                opacity: deleteFloorSubmitting ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "#dc2626" }}>
                Delete floor and all data
              </div>
              <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4 }}>
                Permanently removes the floor, all zones, resources, and bookings. Cannot be undone.
              </div>
            </button>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteFloorOpen(false)}
                disabled={deleteFloorSubmitting}
                style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
