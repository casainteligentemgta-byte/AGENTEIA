"use client";

import { useEffect, useRef } from "react";
import {
  ESTADO_VISUAL_VISTAS,
  ESTADO_VISUAL_VISTA_LABELS,
  type EstadoVisualRecepcion,
  type TrazoAnotacion,
} from "@/lib/schemas/estado-visual-recepcion";

type Props = {
  estadoVisual: EstadoVisualRecepcion;
};

function TrazosOverlay({
  imageUrl,
  trazos,
  label,
}: {
  imageUrl: string;
  trazos: TrazoAnotacion[];
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = container.clientWidth;
      const h = Math.round((img.height / img.width) * w);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (const stroke of trazos) {
        if (stroke.points.length < 2) continue;
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
    };
    img.src = imageUrl;
  }, [imageUrl, trazos]);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-lg border border-zinc-700">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={label} className="block w-full" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

export function EstadoVisualDisplay({ estadoVisual }: Props) {
  const fotosExterior = ESTADO_VISUAL_VISTAS.filter((v) => v !== "tablero").map(
    (vista) => estadoVisual.fotos.find((f) => f.vista === vista) ?? { vista, trazos: [] }
  ).filter((f) => f.url);

  const fotoTablero = estadoVisual.fotos.find((f) => f.vista === "tablero" && f.url);

  if (fotosExterior.length === 0 && !fotoTablero) return null;

  return (
    <div className="mt-5">
      <p className="mb-3 text-xs font-medium text-zinc-500">Estado visual — fotos del vehículo</p>
      {fotosExterior.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {fotosExterior.map((foto) => (
            <div key={foto.vista}>
              <p className="mb-2 text-xs text-zinc-400">
                {ESTADO_VISUAL_VISTA_LABELS[foto.vista]}
                {foto.trazos.length > 0 && (
                  <span className="ml-2 text-red-400">· con anotaciones</span>
                )}
              </p>
              <TrazosOverlay
                imageUrl={foto.url!}
                trazos={foto.trazos}
                label={ESTADO_VISUAL_VISTA_LABELS[foto.vista]}
              />
            </div>
          ))}
        </div>
      )}
      {fotoTablero && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-zinc-400">{ESTADO_VISUAL_VISTA_LABELS.tablero}</p>
          <TrazosOverlay
            imageUrl={fotoTablero.url!}
            trazos={fotoTablero.trazos}
            label={ESTADO_VISUAL_VISTA_LABELS.tablero}
          />
        </div>
      )}
    </div>
  );
}
