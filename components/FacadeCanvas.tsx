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

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Edit mode state
  const [drawing, setDrawing] = useState(false);
  const [editingZoneIdx, setEditingZoneIdx] = useState<number | null>(null);
  const [assignModal, setAssignModal] = useState<{ points: { x: number; y: number }[] } | null>(null);
  const [assignFloorId, setAssignFloorId] = useState<number | null>(null);
  const [assignLabel, setAssignLabel] = useState("");

  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const drawRectRef = useRef<any>(null);

  // ── Responsive scale helper ────────────────────────────────────────
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

  // ── Initialize canvas ──────────────────────────────────────────────
  useEffect(() => {
    let disposed = false;

    (async () => {
      const fabric = await import("fabric").then((m) => m.fabric);
      if (disposed) return;
      fabricLibRef.current = fabric;

      const el = canvasElRef.current!;
      const canvas = new fabric.Canvas(el, {
        selection: mode === "edit",
        preserveObjectStacking: true,
      });
      fabricCanvasRef.current = canvas;

      // Load facade image
      if (facadeImageUrl) {
        const url = facadeImageUrl.startsWith("http")
          ? facadeImageUrl
          : `${process.env.NEXT_PUBLIC_API_URL || ""}${facadeImageUrl}`;

        fabric.Image.fromURL(url, (img: any) => {
          if (disposed || !img) return;
          const w = img.width || 800;
          const h = img.height || 600;
          baseSizeRef.current = { width: w, height: h };
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

  // ── Render zones ───────────────────────────────────────────────────
  const renderZones = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;

    // Remove old zone objects
    const objs = canvas.getObjects().filter((o: any) => o._isFacadeZone || o._isFacadeLabel);
    objs.forEach((o: any) => canvas.remove(o));

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
          selectable: mode === "edit",
          evented: true,
          hasControls: mode === "edit",
          hasBorders: mode === "edit",
          lockRotation: true,
          _isFacadeZone: true,
          _zoneIdx: idx,
        }
      );

      canvas.add(poly);

      // Label text
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
  }, [mode]);

  // Re-render zones when data changes
  useEffect(() => {
    renderZones();
  }, [zones, renderZones]);

  // ── View mode: hover tooltip + click ───────────────────────────────
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    function handleMouseOver(e: any) {
      if (mode !== "view" || !e.target?._isFacadeZone) return;
      const zone = zonesRef.current[e.target._zoneIdx];
      if (!zone) return;
      e.target.set("opacity", 0.6);
      canvas.requestRenderAll();
    }

    function handleMouseOut(e: any) {
      if (mode !== "view" || !e.target?._isFacadeZone) return;
      const zone = zonesRef.current[e.target._zoneIdx];
      if (!zone) return;
      e.target.set("opacity", getOccOpacity(zone.vacancy?.occupancy_rate));
      canvas.requestRenderAll();
      setTooltip(null);
    }

    function handleMouseMove(e: any) {
      if (mode !== "view" || !e.target?._isFacadeZone) {
        setTooltip(null);
        return;
      }
      const zone = zonesRef.current[e.target._zoneIdx];
      if (!zone) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const ptr = canvas.getPointer(e.e, true);
      const v = zone.vacancy;
      const lines = [
        zone.floor_name || zone.label || `Floor ${zone.floor_number}`,
        v ? `${Math.round(v.occupancy_rate)}% occupied` : "No data",
        v ? `${v.occupied}/${v.total} ${v.unit_label}` : "",
      ].filter(Boolean).join("\n");
      setTooltip({ x: ptr.x + 12, y: ptr.y - 10, text: lines });
    }

    function handleClick(e: any) {
      if (!e.target?._isFacadeZone) return;
      const zone = zonesRef.current[e.target._zoneIdx];
      if (!zone) return;

      if (mode === "view") {
        onZoneClick?.(zone);
      } else if (mode === "edit") {
        setEditingZoneIdx(e.target._zoneIdx);
      }
    }

    canvas.on("mouse:over", handleMouseOver);
    canvas.on("mouse:out", handleMouseOut);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleClick);

    return () => {
      canvas.off("mouse:over", handleMouseOver);
      canvas.off("mouse:out", handleMouseOut);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleClick);
    };
  }, [mode, onZoneClick]);

  // ── Edit mode: rectangle drawing ──────────────────────────────────
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric || mode !== "edit") return;

    function handleMouseDown(e: any) {
      if (!drawing) return;
      const ptr = canvas.getPointer(e.e);
      drawStartRef.current = { x: ptr.x, y: ptr.y };
      const rect = new fabric.Rect({
        left: ptr.x,
        top: ptr.y,
        width: 0,
        height: 0,
        fill: "rgba(31,105,255,0.3)",
        stroke: "#1F69FF",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      drawRectRef.current = rect;
      canvas.add(rect);
    }

    function handleMouseMoveEdit(e: any) {
      if (!drawing || !drawStartRef.current || !drawRectRef.current) return;
      const ptr = canvas.getPointer(e.e);
      const start = drawStartRef.current;
      const left = Math.min(start.x, ptr.x);
      const top = Math.min(start.y, ptr.y);
      const width = Math.abs(ptr.x - start.x);
      const height = Math.abs(ptr.y - start.y);
      drawRectRef.current.set({ left, top, width, height });
      canvas.requestRenderAll();
    }

    function handleMouseUpEdit(e: any) {
      if (!drawing || !drawStartRef.current || !drawRectRef.current) return;
      const rect = drawRectRef.current;
      const w = rect.width;
      const h = rect.height;
      canvas.remove(rect);
      drawRectRef.current = null;

      if (w < 20 || h < 20) {
        drawStartRef.current = null;
        return;
      }

      const left = rect.left;
      const top = rect.top;
      const points = [
        { x: left, y: top },
        { x: left + w, y: top },
        { x: left + w, y: top + h },
        { x: left, y: top + h },
      ];

      drawStartRef.current = null;
      setDrawing(false);
      setAssignModal({ points });
      setAssignFloorId(floors[0]?.id ?? null);
      setAssignLabel(floors[0] ? `${floors[0].number}F` : "");
    }

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMoveEdit);
    canvas.on("mouse:up", handleMouseUpEdit);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMoveEdit);
      canvas.off("mouse:up", handleMouseUpEdit);
    };
  }, [mode, drawing, floors]);

  // ── Edit mode: update zone positions after drag ────────────────────
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || mode !== "edit") return;

    function handleModified(e: any) {
      const obj = e.target;
      if (!obj?._isFacadeZone) return;
      const idx = obj._zoneIdx;
      const zone = zonesRef.current[idx];
      if (!zone) return;

      // Get transformed points
      const matrix = obj.calcTransformMatrix();
      const fabric = fabricLibRef.current;
      const newPoints = obj.points.map((p: any) => {
        const transformed = fabric.util.transformPoint(
          new fabric.Point(p.x - obj.pathOffset.x, p.y - obj.pathOffset.y),
          matrix
        );
        return { x: Math.round(transformed.x), y: Math.round(transformed.y) };
      });

      const updated = [...zonesRef.current];
      updated[idx] = { ...zone, points: newPoints };
      onZonesChange?.(updated);
    }

    canvas.on("object:modified", handleModified);
    return () => { canvas.off("object:modified", handleModified); };
  }, [mode, onZonesChange]);

  // ── Resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => applyResponsiveScale();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [applyResponsiveScale]);

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
    const updated = [...zonesRef.current, newZone];
    onZonesChange?.(updated);
    setAssignModal(null);
  }

  function handleDeleteZone(idx: number) {
    const updated = zonesRef.current.filter((_, i) => i !== idx);
    onZonesChange?.(updated);
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
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={() => { setDrawing(!drawing); setEditingZoneIdx(null); }}
            style={{
              padding: "6px 14px",
              border: drawing ? "2px solid #1F69FF" : "1px solid #d1d5db",
              borderRadius: 6,
              background: drawing ? "#eff6ff" : "white",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              color: drawing ? "#1F69FF" : "#374151",
            }}
          >
            {drawing ? "Drawing... (drag on facade)" : "+ Add Zone"}
          </button>
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

      {/* Assign floor modal (after drawing) */}
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
