"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { resumenSemaforo, vehicleSemaforo } from "@/lib/importacion/carga-masiva-ui";
import {
  evaluateVinCrossCheck,
  type VinDocSources,
} from "@/lib/importacion/vehicle-import-vin";

type Props = {
  rows: CargaMasivaRow[];
  facturaName: string | null;
  certificadoCount: number;
  vinSources: Record<string, VinDocSources>;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onSave: () => void;
};

export function Step3ConfirmSave({
  rows,
  facturaName,
  certificadoCount,
  vinSources,
  pending,
  error,
  onBack,
  onSave,
}: Props) {
  const resumen = resumenSemaforo(rows);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-50">Confirmar y guardar</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Se crearán {resumen.aptos.length} expediente{resumen.aptos.length === 1 ? "" : "s"}.
          {resumen.bloqueados.length > 0
            ? ` ${resumen.bloqueados.length} sin VIN no se registran.`
            : ""}
        </p>
      </div>

      <ul className="space-y-2">
        {rows.map((row, index) => {
          const sem = vehicleSemaforo(row);
          const vinCheck = evaluateVinCrossCheck(
            row.vin || row.serialCarroceria,
            vinSources[row.id]
          );
          const vinWarn = vinCheck.items.find((item) => item.status !== "ok");
          return (
            <li
              key={row.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3"
            >
              <p className="text-sm font-medium text-zinc-100">
                {index + 1}. {[row.marca, row.modelo, row.anio].filter(Boolean).join(" ") || "Vehículo"}
              </p>
              <p className="mt-0.5 font-mono text-xs text-zinc-400">
                VIN {row.vin || row.serialCarroceria || "—"}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">{sem.label}</p>
              {vinWarn ? (
                <p className={`mt-1 text-[11px] ${vinWarn.status === "fail" ? "text-red-300" : "text-amber-300"}`}>
                  {vinWarn.status === "fail" ? "✕" : "⚠️"} {vinWarn.label}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-emerald-300">✓ VIN cruzado con factura y certificado</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-zinc-800 px-3 py-3 text-xs text-zinc-400">
        <p>Factura: {facturaName ?? "sin archivo en memoria (se registrará igual)"}</p>
        <p className="mt-1">Certificados: {certificadoCount}</p>
        <p className="mt-1">
          Semáforo: {resumen.verde} verde, {resumen.ambar} ámbar, {resumen.rojo} rojo
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={onBack}
          className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
        >
          Volver a revisar
        </button>
        <button
          type="button"
          disabled={pending || resumen.aptos.length === 0}
          onClick={onSave}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Registrando…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Registrar expedientes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
