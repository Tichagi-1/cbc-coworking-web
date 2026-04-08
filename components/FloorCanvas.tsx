"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// fabric@5 has no upstream d.ts; localize `any` to this file.

import { useEffect, useRef } from "react";
import type { Point, Zone, UnitStatus } from "@/lib/types";

type Mode = "view" | "edit" | "history";

interface FloorCanvasProps {
  floorPlanUrl: string | null;
  zones: Zone[];
  mode: Mode;
  /** When true (edit mode only), clicks add polygon points. */
  drawingEnabled?: boolean;
  /** Highlight this zone (by id, including negative pending ids). */
  selectedZoneId?: number | null;

  /** View mode: clicking a polygon. */
  onZoneClick?: (zone: Zone) => void;
  /** Edit mode: clicking a polygon (selects). */
  onZoneSelect?: (zone: Zone) => void;
  /** Edit mode: polygon finalized via double-click. */
  onZoneCreated?: (points: Point[]) => void;
}

const STATUS_COLORS: Record<UnitStatus, string> = {
  occupied: "#22C55E",
  vacant: "#EF4444",
  reserved: "#EAB308",
};

const UNASSIGNED_COLOR = "#9CA3AF";
const SELECTED_STROKE = "#0057B8";

export default function FloorCanvas({
  floorPlanUrl,
  zones,
  mode,
  drawingEnabled = false,
  selectedZoneId = null,
  onZoneClick,
  onZoneSelect,
  onZoneCreated,
}: FloorCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricLibRef = useRef<any>(null);
  const drawingPointsRef = useRef<Point[]>([]);
  const drawingMarkersRef = useRef<any[]>([]);

  // ── Initialize fabric canvas (browser-only) ─────────────────────────────
  useEffect(() => {
    let disposed = false;

    (async () => {
      const mod: any = await import("fabric");
      const fabric = mod.fabric ?? mod;
      if (disposed || !canvasElRef.current) return;

      const canvas = new fabric.Canvas(canvasElRef.current, {
        backgroundColor: "#f3f4f6",
        selection: false,
      });

      fabricLibRef.current = fabric;
      fabricCanvasRef.current = canvas;

      renderScene();
    })();

    return () => {
      disposed = true;
      try {
        fabricCanvasRef.current?.dispose();
      } catch {
        /* noop */
      }
      fabricCanvasRef.current = null;
      fabricLibRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-render when inputs change ────────────────────────────────────────
  useEffect(() => {
    renderScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorPlanUrl, zones, mode, selectedZoneId]);

  function clearDrawingState() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    drawingMarkersRef.current.forEach((m) => canvas.remove(m));
    drawingMarkersRef.current = [];
    drawingPointsRef.current = [];
  }

  function renderScene() {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;

    canvas.clear();
    canvas.backgroundImage = null;
    clearDrawingState();

    const drawZones = () => {
      zones.forEach((z) => {
        const baseColor = z.status ? STATUS_COLORS[z.status] : UNASSIGNED_COLOR;
        const isSelected = selectedZoneId != null && selectedZoneId === z.id;
        const poly = new fabric.Polygon(z.points, {
          fill: baseColor,
          opacity: 0.4,
          stroke: isSelected ? SELECTED_STROKE : baseColor,
          strokeWidth: isSelected ? 4 : 2,
          selectable: false,
          hasControls: false,
          hasBorders: false,
          hoverCursor: mode === "history" ? "default" : "pointer",
          objectCaching: false,
        });
        poly.data = z;
        canvas.add(poly);
      });
      canvas.renderAll();
    };

    if (floorPlanUrl) {
      fabric.Image.fromURL(
        floorPlanUrl,
        (img: any) => {
          if (!img) {
            drawZones();
            return;
          }
          img.set({ selectable: false, evented: false });
          const w = img.width || 1200;
          const h = img.height || 800;
          canvas.setWidth(w);
          canvas.setHeight(h);
          canvas.setBackgroundImage(img, () => {
            drawZones();
          });
        },
        { crossOrigin: "anonymous" }
      );
    } else {
      canvas.setWidth(1200);
      canvas.setHeight(800);
      drawZones();
    }
  }

  // ── Click and double-click handling ─────────────────────────────────────
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;

    function handleMouseDown(opt: any) {
      const target = opt.target;

      if (mode === "view" || mode === "history") {
        if (target?.data) onZoneClick?.(target.data as Zone);
        return;
      }

      // EDIT mode
      if (target?.data) {
        // Clicked an existing polygon → select it
        onZoneSelect?.(target.data as Zone);
        return;
      }

      if (!drawingEnabled) return;

      // Empty canvas click → drop a drawing point
      const pointer = canvas.getPointer(opt.e);
      const point: Point = { x: pointer.x, y: pointer.y };
      drawingPointsRef.current.push(point);

      const marker = new fabric.Circle({
        left: point.x - 4,
        top: point.y - 4,
        radius: 4,
        fill: SELECTED_STROKE,
        selectable: false,
        evented: false,
      });
      drawingMarkersRef.current.push(marker);
      canvas.add(marker);
      canvas.renderAll();
    }

    function handleDoubleClick() {
      if (mode !== "edit" || !drawingEnabled) return;
      const points = drawingPointsRef.current;
      if (points.length < 3) {
        clearDrawingState();
        canvas.renderAll();
        return;
      }
      const finished = [...points];
      clearDrawingState();
      canvas.renderAll();
      onZoneCreated?.(finished);
    }

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:dblclick", handleDoubleClick);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:dblclick", handleDoubleClick);
    };
  }, [mode, drawingEnabled, onZoneClick, onZoneSelect, onZoneCreated]);

  return (
    <div className="overflow-auto bg-gray-100 border border-gray-200 rounded-md inline-block max-w-full">
      <canvas ref={canvasElRef} />
    </div>
  );
}
