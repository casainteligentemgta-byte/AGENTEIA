"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveInspeccionTransportistaAction } from "@/app/actions/nfc/inspeccion-transportista";
import {
  TRANSPORTISTA_SECCION_LABELS,
  TRANSPORTISTA_SECCIONES,
  transportistaPorSeccion,
} from "@/lib/puerto-libre/inspeccion/catalog";
import type {
  ChecklistRespuesta,
  InspeccionTransportistaStored,
} from "@/lib/schemas/inspeccion-transportista";
import { TRANSPORTISTA_CHECKLIST } from "@/lib/puerto-libre/inspeccion/catalog";

type Props = {
  vehiculoId: string;
  placa: string;
  initial?: InspeccionTransportistaStored | null;
};

export function InspeccionTransportistaForm({ vehiculoId, placa, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, ChecklistRespuesta>>(() => {
    const base: Record<string, ChecklistRespuesta> = {};
    for (const item of TRANSPORTISTA_CHECKLIST) {
      base[item.id] = initial?.checklist?.[item.id] ?? "na";
    }
    return base;
  });

  function setItem(id: string, value: ChecklistRespuesta) {
    setChecklist((prev) => ({ ...prev, [id]: value }));
  }

  return (
    <form
      className="space-y-8"
      action={(fd) => {
        setError(null);
        setOk(false);
        startTransition(async () => {
          const kmRaw = String(fd.get("kilometraje") ?? "").trim();
          const result = await saveInspeccionTransportistaAction({
            vehiculoId,
            transportista: String(fd.get("transportista") ?? "") || null,
            numeroGuia: String(fd.get("numeroGuia") ?? "") || null,
            fechaRecepcion: String(fd.get("fechaRecepcion") ?? "") || null,
            lugarRecepcion: String(fd.get("lugarRecepcion") ?? "") || null,
            contenedor: String(fd.get("contenedor") ?? "") || null,
            kilometraje: kmRaw ? Number(kmRaw) : null,
            checklist,
            danosReportados: String(fd.get("danosReportados") ?? "") || null,
            observaciones: String(fd.get("observaciones") ?? "") || null,
            receptorNombre: String(fd.get("receptorNombre") ?? "") || null,
            transportistaNombre: String(fd.get("transportistaNombre") ?? "") || null,
          });
          if (!result.success) {
            const msg = result.error.toLowerCase();
            if (msg.includes("inspeccion_transportista") || msg.includes("column")) {
              setError(
                "Falta la columna inspeccion_transportista. Ejecuta 20260729_inspeccion_transportista_pl.sql en Supabase."
              );
              return;
            }
            setError(result.error);
            return;
          }
          setOk(true);
          router.refresh();
          router.push(`/puerto-libre/${vehiculoId}`);
        });
      }}
    >
      <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
        Inspección de <strong>recepción en transportista</strong> para{" "}
        <span className="font-mono text-cyan-300">{placa}</span>. No es la inspección de ingreso al
        taller.
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <h2 className="text-lg font-semibold text-slate-100">Datos de la recepción</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Transportista"
            name="transportista"
            defaultValue={initial?.transportista ?? ""}
          />
          <Field
            label="Nº guía / BL"
            name="numeroGuia"
            defaultValue={initial?.numeroGuia ?? ""}
          />
          <Field
            label="Fecha de recepción"
            name="fechaRecepcion"
            type="date"
            defaultValue={initial?.fechaRecepcion ?? ""}
          />
          <Field
            label="Lugar de recepción"
            name="lugarRecepcion"
            defaultValue={initial?.lugarRecepcion ?? ""}
          />
          <Field
            label="Contenedor / remolque"
            name="contenedor"
            defaultValue={initial?.contenedor ?? ""}
          />
          <Field
            label="Kilometraje al recibir"
            name="kilometraje"
            type="number"
            defaultValue={
              initial?.kilometraje != null ? String(initial.kilometraje) : ""
            }
          />
        </div>
      </section>

      {TRANSPORTISTA_SECCIONES.map((seccion) => (
        <section
          key={seccion}
          className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"
        >
          <h2 className="text-lg font-semibold text-slate-100">
            {TRANSPORTISTA_SECCION_LABELS[seccion]}
          </h2>
          <ul className="mt-4 space-y-3">
            {transportistaPorSeccion(seccion).map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-slate-200">{item.etiqueta}</span>
                <div className="flex gap-2">
                  {(
                    [
                      ["ok", "OK"],
                      ["falla", "Falla"],
                      ["na", "N/A"],
                    ] as const
                  ).map(([value, label]) => {
                    const active = checklist[item.id] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setItem(item.id, value)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? value === "ok"
                              ? "bg-emerald-600 text-white"
                              : value === "falla"
                                ? "bg-red-600 text-white"
                                : "bg-slate-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <h2 className="text-lg font-semibold text-slate-100">Daños y firmas</h2>
        <div className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Daños reportados al recibir</span>
            <textarea
              name="danosReportados"
              rows={3}
              defaultValue={initial?.danosReportados ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
              placeholder="Describe golpes, rayones u observaciones al recibir de la transportista"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Observaciones</span>
            <textarea
              name="observaciones"
              rows={3}
              defaultValue={initial?.observaciones ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nombre receptor"
              name="receptorNombre"
              defaultValue={initial?.receptorNombre ?? ""}
            />
            <Field
              label="Nombre transportista"
              name="transportistaNombre"
              defaultValue={initial?.transportistaNombre ?? ""}
            />
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          Acta de recepción en transportista guardada. Redirigiendo a la ficha…
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar inspección transportista"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
      />
    </label>
  );
}
