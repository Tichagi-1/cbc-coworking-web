"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Floor } from "@/lib/types";

export interface FacadeVacancy {
  metric: string;
  total: number;
  occupied: number;
  vacant: number;
  occupancy_rate: number;
  unit_label: string;
}

export interface FacadeZoneData {
  id?: number;
  floor_id: number;
  floor_name?: string;
  floor_number?: number;
  points: { x: number; y: number }[];
  label?: string | null;
  vacancy?: FacadeVacancy;
}

interface Props {
  facadeImageUrl: string | null;
  zones: FacadeZoneData[];
  mode: "view" | "edit";
  floors: Floor[];
  onZoneClick?: (zone: FacadeZoneData) => void;
  onZonesChange?: (zones: FacadeZoneData[]) => void;
}

function getOccColor(rate: number | undefined): string {
  if (rate == null) return "#9CA3AF";
  if (rate >= 70) return "#22C55E";
  if (rate >= 40) return "#EAB308";
  return "#EF4444";
}

function getOccOpacity(rate: number | undefined): number {
  return rate != null ? 0.4 : 0.3;
}

export default function FacadeCanvas({
  facadeImageUrl,
  zones,
  mode,
  floors,
  onZoneClick,
  onZonesChange,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricLibRef = useRef<any>(null);
  const baseSizeRef = useRef({ width: 800, height: 600 });
  const zonesRef = useRef<FacadeZoneData[]>(zones);
  zonesRef.current = zones;

  // Stable refs for callbacks
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onZoneClickRef = useRef(onZoneClick);
  onZoneClickRef.current = onZoneClick;
  const onZonesChangeRef = useRef(onZonesChange);
  onZonesChangeRef.current = onZonesChange;
  const floorsRef = useRef(floors);
  floorsRef.current = floors;

  // Tooltip
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Drawing state — all refs to avoid stale closures
  const drawingModeRef = useRef(false);
  const [drawingUI, setDrawingUI] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const drawingPointsRef = useRef<{ x: number; y: number }[]>([]);
  const drawingMarkersRef = useRef<any[]>([]); // dots + lines

  // Edit zone panel
  const [editingZoneIdx, setEditingZoneIdx] = useState<number | null>(null);

  // Assign modal
  const [assignModal, setAssignModal] = useState<{ points: { x: number; y: number }[] } | null>(null);
  const [assignFloorId, setAssignFloorId] = useState<number | null>(null);
  const [assignLabel, setAssignLabel] = useState("");

  // ── Responsive scale ───────────────────────────────────────────────
  const applyResponsiveScale = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const containerW = wrapper.clientWidth;
    const base = baseSizeRef.current;
    const scale = Math.min(containerW / base.width, 1);
    canvas.setWidth(base.width * scale);
    canvas.setHeight(base.height * scale);
    canvas.setZoom(scale);
    canvas.requestRenderAll();
  }, []);

  // ── Render zones ───────────────────────────────────────────────────
  const renderZones = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;

    const objs = canvas.getObjects().filter((o: any) => o._isFacadeZone || o._isFacadeLabel);
    objs.forEach((o: any) => canvas.remove(o));

    const curMode = modeRef.current;
    const isDrawing = drawingModeRef.current;

    zonesRef.current.forEach((zone, idx) => {
      if (!zone.points || zone.points.length < 3) return;

      const occRate = zone.vacancy?.occupancy_rate;
      const fillColor = getOccColor(occRate);
      const fillOpacity = getOccOpacity(occRate);

      const poly = new fabric.Polygon(
        zone.points.map((p: any) => ({ x: p.x, y: p.y })),
        {
          fill: fillColor,
          opacity: fillOpacity,
          stroke: "white",
          strokeWidth: 2,
          selectable: curMode === "edit" && !isDrawing,
          evented: !isDrawing,
          hasControls: curMode === "edit" && !isDrawing,
          hasBorders: curMode === "edit" && !isDrawing,
          lockRotation: true,
          _isFacadeZone: true,
          _zoneIdx: idx,
        }
      );
      canvas.add(poly);

      // Label
      const cx = zone.points.reduce((s: number, p: any) => s + p.x, 0) / zone.points.length;
      const cy = zone.points.reduce((s: number, p: any) => s + p.y, 0) / zone.points.length;
      const labelStr = zone.label || "";
      const pctStr = occRate != null ? ` · ${Math.round(occRate)}%` : "";

      const text = new fabric.Text(labelStr + pctStr, {
        left: cx,
        top: cy,
        fontSize: 14,
        fontWeight: "bold",
        fontFamily: "sans-serif",
        fill: "white",
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.7)", blur: 4, offsetX: 1, offsetY: 1 }),
        _isFacadeLabel: true,
      });
      canvas.add(text);
    });

    canvas.requestRenderAll();
  }, []);

  useEffect(() => {
    renderZones();
  }, [zones, mode, renderZones]);

  // ── Helper: clear temp drawing objects ──────────────────────────────
  function clearDrawingState() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    // Remove preview line
    const preview = canvas.getObjects().find((o: any) => o._isPreviewLine);
    if (preview) canvas.remove(preview);
    // Remove dots + segment lines
    drawingMarkersRef.current.forEach((m: any) => canvas.remove(m));
    drawingMarkersRef.current = [];
    drawingPointsRef.current = [];
    setPointCount(0);
    canvas.requestRenderAll();
  }

  // ── Initialize canvas + all mouse handlers ─────────────────────────
  useEffect(() => {
    let disposed = false;

    (async () => {
      const fabric = await import("fabric").then((m) => m.fabric);
      if (disposed) return;
      fabricLibRef.current = fabric;

      const el = canvasElRef.current!;
      const canvas = new fabric.Canvas(el, {
        selection: false,
        preserveObjectStacking: true,
        fireRightClick: false,
      });
      fabricCanvasRef.current = canvas;

      // ── mouse:over (view tooltip highlight) ────────────────────
      canvas.on("mouse:over", (e: any) => {
        if (modeRef.current !== "view" || !e.target?._isFacadeZone) return;
        e.target.set("opacity", 0.6);
        canvas.requestRenderAll();
      });

      // ── mouse:out ──────────────────────────────────────────────
      canvas.on("mouse:out", (e: any) => {
        if (modeRef.current !== "view" || !e.target?._isFacadeZone) return;
        const zone = zonesRef.current[e.target._zoneIdx];
        if (!zone) return;
        e.target.set("opacity", getOccOpacity(zone.vacancy?.occupancy_rate));
        canvas.requestRenderAll();
        setTooltip(null);
      });

      // ── mouse:move (tooltip + drawing preview line) ────────────
      canvas.on("mouse:move", (e: any) => {
        // Drawing preview line from last point to cursor
        if (drawingModeRef.current && drawingPointsRef.current.length > 0) {
          const prev = canvas.getObjects().find((o: any) => o._isPreviewLine);
          if (prev) canvas.remove(prev);

          const ptr = canvas.getPointer(e.e);
          const last = drawingPointsRef.current[drawingPointsRef.current.length - 1];
          const line = new fabric.Line([last.x, last.y, ptr.x, ptr.y], {
            stroke: "#1F69FF",
            strokeWidth: 1,
            strokeDashArray: [4, 4],
            selectable: false,
            evented: false,
            opacity: 0.6,
            _isPreviewLine: true,
          } as any);
          canvas.add(line);
          canvas.requestRenderAll();
          return;
        }

        // View tooltip
        if (modeRef.current !== "view" || !e.target?._isFacadeZone) {
          setTooltip(null);
          return;
        }
        const zone = zonesRef.current[e.target._zoneIdx];
        if (!zone) return;
        const ptr = canvas.getPointer(e.e, true);
        const v = zone.vacancy;
        const lines = [
          zone.floor_name || zone.label || `Floor ${zone.floor_number}`,
          v ? `${Math.round(v.occupancy_rate)}% occupied` : "No data",
          v ? `${v.occupied}/${v.total} ${v.unit_label}` : "",
        ].filter(Boolean).join("\n");
        setTooltip({ x: ptr.x + 12, y: ptr.y - 10, text: lines });
      });

      // ── mouse:down (place point or select zone) ────────────────
      canvas.on("mouse:down", (e: any) => {
        if (drawingModeRef.current && modeRef.current === "edit") {
          // Place a polygon point
          const ptr = canvas.getPointer(e.e);
          const point = { x: Math.round(ptr.x), y: Math.round(ptr.y) };
          const points = drawingPointsRef.current;
          points.push(point);
          setPointCount(points.length);

          // Draw dot
          const dot = new fabric.Circle({
            left: point.x - 4,
            top: point.y - 4,
            radius: 4,
            fill: "#1F69FF",
            stroke: "#FFFFFF",
            strokeWidth: 1,
            selectable: false,
            evented: false,
            _isDrawingMarker: true,
          } as any);
          canvas.add(dot);
          drawingMarkersRef.current.push(dot);

          // Draw line from previous point
          if (points.length > 1) {
            const prev = points[points.length - 2];
            const seg = new fabric.Line([prev.x, prev.y, point.x, point.y], {
              stroke: "#1F69FF",
              strokeWidth: 2,
              strokeDashArray: [5, 3],
              selectable: false,
              evented: false,
              _isDrawingMarker: true,
            } as any);
            canvas.add(seg);
            drawingMarkersRef.current.push(seg);
          }

          canvas.requestRenderAll();
          return;
        }

        // Non-drawing: click on zone
        if (e.target?._isFacadeZone) {
          const zone = zonesRef.current[e.target._zoneIdx];
          if (!zone) return;
          if (modeRef.current === "view") {
            onZoneClickRef.current?.(zone);
          } else if (modeRef.current === "edit") {
            setEditingZoneIdx(e.target._zoneIdx);
          }
        }
      });

      // ── mouse:dblclick (finish polygon) ────────────────────────
      canvas.on("mouse:dblclick", () => {
        if (!drawingModeRef.current || modeRef.current !== "edit") return;

        let points = [...drawingPointsRef.current];

        // Double-click fires two mouse:down first, adding a duplicate point.
        // Remove it if last two points are within 10px of each other.
        if (points.length >= 2) {
          const a = points[points.length - 1];
          const b = points[points.length - 2];
          if (Math.hypot(a.x - b.x, a.y - b.y) < 10) {
            points.pop();
          }
        }

        if (points.length < 3) {
          // Not enough points — cancel
          clearDrawingState();
          return;
        }

        // Clean up temp markers + preview line
        const preview = canvas.getObjects().find((o: any) => o._isPreviewLine);
        if (preview) canvas.remove(preview);
        drawingMarkersRef.current.forEach((m: any) => canvas.remove(m));
        drawingMarkersRef.current = [];
        drawingPointsRef.current = [];
        setPointCount(0);
        canvas.requestRenderAll();

        // Exit drawing mode
        drawingModeRef.current = false;
        setDrawingUI(false);
        canvas.defaultCursor = "default";

        // Open assign modal
        const fl = floorsRef.current;
        setAssignModal({ points });
        setAssignFloorId(fl[0]?.id ?? null);
        setAssignLabel(fl[0] ? `${fl[0].number}F` : "");
      });

      // ── object:modified (drag existing zones) ──────────────────
      canvas.on("object:modified", (e: any) => {
        const obj = e.target;
        if (!obj?._isFacadeZone || modeRef.current !== "edit") return;
        const idx = obj._zoneIdx;
        const zone = zonesRef.current[idx];
        if (!zone) return;

        const matrix = obj.calcTransformMatrix();
        const newPoints = obj.points.map((p: any) => {
          const transformed = fabric.util.transformPoint(
            new fabric.Point(p.x - obj.pathOffset.x, p.y - obj.pathOffset.y),
            matrix
          );
          return { x: Math.round(transformed.x), y: Math.round(transformed.y) };
        });

        const updated = [...zonesRef.current];
        updated[idx] = { ...zone, points: newPoints };
        onZonesChangeRef.current?.(updated);
      });

      // ── Load facade image ──────────────────────────────────────
      if (facadeImageUrl) {
        const url = facadeImageUrl.startsWith("http")
          ? facadeImageUrl
          : `${process.env.NEXT_PUBLIC_API_URL || ""}${facadeImageUrl}`;

        fabric.Image.fromURL(url, (img: any) => {
          if (disposed || !img) return;
          baseSizeRef.current = { width: img.width || 800, height: img.height || 600 };
          canvas.setBackgroundImage(img, () => {
            applyResponsiveScale();
            renderZones();
          }, { scaleX: 1, scaleY: 1 });
        }, { crossOrigin: "anonymous" });
      } else {
        applyResponsiveScale();
      }
    })();

    return () => {
      disposed = true;
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facadeImageUrl]);

  // ── Resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => applyResponsiveScale();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [applyResponsiveScale]);

  // ── Start / stop / cancel drawing mode ─────────────────────────────
  function startDrawingMode() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    drawingModeRef.current = true;
    drawingPointsRef.current = [];
    drawingMarkersRef.current = [];
    setDrawingUI(true);
    setPointCount(0);
    setEditingZoneIdx(null);
    canvas.selection = false;
    canvas.defaultCursor = "crosshair";
    canvas.forEachObject((obj: any) => {
      obj.selectable = false;
      obj.evented = false;
    });
    canvas.requestRenderAll();
  }

  function cancelDrawingMode() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    clearDrawingState();
    drawingModeRef.current = false;
    setDrawingUI(false);
    canvas.defaultCursor = "default";
    canvas.forEachObject((obj: any) => {
      if (obj._isFacadeZone) {
        obj.selectable = true;
        obj.evented = true;
      }
    });
    canvas.requestRenderAll();
  }

  // ── Assign modal handlers ──────────────────────────────────────────
  function handleAssignSave() {
    if (!assignModal || assignFloorId == null) return;
    const floor = floors.find((f) => f.id === assignFloorId);
    const newZone: FacadeZoneData = {
      floor_id: assignFloorId,
      floor_name: floor?.name || `Floor ${floor?.number}`,
      floor_number: floor?.number ?? 0,
      points: assignModal.points,
      label: assignLabel || `${floor?.number ?? ""}F`,
    };
    onZonesChange?.([...zonesRef.current, newZone]);
    setAssignModal(null);
  }

  function handleDeleteZone(idx: number) {
    onZonesChange?.(zonesRef.current.filter((_, i) => i !== idx));
    setEditingZoneIdx(null);
  }

  function handleEditZoneFloor(idx: number, floorId: number) {
    const floor = floors.find((f) => f.id === floorId);
    const updated = [...zonesRef.current];
    updated[idx] = {
      ...updated[idx],
      floor_id: floorId,
      floor_name: floor?.name || `Floor ${floor?.number}`,
      floor_number: floor?.number ?? 0,
    };
    onZonesChange?.(updated);
  }

  function handleEditZoneLabel(idx: number, label: string) {
    const updated = [...zonesRef.current];
    updated[idx] = { ...updated[idx], label };
    onZonesChange?.(updated);
  }

  const editingZone = editingZoneIdx != null ? zones[editingZoneIdx] : null;

  return (
    <div style={{ position: "relative" }}>
      <div ref={wrapperRef} style={{ maxWidth: 800, width: "100%" }}>
        <canvas ref={canvasElRef} />
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            background: "rgba(10, 23, 48, 0.9)",
            color: "white",
            fontSize: 13,
            padding: "8px 12px",
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 50,
            whiteSpace: "pre-line",
            lineHeight: 1.4,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Edit mode toolbar */}
      {mode === "edit" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
          {!drawingUI ? (
            <button
              onClick={startDrawingMode}
              style={{
                padding: "6px 14px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "white",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                color: "#374151",
              }}
            >
              + Add Zone
            </button>
          ) : (
            <>
              <span style={{ fontSize: 13, color: "#1F69FF", fontWeight: 500 }}>
                Click to place points, double-click to finish
              </span>
              {pointCount > 0 && (
                <span style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>
                  {pointCount} point{pointCount !== 1 ? "s" : ""}
                </span>
              )}
              <button
                onClick={cancelDrawingMode}
                style={{
                  padding: "4px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  background: "white",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* Edit zone panel */}
      {mode === "edit" && editingZone && editingZoneIdx != null && (
        <div style={{
          marginTop: 10,
          padding: 14,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 2 }}>Floor</label>
            <select
              value={editingZone.floor_id}
              onChange={(e) => handleEditZoneFloor(editingZoneIdx, Number(e.target.value))}
              style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13 }}
            >
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name || `Floor ${f.number}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 2 }}>Label</label>
            <input
              value={editingZone.label || ""}
              onChange={(e) => handleEditZoneLabel(editingZoneIdx, e.target.value)}
              style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, width: 80 }}
            />
          </div>
          <button
            onClick={() => handleDeleteZone(editingZoneIdx)}
            style={{ padding: "4px 12px", border: "1px solid #fecaca", borderRadius: 4, background: "white", color: "#dc2626", fontSize: 13, cursor: "pointer", marginTop: 16 }}
          >
            Delete
          </button>
          <button
            onClick={() => setEditingZoneIdx(null)}
            style={{ padding: "4px 12px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 13, cursor: "pointer", marginTop: 16 }}
          >
            Done
          </button>
        </div>
      )}

      {/* Assign floor modal */}
      {assignModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setAssignModal(null); }}
        >
          <div style={{ background: "white", borderRadius: 12, padding: 24, maxWidth: 360, width: "100%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0A1730", marginBottom: 16 }}>Assign zone to floor</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Floor</label>
              <select
                value={assignFloorId ?? ""}
                onChange={(e) => {
                  const fid = Number(e.target.value);
                  setAssignFloorId(fid);
                  const f = floors.find((fl) => fl.id === fid);
                  if (f) setAssignLabel(`${f.number}F`);
                }}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}
              >
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>{f.name || `Floor ${f.number}`}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Label</label>
              <input
                value={assignLabel}
                onChange={(e) => setAssignLabel(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setAssignModal(null)}
                style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 14, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSave}
                disabled={!assignFloorId}
                style={{ padding: "8px 16px", background: "#1F69FF", color: "white", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
