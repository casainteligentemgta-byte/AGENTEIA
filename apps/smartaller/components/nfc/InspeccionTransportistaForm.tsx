"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { saveInspeccionTransportistaAction } from "@/app/actions/nfc/inspeccion-transportista";
import { InspeccionWizardFotos } from "@/components/dashboard/inspeccion-wizard-fotos";
import {
  opcionesParaSeccion,
  PlanillaChecklistProgress,
  PlanillaChecklistRow,
} from "@/components/nfc/PlanillaChecklistTap";
import { PlanillaFotoChip } from "@/components/nfc/PlanillaFotoChip";
import {
  EXTERIOR_FOTO_POR_ITEM,
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

type Prefill = {
  importadora?: string | null;
  vin?: string | null;
  kilometraje?: number | null;
};

type Props = {
  vehiculoId: string;
  placa: string;
  initial?: InspeccionTransportistaStored | null;
  documentos?: VehiculosDocumentos | null;
  /** Valores del vehículo / importación si aún no hay acta guardada. */
  prefill?: Prefill;
};

export function InspeccionTransportistaForm({
  vehiculoId,
  placa,
  initial,
  documentos,
  prefill,
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
  const [fotoTableroUrl, setFotoTableroUrl] = useState<string | null>(
    initial?.fotoTableroUrl || documentos?.foto_odometro?.url || null
  );
  const [fotosLados, setFotosLados] = useState<Record<string, string | null>>(() => ({
    foto_frontal: documentos?.foto_frontal?.url ?? null,
    foto_trasera: documentos?.foto_trasera?.url ?? null,
    foto_lateral_izq: documentos?.foto_lateral_izq?.url ?? null,
    foto_lateral_der: documentos?.foto_lateral_der?.url ?? null,
  }));
  const [estadoVisual, setEstadoVisual] = useState<EstadoVisualRecepcion>(
    () => initial?.estadoVisual ?? { fotos: emptyEstadoVisualSlots() }
  );
  const [pasoFotos, setPasoFotos] = useState(0);
  const [kilometraje, setKilometraje] = useState<number | null>(
    initial?.kilometraje ?? prefill?.kilometraje ?? null
  );
  const [checklist, setChecklist] = useState<Record<string, ChecklistRespuesta | "">>(() => {
    const base: Record<string, ChecklistRespuesta | ""> = {};
    for (const item of TRANSPORTISTA_CHECKLIST) {
      base[item.id] = initial?.checklist?.[item.id] ?? "";
    }
    return base;
  });

  function setItem(id: string, value: ChecklistRespuesta) {
    setChecklist((prev) => ({
      ...prev,
      [id]: prev[id] === value ? "" : value,
    }));
  }

  function marcarSeccionOk(seccion: (typeof TRANSPORTISTA_SECCIONES)[number]) {
    setChecklist((prev) => {
      const next = { ...prev };
      for (const item of transportistaPorSeccion(seccion)) {
        next[item.id] = "sin_dano";
      }
      return next;
    });
  }

  const progresoGlobal = useMemo(() => {
    const items = TRANSPORTISTA_CHECKLIST.filter((i) => i.seccion !== "evidencia");
    const marked = items.filter((i) => Boolean(checklist[i.id])).length;
    return { marked, total: items.length };
  }, [checklist]);

  function checklistParaGuardar(): Record<string, ChecklistRespuesta> {
    const out: Record<string, ChecklistRespuesta> = {};
    for (const item of TRANSPORTISTA_CHECKLIST) {
      const v = checklist[item.id];
      out[item.id] = v === "sin_dano" || v === "falla" || v === "na" ? v : "na";
    }
    return out;
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
            importadora: String(fd.get("importadora") ?? "") || null,
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
            fotoTableroUrl,
            checklist: checklistParaGuardar(),
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
        <p className="mt-1 text-sm text-slate-500">
          Campos editables. El botón Foto guarda al instante en Supabase (Storage + documentos).
        </p>
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="Importadora"
            name="importadora"
            defaultValue={initial?.importadora ?? prefill?.importadora ?? ""}
          />
          <Field
            label="Transportista"
            name="transportista"
            defaultValue={initial?.transportista ?? ""}
          />
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3 sm:flex-row sm:items-end sm:justify-between md:col-span-2">
            <div className="min-w-0 flex-1">
              <Field
                label="Nº guía / BL"
                name="numeroGuia"
                defaultValue={initial?.numeroGuia ?? ""}
              />
            </div>
            <div className="w-full shrink-0 sm:w-28">
              <PlanillaFotoChip
                vehiculoId={vehiculoId}
                tipo="bl_guia"
                existingUrl={blUrl}
                tone="dark"
                label="Foto"
                onUploaded={(docs) => setBlUrl(docs.bl_guia?.url ?? null)}
              />
            </div>
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
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3 sm:flex-row sm:items-end sm:justify-between md:col-span-2">
            <div className="min-w-0 flex-1">
              <Field
                label="Placa del vehículo"
                name="placaTexto"
                defaultValue={initial?.placaTexto ?? placa}
              />
            </div>
            <div className="w-full shrink-0 sm:w-28">
              <PlanillaFotoChip
                vehiculoId={vehiculoId}
                tipo="foto_placa"
                existingUrl={fotoPlacaUrl}
                tone="dark"
                label="Foto"
                onUploaded={(docs) => setFotoPlacaUrl(docs.foto_placa?.url ?? null)}
              />
            </div>
          </div>
          <Field
            label="VIN / chasis"
            name="vin"
            defaultValue={initial?.vin ?? prefill?.vin ?? ""}
          />
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3 sm:flex-row sm:items-end sm:justify-between md:col-span-2">
            <label className="block min-w-0 flex-1 space-y-1.5">
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
                className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
                placeholder="Solo números · foto del tablero"
              />
            </label>
            <div className="w-full shrink-0 sm:w-28">
              <PlanillaFotoChip
                vehiculoId={vehiculoId}
                tipo="foto_odometro"
                existingUrl={fotoTableroUrl}
                tone="dark"
                label="Foto"
                onUploaded={(docs) => setFotoTableroUrl(docs.foto_odometro?.url ?? null)}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Field
              label="Contenedor / remolque"
              name="contenedor"
              defaultValue={initial?.contenedor ?? ""}
            />
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 px-4 py-3">
        <p className="text-sm text-cyan-100">
          Exterior: OK / Daño / Foto en frontal, trasero y laterales. En el resto usa N/A si aplica.
        </p>
        <div className="mt-2">
          <PlanillaChecklistProgress
            marked={progresoGlobal.marked}
            total={progresoGlobal.total}
            tone="dark"
          />
        </div>
      </div>

      {TRANSPORTISTA_SECCIONES.filter((s) => s !== "evidencia").map((seccion) => {
        const items = transportistaPorSeccion(seccion);
        const marked = items.filter((i) => Boolean(checklist[i.id])).length;
        const esRecepcionista = seccion === "datos_recepcion";
        const esExterior = seccion === "estado_exterior";

        return (
          <section
            key={seccion}
            className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {TRANSPORTISTA_SECCION_LABELS[seccion]}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {esRecepcionista
                    ? "Marca ✓ (sí) o ✗ (no) en cada verificación."
                    : esExterior
                      ? "OK / Daño. En frontal, trasero y laterales la 3ª columna es Foto."
                      : "OK si está bien, Daño si hay falla, N/A si no aplica."}
                </p>
              </div>
              {!esRecepcionista ? (
                <button
                  type="button"
                  onClick={() => marcarSeccionOk(seccion)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/40"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Todo OK
                </button>
              ) : null}
            </div>
            <div className="mt-3">
              <PlanillaChecklistProgress marked={marked} total={items.length} tone="dark" />
            </div>
            <ul className="mt-4 space-y-2.5">
              {items.map((item) => {
                const fotoTipo = EXTERIOR_FOTO_POR_ITEM[item.id];
                return (
                  <PlanillaChecklistRow
                    key={item.id}
                    etiqueta={item.etiqueta}
                    value={checklist[item.id]}
                    opciones={opcionesParaSeccion(seccion, item.id)}
                    onChange={(v) => setItem(item.id, v)}
                    tone="dark"
                    foto={
                      fotoTipo
                        ? {
                            vehiculoId,
                            tipo: fotoTipo,
                            url: fotosLados[fotoTipo],
                            onUploaded: (docs) =>
                              setFotosLados((prev) => ({
                                ...prev,
                                [fotoTipo]: docs[fotoTipo]?.url ?? null,
                              })),
                          }
                        : null
                    }
                  />
                );
              })}
            </ul>
          </section>
        );
      })}

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
    <label className="block min-w-0 space-y-1.5">
      <span className="text-sm text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
      />
    </label>
  );
}
