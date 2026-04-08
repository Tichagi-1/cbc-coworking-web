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
const STATUS_OPACITY = 0.35;

const UNMAPPED_COLOR = "#6B7280";
const UNMAPPED_OPACITY = 0.25;

const SELECTED_STROKE = "#0057B8";
const LABEL_AREA_THRESHOLD = 2000; // px² (in scene/image space)
const DEFAULT_BASE = { width: 1200, height: 800 };

function polygonArea(points: Point[]): number {
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

function polygonCentroid(points: Point[]): Point {
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricLibRef = useRef<any>(null);

  // Natural (unscaled) base size — image dimensions when a plan is loaded,
  // otherwise the default. All polygon coordinates live in this space.
  const baseSizeRef = useRef<{ width: number; height: number }>(DEFAULT_BASE);

  // In-progress drawing
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

  // ── ResizeObserver: rescale canvas when wrapper width changes ───────────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver(() => applyResponsiveScale());
    observer.observe(wrapper);

    // Apply once immediately in case the canvas is already initialized
    applyResponsiveScale();

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────
  function applyResponsiveScale() {
    const canvas = fabricCanvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const wrapperWidth = wrapper.clientWidth;
    if (wrapperWidth <= 0) return;

    const { width: baseW, height: baseH } = baseSizeRef.current;
    const scale = wrapperWidth / baseW;

    canvas.setZoom(scale);
    canvas.setWidth(baseW * scale);
    canvas.setHeight(baseH * scale);
    canvas.requestRenderAll();
  }

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
        const isMapped = z.unit_id != null;
        const baseColor = z.status
          ? STATUS_COLORS[z.status]
          : isMapped
          ? UNMAPPED_COLOR
          : UNMAPPED_COLOR;
        const opacity = z.status ? STATUS_OPACITY : UNMAPPED_OPACITY;
        const isSelected = selectedZoneId != null && selectedZoneId === z.id;

        const poly = new fabric.Polygon(z.points, {
          fill: baseColor,
          opacity,
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

        // Centroid label for sufficiently large polygons
        const area = polygonArea(z.points);
        if (z.label && area > LABEL_AREA_THRESHOLD) {
          const c = polygonCentroid(z.points);
          const text = new fabric.Text(z.label, {
            left: c.x,
            top: c.y,
            originX: "center",
            originY: "center",
            fontSize: 11,
            fontWeight: "bold",
            fontFamily: "Arial, sans-serif",
            fill: "#ffffff",
            shadow: "rgba(0,0,0,0.6) 0px 1px 2px",
            selectable: false,
            evented: false,
            objectCaching: false,
          });
          canvas.add(text);
        }
      });
      // After zones are placed, re-apply the responsive scale so the
      // canvas matches the wrapper width.
      applyResponsiveScale();
    };

    if (floorPlanUrl) {
      fabric.Image.fromURL(
        floorPlanUrl,
        (img: any) => {
          if (!img) {
            baseSizeRef.current = DEFAULT_BASE;
            drawZones();
            return;
          }
          img.set({ selectable: false, evented: false });
          const w = img.width || DEFAULT_BASE.width;
          const h = img.height || DEFAULT_BASE.height;
          baseSizeRef.current = { width: w, height: h };
          // Set canvas to natural size first; applyResponsiveScale below
          // will scale it to fit the wrapper.
          canvas.setWidth(w);
          canvas.setHeight(h);
          canvas.setBackgroundImage(img, () => {
            drawZones();
          });
        },
        { crossOrigin: "anonymous" }
      );
    } else {
      baseSizeRef.current = DEFAULT_BASE;
      canvas.setWidth(DEFAULT_BASE.width);
      canvas.setHeight(DEFAULT_BASE.height);
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
        onZoneSelect?.(target.data as Zone);
        return;
      }

      if (!drawingEnabled) return;

      // Empty canvas click → drop a drawing point.
      // canvas.getPointer() returns coordinates in scene/image space,
      // already adjusted for the current zoom factor.
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
      canvas.requestRenderAll();
    }

    function handleDoubleClick() {
      if (mode !== "edit" || !drawingEnabled) return;
      const points = drawingPointsRef.current;
      if (points.length < 3) {
        clearDrawingState();
        canvas.requestRenderAll();
        return;
      }
      const finished = [...points];
      clearDrawingState();
      canvas.requestRenderAll();
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
    <div
      ref={wrapperRef}
      className="w-full overflow-hidden bg-gray-100 border border-gray-200 rounded-md"
    >
      <canvas ref={canvasElRef} />
    </div>
  );
}
