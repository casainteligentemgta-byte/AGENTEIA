"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import {
  TRANSPORTISTA_CHECKLIST,
  TRANSPORTISTA_SECCION_LABELS,
  TRANSPORTISTA_SECCIONES,
  transportistaPorSeccion,
} from "@/lib/puerto-libre/inspeccion/catalog";
import { getAppHost } from "@/lib/app-url";

type ChecklistMark = "" | "ok" | "fail" | "dano" | "na";

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
    <label className={wide ? "col-span-2 block" : "block"}>
      <span className="text-[11px] font-medium text-zinc-600">{label}</span>
      {hint ? <p className="text-[10px] text-zinc-500">{hint}</p> : null}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        inputMode={type === "number" ? "numeric" : undefined}
        min={type === "number" ? 0 : undefined}
        className="mt-0.5 w-full border-0 border-b border-zinc-400 bg-transparent px-0 py-1 text-sm text-zinc-900 outline-none focus:border-cyan-600 print:border-zinc-500"
      />
    </label>
  );
}

export function HojaInspeccionTransportista() {
  const [marks, setMarks] = useState<Record<string, ChecklistMark>>(() => {
    const init: Record<string, ChecklistMark> = {};
    for (const item of TRANSPORTISTA_CHECKLIST) {
      init[item.id] = "";
    }
    return init;
  });

  function toggleMark(id: string, value: Exclude<ChecklistMark, "">) {
    setMarks((prev) => ({
      ...prev,
      [id]: prev[id] === value ? "" : value,
    }));
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-zinc-400">
          Rellena aquí para imprimir. Para{" "}
          <strong className="font-medium text-zinc-200">guardar en Supabase</strong> usa la
          planilla digital del vehículo.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </button>
      </div>

      <article className="mx-auto max-w-4xl bg-white p-6 text-zinc-900 shadow-xl print:max-w-none print:p-0 print:shadow-none sm:p-10">
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
          <h2 className="mb-3 text-sm font-bold uppercase text-zinc-800">
            1. Datos de la recepción
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <FillField label="Importadora" name="importadora" />
            <FillField label="Transportista" name="transportista" />
            <FillField
              label="Nº guía / BL"
              name="numeroGuia"
              hint="Adjuntar foto o PDF del BL al expediente digital"
            />
            <FillField
              label="Fecha de recepción"
              name="fechaRecepcion"
              type="date"
              hint="Seleccionar en calendario"
            />
            <FillField label="Lugar de recepción" name="lugarRecepcion" />
            <FillField
              label="Placa del vehículo (texto)"
              name="placaTexto"
              hint="Adjuntar foto o PDF de la placa al expediente digital"
            />
            <FillField label="VIN / chasis" name="vin" />
            <FillField
              label="Kilometraje al recibir"
              name="kilometraje"
              type="number"
              hint="Solo números"
            />
            <FillField label="Contenedor / remolque" name="contenedor" wide />
          </div>
        </section>

        {TRANSPORTISTA_SECCIONES.map((seccion, idx) => {
          const items = transportistaPorSeccion(seccion);
          const esRecepcionista = seccion === "datos_recepcion";
          return (
            <section key={seccion} className="mt-6 break-inside-avoid">
              <h2 className="mb-3 text-sm font-bold uppercase text-zinc-800">
                {idx + 2}. {TRANSPORTISTA_SECCION_LABELS[seccion]}
              </h2>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100">
                    <th className="border border-zinc-300 px-2 py-1.5 text-left">Ítem</th>
                    {esRecepcionista ? (
                      <>
                        <th className="border border-zinc-300 px-2 py-1.5 text-center w-16">✓</th>
                        <th className="border border-zinc-300 px-2 py-1.5 text-center w-16">✗</th>
                      </>
                    ) : (
                      <>
                        <th className="border border-zinc-300 px-2 py-1.5 text-center w-20">
                          Con daño
                        </th>
                        <th className="border border-zinc-300 px-2 py-1.5 text-center w-16">N/A</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const mark = marks[item.id] ?? "";
                    if (esRecepcionista) {
                      return (
                        <tr key={item.id}>
                          <td className="border border-zinc-300 px-2 py-1.5">{item.etiqueta}</td>
                          <td className="border border-zinc-300 text-center">
                            <input
                              type="checkbox"
                              checked={mark === "ok"}
                              onChange={() => toggleMark(item.id, "ok")}
                              aria-label={`${item.etiqueta}: sí`}
                              className="h-4 w-4 accent-emerald-600"
                            />
                          </td>
                          <td className="border border-zinc-300 text-center">
                            <input
                              type="checkbox"
                              checked={mark === "fail"}
                              onChange={() => toggleMark(item.id, "fail")}
                              aria-label={`${item.etiqueta}: no`}
                              className="h-4 w-4 accent-red-600"
                            />
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={item.id}>
                        <td className="border border-zinc-300 px-2 py-1.5">{item.etiqueta}</td>
                        <td className="border border-zinc-300 text-center">
                          <input
                            type="checkbox"
                            checked={mark === "dano"}
                            onChange={() => toggleMark(item.id, "dano")}
                            aria-label={`${item.etiqueta}: con daño`}
                            className="h-4 w-4 accent-red-600"
                          />
                        </td>
                        <td className="border border-zinc-300 text-center">
                          <input
                            type="checkbox"
                            checked={mark === "na"}
                            onChange={() => toggleMark(item.id, "na")}
                            aria-label={`${item.etiqueta}: N/A`}
                            className="h-4 w-4 accent-zinc-600"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase text-zinc-800">
            {TRANSPORTISTA_SECCIONES.length + 2}. Evidencia fotográfica y daños
          </h2>
          <p className="mb-2 text-[11px] text-zinc-600">
            Fotos frontal / trasera / laterales / VIN / odómetro. Marcar daños sobre la foto
            (mismo flujo que la recepción en taller) en el expediente digital.
          </p>
          <textarea
            name="evidenciaNotas"
            rows={3}
            placeholder="Notas de evidencia o daños visibles…"
            className="min-h-[72px] w-full resize-y border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-cyan-600"
          />
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase text-zinc-800">
            {TRANSPORTISTA_SECCIONES.length + 3}. Observaciones
          </h2>
          <textarea
            name="observaciones"
            rows={3}
            placeholder="Observaciones de la recepción…"
            className="min-h-[72px] w-full resize-y border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-cyan-600"
          />
        </section>

        <section className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold text-zinc-700">Receptor (SmartTaller / cliente)</p>
            <input
              name="receptorNombre"
              placeholder="Nombre"
              className="mt-2 w-full border-0 border-b border-zinc-400 bg-transparent px-0 py-1 text-sm outline-none focus:border-cyan-600"
            />
            <div className="mt-8 border-b border-zinc-400" />
            <p className="mt-1 text-[10px] text-zinc-500">Firma</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700">Transportista</p>
            <input
              name="transportistaNombre"
              placeholder="Nombre"
              className="mt-2 w-full border-0 border-b border-zinc-400 bg-transparent px-0 py-1 text-sm outline-none focus:border-cyan-600"
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
