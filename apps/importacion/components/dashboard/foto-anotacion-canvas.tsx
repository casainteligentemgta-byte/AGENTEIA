"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Loader2, Pencil } from "lucide-react";
import { HINT_ANOTACIONES_FOTO } from "@/lib/inspeccion/pasos";
import type { EstadoVisualVista, TrazoAnotacion } from "@/lib/schemas/estado-visual-recepcion";

type Props = {
  vista: EstadoVisualVista;
  imageUrl: string;
  trazos: TrazoAnotacion[];
  onTrazosChange: (trazos: TrazoAnotacion[]) => void;
  disabled?: boolean;
};

const STROKE_COLOR = "#ef4444";
const STROKE_WIDTH = 4;

export function FotoAnotacionCanvas({
  vista,
  imageUrl,
  trazos,
  onTrazosChange,
  disabled,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [ready, setReady] = useState(false);

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

    const rect = img.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 1 || h < 1) return;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    setReady(true);
  }, []);

  useEffect(() => {
    setReady(false);
  }, [imageUrl, vista]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const onLoad = () => syncCanvasSize();
    img.addEventListener("load", onLoad);
    if (img.complete) onLoad();

    const observer = new ResizeObserver(() => syncCanvasSize());
    observer.observe(img);

    return () => {
      img.removeEventListener("load", onLoad);
      observer.disconnect();
    };
  }, [imageUrl, vista, syncCanvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    redrawAll(ctx, canvas.width, canvas.height, trazos);
  }, [trazos, ready]);

  function redrawAll(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    strokes: TrazoAnotacion[]
  ) {
    ctx.clearRect(0, 0, w, h);
    for (const stroke of strokes) {
      drawStroke(ctx, stroke, w, h);
    }
  }

  function drawStroke(
    ctx: CanvasRenderingContext2D,
    stroke: TrazoAnotacion,
    w: number,
    h: number
  ) {
    if (stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
    }
    ctx.stroke();
  }

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || !ready) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const pt = getPoint(e);
    if (pt) currentPointsRef.current = [pt];
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const pt = getPoint(e);
    if (!canvas || !ctx || !pt) return;

    const points = currentPointsRef.current;
    if (points.length === 0) {
      currentPointsRef.current = [pt];
      return;
    }

    const prev = points[points.length - 1];
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height);
    ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
    ctx.stroke();

    currentPointsRef.current = [...points, pt];
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);

    const points = currentPointsRef.current;
    currentPointsRef.current = [];
    if (points.length < 2) return;

    onTrazosChange([
      ...trazos,
      { color: STROKE_COLOR, width: STROKE_WIDTH, points },
    ]);
  }

  function clearAnnotations() {
    onTrazosChange([]);
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt={`Vista ${vista}`}
          className="block w-full select-none"
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className="absolute left-0 top-0 touch-none cursor-crosshair"
          style={{ touchAction: "none", width: "100%", height: "100%" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label={`Anotar daños en vista ${vista}`}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {HINT_ANOTACIONES_FOTO}
        </span>
        {trazos.length > 0 && (
          <button
            type="button"
            onClick={clearAnnotations}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300"
          >
            <Eraser className="h-3.5 w-3.5" />
            Borrar marcas ({trazos.length})
          </button>
        )}
      </div>
    </div>
  );
}
