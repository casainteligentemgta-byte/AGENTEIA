"use client";

import { useRef } from "react";
import {
  RECEPCION_TIPO_DANO,
  RECEPCION_TIPO_DANO_SIMBOLO,
  type OrdenRecepcionDanoVisual,
} from "@/lib/schemas/orden-recepcion";

type Props = {
  danos: OrdenRecepcionDanoVisual[];
  onChange: (danos: OrdenRecepcionDanoVisual[]) => void;
  tipoActivo: OrdenRecepcionDanoVisual["tipo"];
};

export function OrdenRecepcionDanosCanvas({ danos, onChange, tipoActivo }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    onChange([
      ...danos,
      {
        vista: "superior",
        zonaId: "diagrama_superior",
        tipo: tipoActivo,
        posicionX: Math.round(x * 10) / 10,
        posicionY: Math.round(y * 10) / 10,
      },
    ]);
  }

  function removeDano(index: number) {
    onChange(danos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Haz clic sobre el esquema para marcar daños. Símbolos: rayado (—), falta pieza (X),
        abolladura (O), roto (Δ).
      </p>

      <div className="relative mx-auto max-w-md">
        <svg
          ref={svgRef}
          viewBox="0 0 200 360"
          className="w-full cursor-crosshair rounded-xl border border-zinc-700 bg-zinc-950"
          onClick={handleClick}
          role="img"
          aria-label="Esquema superior del vehículo para marcar daños"
        >
          <rect x="40" y="20" width="120" height="50" rx="8" fill="#1e293b" stroke="#475569" />
          <text x="100" y="50" textAnchor="middle" fill="#64748b" fontSize="10">
            Capó
          </text>
          <rect x="30" y="75" width="140" height="180" rx="10" fill="#1e293b" stroke="#475569" />
          <text x="100" y="165" textAnchor="middle" fill="#64748b" fontSize="10">
            Habitáculo
          </text>
          <rect x="40" y="260" width="120" height="55" rx="8" fill="#1e293b" stroke="#475569" />
          <text x="100" y="292" textAnchor="middle" fill="#64748b" fontSize="10">
            Maletero
          </text>
          <ellipse cx="55" cy="55" rx="18" ry="28" fill="#0f172a" stroke="#334155" />
          <ellipse cx="145" cy="55" rx="18" ry="28" fill="#0f172a" stroke="#334155" />
          <ellipse cx="55" cy="305" rx="18" ry="28" fill="#0f172a" stroke="#334155" />
          <ellipse cx="145" cy="305" rx="18" ry="28" fill="#0f172a" stroke="#334155" />

          {danos.map((d, i) => (
            <text
              key={`${d.posicionX}-${d.posicionY}-${i}`}
              x={(d.posicionX / 100) * 200}
              y={(d.posicionY / 100) * 360}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#f87171"
              fontSize="16"
              fontWeight="bold"
            >
              {RECEPCION_TIPO_DANO_SIMBOLO[d.tipo]}
            </text>
          ))}
        </svg>
      </div>

      {danos.length > 0 && (
        <ul className="space-y-1">
          {danos.map((d, i) => (
            <li
              key={`dano-${i}`}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-300"
            >
              <span>
                {RECEPCION_TIPO_DANO_SIMBOLO[d.tipo]} — ({d.posicionX.toFixed(0)}%,{" "}
                {d.posicionY.toFixed(0)}%)
              </span>
              <button
                type="button"
                onClick={() => removeDano(i)}
                className="text-red-400 hover:text-red-300"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {RECEPCION_TIPO_DANO.map((t) => (
          <span
            key={t}
            className={`rounded-md border px-2 py-1 text-xs ${
              tipoActivo === t
                ? "border-blue-500 bg-blue-500/20 text-blue-300"
                : "border-zinc-700 text-zinc-500"
            }`}
          >
            {RECEPCION_TIPO_DANO_SIMBOLO[t]} {t.replace("_", " ")}
          </span>
        ))}
      </div>
    </div>
  );
}
