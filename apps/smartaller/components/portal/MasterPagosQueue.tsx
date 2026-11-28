"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  aprobarReportePagoAction,
  rechazarReportePagoAction,
} from "@/app/actions/pagos-admin";
import { toAuthorizedFileUrl } from "@/lib/storage/signed-url";
import { COMPROBANTES_PAGO_BUCKET } from "@/lib/storage/buckets";
import type { ReportePago } from "@/lib/billing/reportes";

export type ReportePagoAdmin = ReportePago & {
  email: string | null;
  tallerNombre: string | null;
};

function estadoLabel(estado: string): string {
  if (estado === "pendiente") return "Pendiente";
  if (estado === "aprobado") return "Aprobado";
  if (estado === "rechazado") return "Rechazado";
  return "Cancelado";
}

function RowActions({ reporte }: { reporte: ReportePagoAdmin }) {
  const [pending, startTransition] = useTransition();
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(kind: "aprobar" | "rechazar") {
    setError(null);
    startTransition(async () => {
      const result =
        kind === "aprobar"
          ? await aprobarReportePagoAction({ reporteId: reporte.id, notas })
          : await rechazarReportePagoAction({ reporteId: reporte.id, notas });
      if (!result.ok) setError(result.error);
    });
  }

  if (reporte.estado !== "pendiente") {
    return reporte.notas ? (
      <p className="text-xs text-zinc-500">{reporte.notas}</p>
    ) : null;
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={2}
        placeholder="Notas (obligatorias al rechazar)"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("aprobar")}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {pending ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} Aprobar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("rechazar")}
          className="rounded-lg bg-red-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Rechazar
        </button>
      </div>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

export function MasterPagosQueue({ reportes }: { reportes: ReportePagoAdmin[] }) {
  if (reportes.length === 0) {
    return <p className="text-sm text-zinc-500">No hay reportes todavía.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-900 text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Pagador</th>
            <th className="px-3 py-2 font-medium">Plan</th>
            <th className="px-3 py-2 font-medium">Pago</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {reportes.map((r) => (
            <tr key={r.id} className="border-t border-zinc-800/80 align-top">
              <td className="px-3 py-2 text-zinc-400">
                {new Date(r.created_at).toLocaleString("es-VE")}
              </td>
              <td className="px-3 py-2">
                <p className="text-zinc-100">{r.email ?? r.user_id.slice(0, 8)}</p>
                {r.tallerNombre ? (
                  <p className="text-xs text-zinc-500">{r.tallerNombre}</p>
                ) : null}
              </td>
              <td className="px-3 py-2 text-zinc-300">
                {r.tipo_plan === "b2c" ? "Dueño · $2.99" : "Taller · $100"}
              </td>
              <td className="px-3 py-2 text-zinc-300">
                <p>
                  {r.monto} {r.moneda}
                </p>
                <p className="font-mono text-xs text-zinc-500">Ref. {r.referencia}</p>
                <p className="text-xs text-zinc-500">{r.fecha_pago}</p>
                {r.comprobante_path ? (
                  <a
                    href={toAuthorizedFileUrl(COMPROBANTES_PAGO_BUCKET, r.comprobante_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    Ver comprobante
                  </a>
                ) : (
                  <p className="text-xs text-zinc-600">Sin captura</p>
                )}
              </td>
              <td className="px-3 py-2 text-zinc-300">{estadoLabel(r.estado)}</td>
              <td className="px-3 py-2">
                <RowActions reporte={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
