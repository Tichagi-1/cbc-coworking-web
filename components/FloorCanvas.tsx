"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// fabric@5 has no upstream d.ts; localize `any` to this file.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Point, Zone, UnitStatus, ResourceType } from "@/lib/types";

export interface FloorCanvasHandle {
  exportPNG: () => string | null;
  clearBackground: () => void;
  resetZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getZoomLevel: () => number;
}

type Mode = "view" | "edit" | "history";

export interface ZoneColorConfig {
  office: string;
  meeting_room: string;
  hot_desk: string;
  open_space: string;
  amenity: string;
  vacant_border: string;
  occupied_border: string;
}

interface FloorCanvasProps {
  floorPlanUrl: string | null;
  zones: Zone[];
  mode: Mode;
  drawingEnabled?: boolean;
  selectedZoneId?: number | null;
  zoneColors?: ZoneColorConfig;
  onZoneClick?: (zone: Zone) => void;
  onZoneSelect?: (zone: Zone) => void;
  onZoneCreated?: (points: Point[]) => void;
  onZoomChange?: (level: number) => void;
}

// Fill color comes from the current status (most important — instantly
// shows availability at a glance).
const STATUS_FILL: Record<UnitStatus, string> = {
  occupied: "#22C55E",
  vacant: "#EF4444",
  reserved: "#EAB308",
};
const STATUS_FILL_OPACITY = 0.45;

// Border color comes from the resource type (what kind of space it is).
const TYPE_BORDER: Record<ResourceType, string> = {
  office: "#003DA5", // CBC Blue
  meeting_room: "#7C3AED", // purple
  hot_desk: "#0891B2", // cyan
  open_space: "#059669", // emerald
  amenity: "#0EA5E9", // sky
};
const TYPE_BORDER_WIDTH = 2.5;

// One-letter indicator drawn in the top-left corner of each polygon
const TYPE_LETTER: Record<ResourceType, string> = {
  office: "O",
  meeting_room: "M",
  hot_desk: "H",
  open_space: "S",
  amenity: "A",
};

const UNMAPPED_FILL = "#9CA3AF";
const UNMAPPED_FILL_OPACITY = 0.2;
const UNKNOWN_TYPE_BORDER = "#6B7280";
const UNKNOWN_TYPE_BORDER_WIDTH = 1.5;

const SELECTED_STROKE = "#0057B8";
const LABEL_AREA_THRESHOLD = 2000; // px² (in scene/image space)
const INDICATOR_AREA_THRESHOLD = 500; // px² for the letter indicator
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

const DEFAULT_COLORS: ZoneColorConfig = {
  office: "#4ade80",
  meeting_room: "#a78bfa",
  hot_desk: "#60a5fa",
  open_space: "#fb923c",
  amenity: "#94a3b8",
  vacant_border: "#ef4444",
  occupied_border: "#22c55e",
};

const FloorCanvas = forwardRef<FloorCanvasHandle, FloorCanvasProps>(function FloorCanvas({
  floorPlanUrl,
  zones,
  mode,
  drawingEnabled = false,
  selectedZoneId = null,
  zoneColors,
  onZoneClick,
  onZoneSelect,
  onZoneCreated,
  onZoomChange,
}, ref) {
  const colors = zoneColors || DEFAULT_COLORS;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricLibRef = useRef<any>(null);

  const notifyZoom = useCallback(
    (canvas: any) => {
      onZoomChange?.(Math.round(canvas.getZoom() * 100));
    },
    [onZoomChange]
  );

  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return null;
      return canvas.toDataURL({ format: "png", multiplier: 2, quality: 1 });
    },
    clearBackground: () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      canvas.setBackgroundImage(null, () => canvas.renderAll());
    },
    resetZoom: () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      applyResponsiveScale();
      canvas.setViewportTransform([canvas.getZoom(), 0, 0, canvas.getZoom(), 0, 0]);
      notifyZoom(canvas);
    },
    zoomIn: () => {
      const canvas = fabricCanvasRef.current;
      const fabric = fabricLibRef.current;
      if (!canvas || !fabric) return;
      const zoom = Math.min(canvas.getZoom() * 1.25, 5);
      canvas.zoomToPoint(new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2), zoom);
      canvas.requestRenderAll();
      notifyZoom(canvas);
    },
    zoomOut: () => {
      const canvas = fabricCanvasRef.current;
      const fabric = fabricLibRef.current;
      if (!canvas || !fabric) return;
      const zoom = Math.max(canvas.getZoom() / 1.25, 0.2);
      canvas.zoomToPoint(new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2), zoom);
      canvas.requestRenderAll();
      notifyZoom(canvas);
    },
    getZoomLevel: () => {
      const canvas = fabricCanvasRef.current;
      return canvas ? Math.round(canvas.getZoom() * 100) : 100;
    },
  }));

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

      // ── Mouse wheel zoom ─────────────────────────────────────────────
      canvas.on("mouse:wheel", (opt: any) => {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        zoom = Math.min(Math.max(zoom, 0.2), 5);
        canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
        onZoomChange?.(Math.round(zoom * 100));
      });

      // ── Alt+drag pan ─────────────────────────────────────────────────
      let panning = false;
      let panLast = { x: 0, y: 0 };
      canvas.on("mouse:down", (opt: any) => {
        const evt = opt.e as MouseEvent;
        if (evt.button === 1 || evt.altKey) {
          panning = true;
          canvas.selection = false;
          panLast = { x: evt.clientX, y: evt.clientY };
          canvas.defaultCursor = "grabbing";
          evt.preventDefault();
        }
      });
      canvas.on("mouse:move", (opt: any) => {
        if (!panning) return;
        const evt = opt.e as MouseEvent;
        canvas.relativePan(new fabric.Point(evt.clientX - panLast.x, evt.clientY - panLast.y));
        panLast = { x: evt.clientX, y: evt.clientY };
      });
      canvas.on("mouse:up", () => {
        if (panning) {
          panning = false;
          canvas.selection = false;
          canvas.defaultCursor = "default";
        }
      });

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
        const rtype = (z.resource_type || "office") as keyof ZoneColorConfig;
        const status = z.status;
        const isSelected = selectedZoneId != null && selectedZoneId === z.id;

        // Type-specific fill from settings colors
        const typeColor = colors[rtype] || colors.office;

        let fillColor: string;
        let fillOpacity: number;
        let borderColor: string;
        let borderWidth: number;

        if (rtype === "meeting_room") {
          // Meeting rooms: subtle type fill, border shows status
          fillColor = typeColor;
          fillOpacity = 0.2;
          borderColor = status === "occupied"
            ? colors.occupied_border
            : status === "reserved" ? "#eab308" : colors.vacant_border;
          borderWidth = 3;
        } else if (z.resource_id) {
          // Other types: fill opacity by status, border by status
          fillColor = typeColor;
          fillOpacity = status === "occupied" ? 0.55 : 0.25;
          borderColor = status === "occupied"
            ? colors.occupied_border
            : status === "reserved" ? "#eab308" : colors.vacant_border;
          borderWidth = 2.5;
        } else {
          // Unmapped
          fillColor = UNMAPPED_FILL;
          fillOpacity = UNMAPPED_FILL_OPACITY;
          borderColor = UNKNOWN_TYPE_BORDER;
          borderWidth = UNKNOWN_TYPE_BORDER_WIDTH;
        }

        const poly = new fabric.Polygon(z.points, {
          fill: fillColor,
          opacity: fillOpacity,
          stroke: isSelected ? SELECTED_STROKE : borderColor,
          strokeWidth: isSelected ? 4 : borderWidth,
          selectable: false,
          hasControls: false,
          hasBorders: false,
          hoverCursor: mode === "history" ? "default" : "pointer",
          objectCaching: false,
        });
        poly.data = z;
        canvas.add(poly);

        const area = polygonArea(z.points);

        // ── Type indicator letter (only for zones linked to a resource) ──
        const rtKey = rtype as ResourceType;
        if (z.resource_id && rtKey in TYPE_LETTER && area > INDICATOR_AREA_THRESHOLD) {
          const minX = Math.min(...z.points.map((p) => p.x));
          const minY = Math.min(...z.points.map((p) => p.y));
          const indicator = new fabric.Text(TYPE_LETTER[rtKey], {
            left: minX + 4,
            top: minY + 2,
            originX: "left",
            originY: "top",
            fontSize: 9,
            fontWeight: "bold",
            fontFamily: "Arial, sans-serif",
            fill: "#374151",
            selectable: false,
            evented: false,
            objectCaching: false,
          });
          canvas.add(indicator);
        }

        // ── Centroid label (only for zones linked to a resource) ──
        if (z.resource_id && z.label && area > LABEL_AREA_THRESHOLD) {
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
      // Append timestamp to bust browser/CDN cache after re-upload
      const cacheBustedUrl = floorPlanUrl.includes("?")
        ? `${floorPlanUrl}&_t=${Date.now()}`
        : `${floorPlanUrl}?_t=${Date.now()}`;
      fabric.Image.fromURL(
        cacheBustedUrl,
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
});

export default FloorCanvas;
