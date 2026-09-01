"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertMatriculaFichaAction } from "@/app/actions/nfc/matriculas";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";

const FIELD =
  "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60";

export type MatriculaFormValues = {
  id?: string;
  placa: string;
  oficinaIntt: string;
  fechaTramite: string;
  requiereHomologacion: boolean;
  observaciones: string;
};

type Props = {
  initial?: MatriculaFormValues;
  afterCreateHref?: (id: string) => string;
  submitLabel?: string;
};

export function MatriculaFichaForm({
  initial,
  afterCreateHref,
  submitLabel = "Guardar ficha",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fecha, setFecha] = useState(initial?.fechaTramite ?? "");

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      action={(fd) => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await upsertMatriculaFichaAction({
            id: initial?.id,
            placa: String(fd.get("placa") ?? ""),
            oficinaIntt: String(fd.get("oficinaIntt") ?? ""),
            fechaTramite: String(fd.get("fechaTramite") ?? ""),
            requiereHomologacion: fd.get("requiereHomologacion") === "on",
            observaciones: String(fd.get("observaciones") ?? ""),
          });
          if (!result.success) {
            setError(result.error);
            return;
          }
          setMessage("Ficha guardada");
          const href = afterCreateHref?.(result.ficha.id);
          if (href) {
            router.push(href);
            return;
          }
          router.refresh();
        });
      }}
    >
      {error ? (
        <p className="sm:col-span-2 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="sm:col-span-2 rounded-xl border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-400">Placa</span>
        <input name="placa" defaultValue={initial?.placa ?? ""} className={FIELD} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-400">Oficina INTT</span>
        <input
          name="oficinaIntt"
          defaultValue={initial?.oficinaIntt ?? ""}
          className={FIELD}
        />
      </label>
      <PlanillaFechaField
        label="Fecha del trámite"
        name="fechaTramite"
        value={fecha}
        onChange={setFecha}
      />
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
        <input
          type="checkbox"
          name="requiereHomologacion"
          defaultChecked={initial?.requiereHomologacion ?? false}
          className="h-4 w-4 rounded border-slate-600"
        />
        Requiere homologación
      </label>
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm text-slate-400">Observaciones</span>
        <input
          name="observaciones"
          defaultValue={initial?.observaciones ?? ""}
          className={FIELD}
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
