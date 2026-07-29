"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Printer } from "lucide-react";
import {
  TRANSPORTISTA_CHECKLIST,
  TRANSPORTISTA_SECCION_LABELS,
  TRANSPORTISTA_SECCIONES,
  transportistaPorSeccion,
  type TransportistaSeccion,
} from "@/lib/puerto-libre/inspeccion/catalog";
import { getAppHost } from "@/lib/app-url";
import type { ChecklistRespuesta } from "@/lib/schemas/inspeccion-transportista";
import {
  opcionesParaSeccion,
  PlanillaChecklistProgress,
  PlanillaChecklistRow,
} from "@/components/nfc/PlanillaChecklistTap";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import type { DocumentoTipo, VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";

function FillField({
  label,
  hint,
  wide,
  type = "text",
  name,
  defaultValue,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  type?: "text" | "date" | "number";
  name: string;
  defaultValue?: string;
}) {
  return (
    <label
      className={`flex min-w-0 flex-col gap-1 ${wide ? "md:col-span-2" : ""}`}
    >
      <span className="text-xs font-semibold text-zinc-700">{label}</span>
      {hint ? <span className="text-[11px] leading-snug text-zinc-500">{hint}</span> : null}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        inputMode={type === "number" ? "numeric" : undefined}
        min={type === "number" ? 0 : undefined}
        className="box-border w-full min-w-0 border-0 border-b-2 border-zinc-300 bg-transparent px-0 py-2 text-base text-zinc-900 outline-none focus:border-cyan-600 sm:text-sm print:border-zinc-500"
      />
    </label>
  );
}

function AdjuntoCampo({
  vehiculoId,
  tipo,
  url,
  onUrl,
  actionLabel,
  hint,
  sinVehiculoMsg,
}: {
  vehiculoId: string | null;
  tipo: DocumentoTipo;
  url: string | null;
  onUrl: (url: string | null) => void;
  actionLabel: string;
  hint: string;
  sinVehiculoMsg: string;
}) {
  return (
    <>
      {vehiculoId ? (
        <ImportDocumentoUpload
          vehiculoId={vehiculoId}
          tipo={tipo}
          existingUrl={url}
          tone="light"
          hint={hint}
          actionLabel={actionLabel}
          onUploaded={(docs) => onUrl(docs[tipo]?.url ?? null)}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-xs text-zinc-600 print:hidden">
          {sinVehiculoMsg}
        </p>
      )}
      {url ? (
        <p className="hidden text-[11px] text-zinc-600 print:block">
          Archivo adjunto en expediente digital.
        </p>
      ) : null}
    </>
  );
}

function defaultMarks(): Record<string, ChecklistRespuesta | ""> {
  const init: Record<string, ChecklistRespuesta | ""> = {};
  for (const item of TRANSPORTISTA_CHECKLIST) {
    init[item.id] = "";
  }
  return init;
}

type Props = {
  vehiculoId?: string | null;
  initialDocumentos?: VehiculosDocumentos | null;
};

export function HojaInspeccionTransportista({
  vehiculoId = null,
  initialDocumentos = null,
}: Props) {
  const [marks, setMarks] = useState(defaultMarks);
  const [blUrl, setBlUrl] = useState<string | null>(
    initialDocumentos?.bl_guia?.url ?? null
  );
  const [fotoPlacaUrl, setFotoPlacaUrl] = useState<string | null>(
    initialDocumentos?.foto_placa?.url ?? null
  );
  const [fotoTableroUrl, setFotoTableroUrl] = useState<string | null>(
    initialDocumentos?.foto_odometro?.url ?? null
  );

  function setMark(id: string, value: ChecklistRespuesta) {
    setMarks((prev) => ({
      ...prev,
      [id]: prev[id] === value ? "" : value,
    }));
  }

  function marcarSeccionOk(seccion: TransportistaSeccion) {
    setMarks((prev) => {
      const next = { ...prev };
      for (const item of transportistaPorSeccion(seccion)) {
        next[item.id] = "sin_dano";
      }
      return next;
    });
  }

  const totales = useMemo(() => {
    const marked = TRANSPORTISTA_CHECKLIST.filter((i) => Boolean(marks[i.id])).length;
    return { marked, total: TRANSPORTISTA_CHECKLIST.length };
  }, [marks]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="min-w-[12rem] flex-1">
          <p className="text-sm text-zinc-400">
            Toca ✓ / ✗ en cada ítem. Luego{" "}
            <strong className="font-medium text-zinc-200">Imprimir / PDF</strong>.
          </p>
          <div className="mt-2 max-w-xs">
            <PlanillaChecklistProgress
              marked={totales.marked}
              total={totales.total}
              tone="dark"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
        >
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </button>
      </div>

      <article className="mx-auto max-w-4xl overflow-x-hidden bg-white p-4 text-zinc-900 shadow-xl print:max-w-none print:overflow-visible print:p-0 print:shadow-none sm:p-8 md:p-10">
        <header className="border-b-2 border-zinc-800 pb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            SmartTaller · Puerto Libre
          </p>
          <h1 className="mt-1 text-xl font-bold uppercase tracking-wide">
            Planilla recepción en puerto
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Acta de recepción del vehículo en la empresa transportista / puerto
          </p>
        </header>

        <section className="mt-6">
          <h2 className="mb-4 text-sm font-bold uppercase text-zinc-800">
            1. Datos de la recepción
          </h2>
          {/* 1 columna en móvil (evita solapes); 2 cols desde md / impresión */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-8 md:gap-y-5 print:grid-cols-2">
            <FillField label="Importadora" name="importadora" />
            <FillField label="Transportista" name="transportista" />
            <div className="flex min-w-0 flex-col gap-3 md:col-span-2">
              <FillField label="Nº guía / BL" name="numeroGuia" />
              <AdjuntoCampo
                vehiculoId={vehiculoId}
                tipo="bl_guia"
                url={blUrl}
                onUrl={setBlUrl}
                actionLabel="Cargar foto o PDF del BL"
                hint="Foto o PDF del BL · se guarda en el expediente del vehículo"
                sinVehiculoMsg="Para cargar foto o PDF del BL y guardarlo, abre esta planilla desde la ficha del vehículo."
              />
            </div>
            <FillField
              label="Fecha de recepción"
              name="fechaRecepcion"
              type="date"
              hint="Seleccionar en calendario"
            />
            <FillField label="Lugar de recepción" name="lugarRecepcion" />
            <div className="flex min-w-0 flex-col gap-3 md:col-span-2">
              <FillField label="Placa del vehículo" name="placaTexto" />
              <AdjuntoCampo
                vehiculoId={vehiculoId}
                tipo="foto_placa"
                url={fotoPlacaUrl}
                onUrl={setFotoPlacaUrl}
                actionLabel="Cargar foto o PDF de la placa"
                hint="Foto o PDF de la placa · se guarda en el expediente"
                sinVehiculoMsg="Para cargar la foto de la placa, abre esta planilla desde la ficha del vehículo."
              />
            </div>
            <FillField label="VIN / chasis" name="vin" />
            <div className="flex min-w-0 flex-col gap-3 md:col-span-2">
              <FillField
                label="Kilometraje al recibir"
                name="kilometraje"
                type="number"
                hint="Solo números"
              />
              <AdjuntoCampo
                vehiculoId={vehiculoId}
                tipo="foto_odometro"
                url={fotoTableroUrl}
                onUrl={setFotoTableroUrl}
                actionLabel="Cargar foto o PDF del tablero"
                hint="Foto del odómetro / tablero · se guarda en el expediente"
                sinVehiculoMsg="Para cargar la foto del tablero, abre esta planilla desde la ficha del vehículo."
              />
            </div>
            <FillField label="Contenedor / remolque" name="contenedor" wide />
          </div>
        </section>

        {TRANSPORTISTA_SECCIONES.map((seccion, idx) => {
          const items = transportistaPorSeccion(seccion);
          const opciones = opcionesParaSeccion(seccion);
          const marked = items.filter((i) => Boolean(marks[i.id])).length;
          const esRecepcionista = seccion === "datos_recepcion";
          const esEvidencia = seccion === "evidencia";
          const puedeTodoOk = !esRecepcionista;

          return (
            <section key={seccion} className="mt-8 break-inside-avoid">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold uppercase text-zinc-800">
                    {idx + 2}. {TRANSPORTISTA_SECCION_LABELS[seccion]}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-zinc-500 print:hidden">
                    {esRecepcionista
                      ? "Marca ✓ (sí) o ✗ (no) en cada verificación."
                      : esEvidencia
                        ? "Marca si la foto ya está tomada. Las fotos se capturan en el expediente digital."
                        : "OK si está bien, Daño si hay falla, N/A si no aplica."}
                  </p>
                </div>
                {puedeTodoOk ? (
                  <button
                    type="button"
                    onClick={() => marcarSeccionOk(seccion)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 print:hidden"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    {esEvidencia ? "Todas tomadas" : "Todo OK"}
                  </button>
                ) : null}
              </div>

              <div className="mb-3 print:hidden">
                <PlanillaChecklistProgress marked={marked} total={items.length} tone="light" />
              </div>

              <ul className="space-y-2.5">
                {items.map((item) => (
                  <PlanillaChecklistRow
                    key={item.id}
                    etiqueta={item.etiqueta}
                    value={marks[item.id]}
                    opciones={opciones}
                    onChange={(v) => setMark(item.id, v)}
                    tone="light"
                  />
                ))}
              </ul>
            </section>
          );
        })}

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase text-zinc-800">
            {TRANSPORTISTA_SECCIONES.length + 2}. Observaciones
          </h2>
          <textarea
            name="observaciones"
            rows={3}
            placeholder="Observaciones de la recepción o daños visibles…"
            className="min-h-[72px] w-full resize-y rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-base text-zinc-900 outline-none focus:border-cyan-600 sm:text-sm"
          />
        </section>

        <section className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-zinc-700">Receptor (SmartTaller / cliente)</p>
            <input
              name="receptorNombre"
              placeholder="Nombre"
              className="mt-2 w-full border-0 border-b border-zinc-400 bg-transparent px-0 py-1.5 text-base outline-none focus:border-cyan-600 sm:text-sm"
            />
            <div className="mt-8 border-b border-zinc-400" />
            <p className="mt-1 text-[10px] text-zinc-500">Firma</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700">Transportista</p>
            <input
              name="transportistaNombre"
              placeholder="Nombre"
              className="mt-2 w-full border-0 border-b border-zinc-400 bg-transparent px-0 py-1.5 text-base outline-none focus:border-cyan-600 sm:text-sm"
            />
            <div className="mt-8 border-b border-zinc-400" />
            <p className="mt-1 text-[10px] text-zinc-500">Firma</p>
          </div>
        </section>

        <footer className="mt-8 border-t border-zinc-200 pt-3 text-center text-[10px] text-zinc-500">
          {getAppHost()} · Planilla recepción en puerto · {TRANSPORTISTA_CHECKLIST.length} ítems
        </footer>
      </article>
    </>
  );
}
