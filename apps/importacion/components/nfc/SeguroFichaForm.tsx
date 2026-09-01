"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertSeguroFichaAction } from "@/app/actions/nfc/seguros";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";

const FIELD =
  "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60";

export type SeguroFormValues = {
  id?: string;
  aseguradora: string;
  numeroPoliza: string;
  tipoCobertura: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  montoAsegurado: string;
  telefonoAseguradora: string;
  corredor: string;
  observaciones: string;
};

type Props = {
  initial?: SeguroFormValues;
  afterCreateHref?: (id: string) => string;
  submitLabel?: string;
};

export function SeguroFichaForm({
  initial,
  afterCreateHref,
  submitLabel = "Guardar ficha",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [desde, setDesde] = useState(initial?.vigenciaDesde ?? "");
  const [hasta, setHasta] = useState(initial?.vigenciaHasta ?? "");

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      action={(fd) => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await upsertSeguroFichaAction({
            id: initial?.id,
            aseguradora: String(fd.get("aseguradora") ?? ""),
            numeroPoliza: String(fd.get("numeroPoliza") ?? ""),
            tipoCobertura: String(fd.get("tipoCobertura") ?? ""),
            vigenciaDesde: String(fd.get("vigenciaDesde") ?? ""),
            vigenciaHasta: String(fd.get("vigenciaHasta") ?? ""),
            montoAsegurado: String(fd.get("montoAsegurado") ?? ""),
            telefonoAseguradora: String(fd.get("telefonoAseguradora") ?? ""),
            corredor: String(fd.get("corredor") ?? ""),
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
        <span className="text-sm text-slate-400">Aseguradora *</span>
        <input
          name="aseguradora"
          required
          defaultValue={initial?.aseguradora ?? ""}
          className={FIELD}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-400">Nro de póliza</span>
        <input
          name="numeroPoliza"
          defaultValue={initial?.numeroPoliza ?? ""}
          className={FIELD}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-400">Tipo de cobertura</span>
        <input
          name="tipoCobertura"
          defaultValue={initial?.tipoCobertura ?? ""}
          className={FIELD}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-400">Teléfono aseguradora</span>
        <input
          name="telefonoAseguradora"
          defaultValue={initial?.telefonoAseguradora ?? ""}
          className={FIELD}
        />
      </label>
      <PlanillaFechaField
        label="Vigencia desde"
        name="vigenciaDesde"
        value={desde}
        onChange={setDesde}
      />
      <PlanillaFechaField
        label="Vigencia hasta"
        name="vigenciaHasta"
        value={hasta}
        onChange={setHasta}
      />
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-400">Monto asegurado</span>
        <input
          name="montoAsegurado"
          type="number"
          defaultValue={initial?.montoAsegurado ?? ""}
          className={FIELD}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-400">Corredor</span>
        <input
          name="corredor"
          defaultValue={initial?.corredor ?? ""}
          className={FIELD}
        />
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
