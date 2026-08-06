"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Circle,
  Eraser,
  Loader2,
  Pencil,
  Undo2,
  X,
} from "lucide-react";

export type AnotacionTool = "circle" | "pencil";

type Point = { x: number; y: number };

type StrokeMark = {
  kind: "stroke";
  color: string;
  width: number;
  points: Point[];
};

type CircleMark = {
  kind: "circle";
  color: string;
  width: number;
  cx: number;
  cy: number;
  r: number;
};

export type DamageMark = StrokeMark | CircleMark;

type Props = {
  imageUrl: string;
  fileName?: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

const STROKE_COLOR = "#ef4444";
/** Grosor relativo al lado menor del canvas. */
const STROKE_WIDTH_NORM = 0.008;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = url;
  });
}

function lineWidthFor(w: number, h: number, widthNorm: number): number {
  return Math.max(2, Math.round(Math.min(w, h) * widthNorm));
}

function drawMark(
  ctx: CanvasRenderingContext2D,
  mark: DamageMark,
  w: number,
  h: number
) {
  ctx.strokeStyle = mark.color;
  ctx.lineWidth = lineWidthFor(w, h, mark.width || STROKE_WIDTH_NORM);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (mark.kind === "stroke") {
    if (mark.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(mark.points[0].x * w, mark.points[0].y * h);
    for (let i = 1; i < mark.points.length; i++) {
      ctx.lineTo(mark.points[i].x * w, mark.points[i].y * h);
    }
    ctx.stroke();
    return;
  }

  const radius = mark.r * Math.min(w, h);
  if (radius < 1) return;
  ctx.beginPath();
  ctx.arc(mark.cx * w, mark.cy * h, radius, 0, Math.PI * 2);
  ctx.stroke();
}

async function composeAnnotatedJpeg(
  imageUrl: string,
  marks: DamageMark[],
  fileName: string
): Promise<File> {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");
  ctx.drawImage(img, 0, 0);
  for (const mark of marks) {
    drawMark(ctx, mark, canvas.width, canvas.height);
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo exportar la foto"))),
      "image/jpeg",
      0.92
    );
  });
  const base = (fileName || "foto-llegada").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}-anotada.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Editor a pantalla para marcar daños: círculo y lápiz.
 * Las marcas se queman en la imagen antes de subir.
 */
export function FotoDanoAnnotator({
  imageUrl,
  fileName = "foto.jpg",
  onCancel,
  onConfirm,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<Point | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const marksRef = useRef<DamageMark[]>([]);
  const toolRef = useRef<AnotacionTool>("circle");

  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<AnotacionTool>("circle");
  const [marks, setMarks] = useState<DamageMark[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  const redraw = useCallback((preview?: DamageMark | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const mark of marksRef.current) {
      drawMark(ctx, mark, canvas.width, canvas.height);
    }
    if (preview) {
      drawMark(ctx, preview, canvas.width, canvas.height);
    }
  }, []);

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
    redraw();
    setReady(true);
  }, [redraw]);

  useEffect(() => {
    setReady(false);
  }, [imageUrl]);

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
  }, [imageUrl, syncCanvasSize]);

  useEffect(() => {
    redraw();
  }, [marks, redraw]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!ready || saving) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const pt = getPoint(e);
    if (!pt) return;
    startRef.current = pt;
    pointsRef.current = [pt];
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !ready) return;
    const canvas = canvasRef.current;
    const pt = getPoint(e);
    if (!canvas || !pt || !startRef.current) return;

    if (toolRef.current === "pencil") {
      pointsRef.current = [...pointsRef.current, pt];
      redraw({
        kind: "stroke",
        color: STROKE_COLOR,
        width: STROKE_WIDTH_NORM,
        points: pointsRef.current,
      });
      return;
    }

    const start = startRef.current;
    const dx = (pt.x - start.x) * canvas.width;
    const dy = (pt.y - start.y) * canvas.height;
    const rNorm = Math.sqrt(dx * dx + dy * dy) / Math.min(canvas.width, canvas.height);
    redraw({
      kind: "circle",
      color: STROKE_COLOR,
      width: STROKE_WIDTH_NORM,
      cx: start.x,
      cy: start.y,
      r: rNorm,
    });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const start = startRef.current;
    const pt = getPoint(e) ?? pointsRef.current[pointsRef.current.length - 1];
    startRef.current = null;
    const canvas = canvasRef.current;

    if (!start || !pt || !canvas) {
      pointsRef.current = [];
      redraw();
      return;
    }

    if (toolRef.current === "pencil") {
      const points = pointsRef.current;
      pointsRef.current = [];
      if (points.length < 2) {
        redraw();
        return;
      }
      setMarks((prev) => [
        ...prev,
        {
          kind: "stroke",
          color: STROKE_COLOR,
          width: STROKE_WIDTH_NORM,
          points,
        },
      ]);
      return;
    }

    const dx = (pt.x - start.x) * canvas.width;
    const dy = (pt.y - start.y) * canvas.height;
    const rNorm = Math.sqrt(dx * dx + dy * dy) / Math.min(canvas.width, canvas.height);
    pointsRef.current = [];
    if (rNorm < 0.012) {
      redraw();
      return;
    }
    setMarks((prev) => [
      ...prev,
      {
        kind: "circle",
        color: STROKE_COLOR,
        width: STROKE_WIDTH_NORM,
        cx: start.x,
        cy: start.y,
        r: rNorm,
      },
    ]);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const file = await composeAnnotatedJpeg(imageUrl, marks, fileName);
      onConfirm(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la foto");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">
            Marcar daños en la foto
          </p>
          <p className="text-xs text-zinc-500">
            Arrastra un círculo o rayá con el lápiz. Luego guarda.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          aria-label="Cancelar"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-auto p-3 sm:p-4">
        <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Foto a anotar"
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
            onPointerCancel={handlePointerUp}
            aria-label="Área para marcar daños"
          />
          {!ready ? (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/50">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : null}
        </div>
      </div>

      <footer className="space-y-3 border-t border-zinc-800 bg-zinc-950 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <ToolButton
            active={tool === "circle"}
            onClick={() => setTool("circle")}
            icon={Circle}
            label="Círculo"
          />
          <ToolButton
            active={tool === "pencil"}
            onClick={() => setTool("pencil")}
            icon={Pencil}
            label="Lápiz"
          />
          <button
            type="button"
            disabled={marks.length === 0 || saving}
            onClick={() => setMarks((prev) => prev.slice(0, -1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Deshacer
          </button>
          <button
            type="button"
            disabled={marks.length === 0 || saving}
            onClick={() => setMarks([])}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-medium text-red-300 hover:border-red-500/50 disabled:opacity-40"
          >
            <Eraser className="h-3.5 w-3.5" />
            Borrar
          </button>
        </div>

        {error ? <p className="text-center text-xs text-red-300">{error}</p> : null}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {saving
              ? "Guardando…"
              : marks.length > 0
                ? "Guardar con marcas"
                : "Guardar sin marcas"}
          </button>
        </div>
      </footer>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Circle;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
        active
          ? "border border-cyan-500/50 bg-cyan-950/50 text-cyan-100"
          : "border border-zinc-700 text-zinc-400 hover:text-zinc-200"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
