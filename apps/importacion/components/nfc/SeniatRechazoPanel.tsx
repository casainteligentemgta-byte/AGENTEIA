"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  marcarRechazoSeniatAction,
  resolverRechazoSeniatAction,
} from "@/app/actions/nfc/importacion-vehiculo";
import type { ImportacionData } from "@/lib/schemas/vehiculo-documentos";

type Props = {
  vehiculoId: string;
  importacion: ImportacionData;
  canMutate: boolean;
};

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return iso;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function SeniatRechazoPanel({
  vehiculoId,
  importacion,
  canMutate,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rechazada = importacion.estadoSeniat === "rechazada";
  const historial = importacion.historialRechazosSeniat ?? [];

  function flash(ok: string | null, err: string | null) {
    setMessage(ok);
    setError(err);
  }

  if (!canMutate && !rechazada) return null;

  return (
    <section className="space-y-3">
      {(message || error) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-900/50 bg-red-950/30 text-red-200"
              : "border-emerald-900/40 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          {error ?? message}
        </div>
      )}

      {rechazada ? (
        <div className="rounded-2xl border border-red-900/50 bg-red-950/25 px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold text-red-100">
                Rechazado por SENIAT
              </p>
              <p className="text-sm text-red-200/90">
                {importacion.motivoRechazoSeniat?.trim() || "Sin motivo registrado."}
              </p>
              <p className="text-xs text-red-300/70">
                Fecha: {formatFecha(importacion.fechaRechazoSeniat)} · La fase de
                planilla no cambia; corrige y reintenta.
              </p>
              {historial.length > 1 ? (
                <p className="text-xs text-red-300/60">
                  Rechazos previos: {historial.length - 1}
                </p>
              ) : null}
              {canMutate ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    flash(null, null);
                    startTransition(async () => {
                      const result = await resolverRechazoSeniatAction({
                        vehiculoId,
                      });
                      if (!result.success) {
                        flash(null, result.error);
                        return;
                      }
                      flash("Rechazo marcado como corregido", null);
                      router.refresh();
                    });
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:border-emerald-500/60 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar como corregido
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {canMutate && !rechazada ? (
        <div>
          {!open ? (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setMotivo("");
                flash(null, null);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs font-medium text-red-200 transition hover:border-red-700/50"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Marcar rechazo SENIAT
            </button>
          ) : (
            <div className="rounded-2xl border border-red-900/40 bg-zinc-950/60 p-4">
              <p className="text-sm font-medium text-zinc-100">
                Motivo del rechazo SENIAT
              </p>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Describe el motivo del rechazo…"
                className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-red-500/50"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || !motivo.trim()}
                  onClick={() => {
                    flash(null, null);
                    startTransition(async () => {
                      const result = await marcarRechazoSeniatAction({
                        vehiculoId,
                        motivo: motivo.trim(),
                      });
                      if (!result.success) {
                        flash(null, result.error);
                        return;
                      }
                      setOpen(false);
                      setMotivo("");
                      flash("Rechazo SENIAT registrado", null);
                      router.refresh();
                    });
                  }}
                  className="rounded-xl bg-red-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
                >
                  Confirmar rechazo
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setOpen(false);
                    setMotivo("");
                  }}
                  className="rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
