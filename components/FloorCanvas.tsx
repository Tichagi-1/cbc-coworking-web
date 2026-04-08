"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Fabric.js v5 has incomplete typings for some methods we use here;
// localizing `any` to this file keeps the rest of the codebase strict.

import { useEffect, useRef } from "react";
import type { Point, Zone, UnitStatus } from "@/lib/types";

type Mode = "view" | "edit";

interface FloorCanvasProps {
  floorPlanUrl: string | null;
  zones: Zone[];
  mode: Mode;
  onZoneClick?: (zone: Zone) => void;
  /** Called in edit mode after a new polygon is finalized (double-click). */
  onZoneCreated?: (points: Point[]) => void;
}

const STATUS_COLORS: Record<UnitStatus, string> = {
  occupied: "#22C55E",
  vacant: "#EF4444",
  reserved: "#EAB308",
};

const UNASSIGNED_COLOR = "#9CA3AF";

export default function FloorCanvas({
  floorPlanUrl,
  zones,
  mode,
  onZoneClick,
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

      // Trigger initial render now that fabric is ready
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
  }, [floorPlanUrl, zones, mode]);

  function renderScene() {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;

    canvas.clear();
    canvas.backgroundImage = null;
    drawingPointsRef.current = [];
    drawingMarkersRef.current = [];

    const drawZones = () => {
      zones.forEach((z) => {
        const color = z.status ? STATUS_COLORS[z.status] : UNASSIGNED_COLOR;
        const poly = new fabric.Polygon(z.points, {
          fill: color,
          opacity: 0.4,
          stroke: color,
          strokeWidth: 2,
          selectable: false,
          hasControls: false,
          hasBorders: false,
          hoverCursor: mode === "view" ? "pointer" : "crosshair",
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
      // No image — fall back to a default canvas size.
      canvas.setWidth(1200);
      canvas.setHeight(800);
      drawZones();
    }
  }

  // ── Click handling: view-mode select, edit-mode draw ────────────────────
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;

    function handleMouseDown(opt: any) {
      if (mode === "view") {
        const target = opt.target;
        if (target?.data) {
          onZoneClick?.(target.data as Zone);
        }
        return;
      }

      // EDIT mode — drop a point
      const pointer = canvas.getPointer(opt.e);
      const point: Point = { x: pointer.x, y: pointer.y };
      drawingPointsRef.current.push(point);

      const marker = new fabric.Circle({
        left: point.x - 4,
        top: point.y - 4,
        radius: 4,
        fill: "#0057B8",
        selectable: false,
        evented: false,
      });
      drawingMarkersRef.current.push(marker);
      canvas.add(marker);
      canvas.renderAll();
    }

    function handleDoubleClick() {
      if (mode !== "edit") return;
      const points = drawingPointsRef.current;
      if (points.length < 3) {
        // Not enough points — discard.
        drawingMarkersRef.current.forEach((m) => canvas.remove(m));
        drawingPointsRef.current = [];
        drawingMarkersRef.current = [];
        return;
      }

      // Add the polygon visually as feedback
      const poly = new fabric.Polygon(points, {
        fill: UNASSIGNED_COLOR,
        opacity: 0.4,
        stroke: UNASSIGNED_COLOR,
        strokeWidth: 2,
        selectable: false,
        hasControls: false,
        hasBorders: false,
        objectCaching: false,
      });
      canvas.add(poly);

      drawingMarkersRef.current.forEach((m) => canvas.remove(m));
      drawingMarkersRef.current = [];

      const finished = [...points];
      drawingPointsRef.current = [];
      canvas.renderAll();

      onZoneCreated?.(finished);
    }

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:dblclick", handleDoubleClick);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:dblclick", handleDoubleClick);
    };
  }, [mode, onZoneClick, onZoneCreated]);

  return (
    <div className="overflow-auto bg-gray-100 border border-gray-200 rounded-md inline-block max-w-full">
      <canvas ref={canvasElRef} />
    </div>
  );
}
