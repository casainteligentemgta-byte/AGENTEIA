"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveInspeccionTransportistaAction } from "@/app/actions/nfc/inspeccion-transportista";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { InspeccionWizardFotos } from "@/components/dashboard/inspeccion-wizard-fotos";
import {
  TRANSPORTISTA_SECCION_LABELS,
  TRANSPORTISTA_SECCIONES,
  TRANSPORTISTA_CHECKLIST,
  transportistaPorSeccion,
} from "@/lib/puerto-libre/inspeccion/catalog";
import type {
  ChecklistRespuesta,
  InspeccionTransportistaStored,
} from "@/lib/schemas/inspeccion-transportista";
import {
  emptyEstadoVisualSlots,
  type EstadoVisualRecepcion,
} from "@/lib/schemas/estado-visual-recepcion";
import type { VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";

type Props = {
  vehiculoId: string;
  placa: string;
  initial?: InspeccionTransportistaStored | null;
  documentos?: VehiculosDocumentos | null;
};

export function InspeccionTransportistaForm({
  vehiculoId,
  placa,
  initial,
  documentos,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [blUrl, setBlUrl] = useState<string | null>(
    initial?.blDocumentoUrl || documentos?.bl_guia?.url || null
  );
  const [fotoPlacaUrl, setFotoPlacaUrl] = useState<string | null>(
    initial?.fotoPlacaUrl || documentos?.foto_placa?.url || null
  );
  const [estadoVisual, setEstadoVisual] = useState<EstadoVisualRecepcion>(
    () => initial?.estadoVisual ?? { fotos: emptyEstadoVisualSlots() }
  );
  const [pasoFotos, setPasoFotos] = useState(0);
  const [kilometraje, setKilometraje] = useState<number | null>(
    initial?.kilometraje ?? null
  );
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
            placaTexto: String(fd.get("placaTexto") ?? "") || null,
            vin: String(fd.get("vin") ?? "") || null,
            kilometraje: kmRaw ? Number(kmRaw) : kilometraje,
            blDocumentoUrl: blUrl,
            fotoPlacaUrl,
            checklist,
            estadoVisual,
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
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <h2 className="text-lg font-semibold text-slate-100">1. Datos de la recepción</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Transportista"
            name="transportista"
            defaultValue={initial?.transportista ?? ""}
          />
          <div className="space-y-3">
            <Field
              label="Nº guía / BL"
              name="numeroGuia"
              defaultValue={initial?.numeroGuia ?? ""}
            />
            <ImportDocumentoUpload
              vehiculoId={vehiculoId}
              tipo="bl_guia"
              existingUrl={blUrl}
              hint="Cargar foto o PDF del BL"
              actionLabel="Cargar foto / PDF del BL"
              onUploaded={(docs) => setBlUrl(docs.bl_guia?.url ?? null)}
            />
          </div>
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
          <div className="space-y-3">
            <Field
              label="Placa del vehículo"
              name="placaTexto"
              defaultValue={initial?.placaTexto ?? placa}
            />
            <ImportDocumentoUpload
              vehiculoId={vehiculoId}
              tipo="foto_placa"
              existingUrl={fotoPlacaUrl}
              hint="Cargar foto o PDF de la placa"
              actionLabel="Cargar foto / PDF de la placa"
              onUploaded={(docs) => setFotoPlacaUrl(docs.foto_placa?.url ?? null)}
            />
          </div>
          <Field label="VIN / chasis" name="vin" defaultValue={initial?.vin ?? ""} />
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Kilometraje al recibir</span>
            <input
              name="kilometraje"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={kilometraje ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                setKilometraje(v ? Number(v) : null);
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
              placeholder="Solo números"
            />
          </label>
        </div>
      </section>

      {TRANSPORTISTA_SECCIONES.filter((s) => s !== "evidencia").map((seccion) => (
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
                      ["sin_dano", "Sin daño"],
                      ["falla", "Con daño"],
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
                            ? value === "sin_dano"
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
        <h2 className="text-lg font-semibold text-slate-100">
          Evidencia fotográfica y daños
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Mismo flujo que la recepción en taller: fotos por vista y marca rayones o golpes sobre
          la imagen.
        </p>
        <div className="mt-4">
          <InspeccionWizardFotos
            estadoVisual={estadoVisual}
            onEstadoVisualChange={setEstadoVisual}
            vehiculoId={vehiculoId}
            placaEsperada={placa}
            pasoIndex={pasoFotos}
            onPasoIndexChange={setPasoFotos}
            kilometraje={kilometraje}
            onKilometrajeChange={setKilometraje}
            onKilometrajeDetectado={(km) => setKilometraje(km)}
          />
        </div>
      </section>

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
              placeholder="Describe golpes, rayones u observaciones al recibir"
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
          Planilla de recepción en puerto guardada. Redirigiendo…
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar planilla recepción en puerto"}
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
