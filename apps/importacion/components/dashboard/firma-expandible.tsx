"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eraser, PenLine, X } from "lucide-react";
import { isFirmaImagen } from "@/lib/firma";

export { isFirmaImagen };

type Props = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const STROKE_COLOR = "#18181b";
const STROKE_WIDTH = 3;

function FirmaModal({
  label,
  initialValue,
  onSave,
  onClose,
}: {
  label: string;
  initialValue?: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (initialValue && isFirmaImagen(initialValue)) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasInk(true);
      };
      img.src = initialValue;
    }
  }, [initialValue]);

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = "";
    };
  }, [resizeCanvas]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const pt = getPoint(e);
    if (!ctx || !pt) return;
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const pt = getPoint(e);
    if (!ctx || !pt) return;
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    setHasInk(true);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !container || !ctx) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    setHasInk(false);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    onSave(canvas.toDataURL("image/png"));
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{label}</p>
          <p className="text-xs text-zinc-500">Dibuja tu firma con el dedo o el lápiz</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 p-4">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none rounded-xl border-2 border-zinc-700 bg-white shadow-inner"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-4 py-4">
        <button
          type="button"
          onClick={clearCanvas}
          disabled={!hasInk}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          <Eraser className="h-4 w-4" />
          Borrar
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasInk}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            Guardar firma
          </button>
        </div>
      </div>
    </div>
  );
}

export function FirmaExpandible({ label, value = "", onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const hasFirma = Boolean(value?.trim());

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-zinc-500">{label}</label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="group flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-600 bg-zinc-900/60 px-3 transition hover:border-blue-500 hover:bg-zinc-900 disabled:opacity-50 sm:h-32"
        >
          {hasFirma && isFirmaImagen(value) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={`Firma — ${label}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : hasFirma ? (
            <span className="text-sm text-zinc-200">{value}</span>
          ) : (
            <>
              <PenLine className="h-6 w-6 text-zinc-500 group-hover:text-blue-400" />
              <span className="text-sm text-zinc-500 group-hover:text-blue-300">
                Toca para firmar
              </span>
            </>
          )}
        </button>
        {hasFirma && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("")}
            className="mt-1.5 text-xs text-red-400 hover:text-red-300"
          >
            Quitar firma
          </button>
        )}
      </div>

      {open && (
        <FirmaModal
          label={label}
          initialValue={value}
          onSave={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
