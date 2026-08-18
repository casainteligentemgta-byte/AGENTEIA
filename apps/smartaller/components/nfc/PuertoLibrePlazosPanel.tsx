"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, Flag } from "lucide-react";
import { registrarPresentacionAnualAction } from "@/app/actions/nfc/importacion-vehiculo";
import {
  ESTADO_PRESENTACION_LABELS,
  computePlazosAduaneros,
  type EstadoPresentacionAnual,
} from "@/lib/importacion/plazos";
import type { ImportacionData } from "@/lib/schemas/vehiculo-documentos";

type Props = {
  vehiculoId: string;
  importacion: ImportacionData;
  canMutate?: boolean;
};

const BADGE: Record<EstadoPresentacionAnual, string> = {
  al_dia: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  atencion: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  vencido: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
};

function formatDia(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function etiquetaDias(dias: number | null): string {
  if (dias == null) return "Sin fecha de liquidación";
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} días`;
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `${dias} días restantes`;
}

export function PuertoLibrePlazosPanel({
  vehiculoId,
  importacion,
  canMutate = true,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const plazos = computePlazosAduaneros(importacion);
  const yaNacionalizado =
    importacion.estadoNacionalizacion === "nacionalizado" ||
    importacion.estadoNacionalizacion === "no_aplica";
  const historial = [...(importacion.historialPresentaciones ?? [])].sort(
    (a, b) => b.fechaPresentacion.localeCompare(a.fechaPresentacion)
  );

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
        <CalendarClock className="h-4 w-4 text-cyan-400" />
        Plazos aduaneros
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Liquidación SENIAT: {formatDia(plazos.fechaLiquidacion)}. Presentación
        anual cada 365 días · nacionalización TAN a los 3 años.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Presentación anual
          </p>
          {plazos.estadoPresentacion ? (
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                BADGE[plazos.estadoPresentacion]
              }`}
            >
              {ESTADO_PRESENTACION_LABELS[plazos.estadoPresentacion]}
            </span>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">Sin liquidación aún</p>
          )}
          <p className="mt-2 text-sm text-zinc-200">
            Próxima: {formatDia(plazos.proximaFechaPresentacion)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {etiquetaDias(plazos.diasRestantesPresentacion)}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
            <Flag className="h-3 w-3 text-amber-400" />
            Nacionalización TAN
          </p>
          {plazos.elegibleNacionalizacion ? (
            <span className="mt-2 inline-flex rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-300 ring-1 ring-cyan-500/30">
              Elegible para nacionalización definitiva
            </span>
          ) : yaNacionalizado ? (
            <span className="mt-2 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
              Nacionalizado
            </span>
          ) : (
            <p className="mt-2 text-sm text-zinc-300">En periodo de permanencia</p>
          )}
          <p className="mt-2 text-sm text-zinc-200">
            Elegible desde: {formatDia(plazos.fechaElegibilidadNacionalizacion)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {yaNacionalizado
              ? "Cerrado"
              : etiquetaDias(plazos.diasRestantesNacionalizacion)}
          </p>
          {plazos.progresoPermanenciaPct != null ? (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full ${
                    plazos.elegibleNacionalizacion || yaNacionalizado
                      ? "bg-cyan-400"
                      : "bg-amber-400"
                  }`}
                  style={{ width: `${plazos.progresoPermanenciaPct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {plazos.progresoPermanenciaPct}% del plazo de 3 años
              </p>
            </div>
          ) : null}
          {plazos.elegibleNacionalizacion &&
          (importacion.planillaFase ?? 0) >= 7 ? (
            <Link
              href={`/importacion/${vehiculoId}/nacionalizar`}
              className="mt-3 inline-flex text-xs font-medium text-cyan-400 hover:text-cyan-300"
            >
              Abrir nacionalización
            </Link>
          ) : null}
        </div>
      </div>

      {historial.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {historial.slice(0, 5).map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-3 text-xs text-zinc-400"
            >
              <span>{formatDia(item.fechaPresentacion.slice(0, 10))}</span>
              <span className="truncate text-zinc-500">
                {item.nroActaInspeccion?.trim() || "Sin nº de acta"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {canMutate && !yaNacionalizado && plazos.fechaLiquidacion ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          action={(fd) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await registrarPresentacionAnualAction({
                vehiculoId,
                fechaPresentacion: String(fd.get("fechaPresentacion") ?? ""),
                nroActaInspeccion: String(fd.get("nroActaInspeccion") ?? "") || null,
                observaciones: String(fd.get("observaciones") ?? "") || null,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Presentación anual registrada");
              router.refresh();
            });
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-500">Fecha de presentación</span>
            <input
              type="date"
              name="fechaPresentacion"
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-500">Nº acta de inspección</span>
            <input
              name="nroActaInspeccion"
              maxLength={80}
              placeholder="Opcional"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs text-zinc-500">Observaciones</span>
            <input
              name="observaciones"
              maxLength={500}
              placeholder="Opcional"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          {error ? (
            <p className="sm:col-span-2 text-sm text-red-300">{error}</p>
          ) : null}
          {message ? (
            <p className="sm:col-span-2 text-sm text-emerald-300">{message}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-60 sm:col-span-2"
          >
            {pending ? "Registrando…" : "Registrar presentación anual"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
