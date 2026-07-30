"use client";

import type { TransportistaSeccion } from "@/lib/puerto-libre/inspeccion/catalog";
import { exteriorTieneFoto } from "@/lib/puerto-libre/inspeccion/catalog";
import type { ChecklistRespuesta } from "@/lib/schemas/inspeccion-transportista";
import type { DocumentoTipo, VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";
import { PlanillaFotoChip } from "@/components/nfc/PlanillaFotoChip";

export type ChecklistOpcion = {
  value: ChecklistRespuesta;
  label: string;
  shortLabel?: string;
  activeClass: string;
  idleClass?: string;
};

export const OPCIONES_RECEPCIONISTA: ChecklistOpcion[] = [
  {
    value: "sin_dano",
    label: "Sí",
    shortLabel: "✓",
    activeClass: "bg-emerald-600 text-white ring-2 ring-emerald-400/50",
    idleClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  {
    value: "falla",
    label: "No",
    shortLabel: "✗",
    activeClass: "bg-red-600 text-white ring-2 ring-red-400/50",
    idleClass: "bg-red-50 text-red-800 border border-red-200",
  },
];

export const OPCIONES_ESTADO: ChecklistOpcion[] = [
  {
    value: "sin_dano",
    label: "OK",
    shortLabel: "✓",
    activeClass: "bg-emerald-600 text-white ring-2 ring-emerald-400/50",
    idleClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  {
    value: "falla",
    label: "Daño",
    shortLabel: "✗",
    activeClass: "bg-red-600 text-white ring-2 ring-red-400/50",
    idleClass: "bg-red-50 text-red-800 border border-red-200",
  },
  {
    value: "na",
    label: "N/A",
    shortLabel: "—",
    activeClass: "bg-zinc-600 text-white ring-2 ring-zinc-400/40",
    idleClass: "bg-zinc-100 text-zinc-600 border border-zinc-200",
  },
];

/** Revisión al llegar: OK / Daño (la nota de daño reemplaza N/A). */
export const OPCIONES_OK_DANO: ChecklistOpcion[] = [
  {
    value: "sin_dano",
    label: "OK",
    shortLabel: "✓",
    activeClass: "bg-emerald-600 text-white ring-2 ring-emerald-400/50",
    idleClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  {
    value: "falla",
    label: "Daño",
    shortLabel: "✗",
    activeClass: "bg-red-600 text-white ring-2 ring-red-400/50",
    idleClass: "bg-red-50 text-red-800 border border-red-200",
  },
];

/** Exterior con foto: sin N/A (la tercera columna es carga de foto). */
export const OPCIONES_ESTADO_CON_FOTO: ChecklistOpcion[] = OPCIONES_OK_DANO;

export const OPCIONES_EVIDENCIA: ChecklistOpcion[] = [
  {
    value: "sin_dano",
    label: "Tomada",
    shortLabel: "✓",
    activeClass: "bg-emerald-600 text-white ring-2 ring-emerald-400/50",
    idleClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  {
    value: "falla",
    label: "Falta",
    shortLabel: "✗",
    activeClass: "bg-red-600 text-white ring-2 ring-red-400/50",
    idleClass: "bg-red-50 text-red-800 border border-red-200",
  },
  {
    value: "na",
    label: "N/A",
    shortLabel: "—",
    activeClass: "bg-zinc-600 text-white ring-2 ring-zinc-400/40",
    idleClass: "bg-zinc-100 text-zinc-600 border border-zinc-200",
  },
];

export function opcionesParaSeccion(
  seccion: TransportistaSeccion,
  itemId?: string
): ChecklistOpcion[] {
  if (seccion === "datos_recepcion") return OPCIONES_RECEPCIONISTA;
  if (seccion === "evidencia") return OPCIONES_EVIDENCIA;
  if (seccion === "estado_exterior" && itemId && exteriorTieneFoto(itemId)) {
    return OPCIONES_ESTADO_CON_FOTO;
  }
  return OPCIONES_ESTADO;
}

type FotoSlot = {
  vehiculoId: string;
  tipo: DocumentoTipo;
  url?: string | null;
  onUploaded?: (documentos: VehiculosDocumentos) => void;
  mode?: "file" | "camera" | "both";
};

type RowProps = {
  etiqueta: string;
  value: ChecklistRespuesta | "" | undefined;
  opciones: ChecklistOpcion[];
  onChange: (value: ChecklistRespuesta) => void;
  /** Tema oscuro (formulario digital) vs claro (planilla imprimible). */
  tone?: "dark" | "light";
  /** Si existe, reemplaza la columna N/A por carga de foto. */
  foto?: FotoSlot | null;
  /** Nota de daño (reemplaza N/A en revisión al llegar). */
  nota?: string;
  onNotaChange?: (nota: string) => void;
  /** Muestra el campo nota cuando el valor es falla (Daño). Default true si hay onNotaChange. */
  notaCuandoDano?: boolean;
};

export function PlanillaChecklistRow({
  etiqueta,
  value,
  opciones,
  onChange,
  tone = "dark",
  foto = null,
  nota = "",
  onNotaChange,
  notaCuandoDano = true,
}: RowProps) {
  const dark = tone === "dark";
  const fotoMode = foto?.mode ?? "both";
  const fotoDebajo = Boolean(foto) && fotoMode === "both";
  const mostrarNota = Boolean(onNotaChange) && notaCuandoDano && value === "falla";
  const cols = opciones.length + (foto && !fotoDebajo ? 1 : 0);

  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl px-3 py-3 ${
        dark
          ? "border border-slate-800 bg-slate-950/60"
          : "border border-zinc-200 bg-zinc-50/80 print:border-zinc-300 print:bg-white"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span
          className={`text-sm leading-snug ${dark ? "text-slate-200" : "text-zinc-800"}`}
        >
          {etiqueta}
        </span>
        <div
          className="grid gap-2 sm:flex sm:shrink-0"
          style={{ gridTemplateColumns: `repeat(${Math.max(cols, 1)}, minmax(0, 1fr))` }}
        >
          {opciones.map((op) => {
            const active = value === op.value;
            const idle = dark
              ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
              : op.idleClass ?? "bg-white text-zinc-600 border border-zinc-200";
            return (
              <button
                key={op.value}
                type="button"
                onClick={() => onChange(op.value)}
                aria-pressed={active}
                aria-label={`${etiqueta}: ${op.label}`}
                className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98] print:min-h-0 print:py-1 print:text-xs ${
                  active ? op.activeClass : idle
                }`}
              >
                <span className="mr-1.5 text-base leading-none print:mr-1" aria-hidden>
                  {op.shortLabel}
                </span>
                {op.label}
              </button>
            );
          })}
          {foto && !fotoDebajo ? (
            <PlanillaFotoChip
              vehiculoId={foto.vehiculoId}
              tipo={foto.tipo}
              existingUrl={foto.url}
              onUploaded={foto.onUploaded}
              tone={tone}
              label="Foto"
              mode={fotoMode}
            />
          ) : null}
        </div>
      </div>
      {mostrarNota ? (
        <label className="block space-y-1.5 print:hidden">
          <span className={`text-xs ${dark ? "text-slate-500" : "text-zinc-500"}`}>
            Describe el daño
          </span>
          <textarea
            rows={2}
            value={nota}
            onChange={(e) => onNotaChange?.(e.target.value)}
            placeholder="Ej. rayón en parabrisas, golpe en rin…"
            className={`w-full resize-y rounded-xl px-3 py-2.5 text-sm outline-none ${
              dark
                ? "border border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/60"
                : "border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500"
            }`}
          />
        </label>
      ) : null}
      {foto && fotoDebajo ? (
        <div className="print:hidden">
          <PlanillaFotoChip
            vehiculoId={foto.vehiculoId}
            tipo={foto.tipo}
            existingUrl={foto.url}
            onUploaded={foto.onUploaded}
            tone={tone}
            label="Foto"
            mode={fotoMode}
          />
        </div>
      ) : null}
    </li>
  );
}

type ProgressProps = {
  marked: number;
  total: number;
  tone?: "dark" | "light";
};

export function PlanillaChecklistProgress({ marked, total, tone = "dark" }: ProgressProps) {
  const pct = total === 0 ? 0 : Math.round((marked / total) * 100);
  const dark = tone === "dark";
  return (
    <div className="print:hidden">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className={dark ? "text-slate-500" : "text-zinc-500"}>
          {marked}/{total} revisados
        </span>
        <span className={dark ? "text-slate-400" : "text-zinc-600"}>{pct}%</span>
      </div>
      <div
        className={`h-1.5 overflow-hidden rounded-full ${dark ? "bg-slate-800" : "bg-zinc-200"}`}
      >
        <div
          className="h-full rounded-full bg-cyan-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
