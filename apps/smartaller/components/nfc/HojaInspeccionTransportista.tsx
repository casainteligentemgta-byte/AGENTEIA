"use client";

import { Printer } from "lucide-react";
import {
  TRANSPORTISTA_CHECKLIST,
  TRANSPORTISTA_SECCION_LABELS,
  TRANSPORTISTA_SECCIONES,
  transportistaPorSeccion,
} from "@/lib/puerto-libre/inspeccion/catalog";
import { getAppHost } from "@/lib/app-url";

function LineField({
  label,
  hint,
  wide,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <span className="text-[11px] font-medium text-zinc-600">{label}</span>
      {hint ? <p className="text-[10px] text-zinc-500">{hint}</p> : null}
      <div className="mt-0.5 border-b border-zinc-400 pb-4" />
    </div>
  );
}

export function HojaInspeccionTransportista() {
  return (
    <>
      <div className="mb-6 flex justify-end print:hidden">
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
            <LineField label="Transportista" />
            <LineField
              label="Nº guía / BL"
              hint="Adjuntar foto o PDF del BL"
            />
            <LineField label="Fecha de recepción" hint="Seleccionar en calendario" />
            <LineField label="Lugar de recepción" />
            <LineField label="Contenedor / remolque" />
            <LineField
              label="Placa del vehículo (texto)"
              hint="Adjuntar foto o PDF de la placa"
            />
            <LineField label="VIN / chasis" />
            <LineField label="Kilometraje al recibir" hint="Solo números" />
          </div>
        </section>

        {TRANSPORTISTA_SECCIONES.map((seccion, idx) => {
          const items = transportistaPorSeccion(seccion);
          return (
            <section key={seccion} className="mt-6">
              <h2 className="mb-3 text-sm font-bold uppercase text-zinc-800">
                {idx + 2}. {TRANSPORTISTA_SECCION_LABELS[seccion]}
              </h2>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100">
                    <th className="border border-zinc-300 px-2 py-1.5 text-left">Ítem</th>
                    <th className="border border-zinc-300 px-2 py-1.5 text-center w-16">
                      Con daño
                    </th>
                    <th className="border border-zinc-300 px-2 py-1.5 text-center w-14">N/A</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-zinc-300 px-2 py-1.5">{item.etiqueta}</td>
                      <td className="border border-zinc-300" />
                      <td className="border border-zinc-300" />
                    </tr>
                  ))}
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
            (mismo flujo que la recepción en taller).
          </p>
          <div className="min-h-[72px] border border-zinc-300" />
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase text-zinc-800">
            {TRANSPORTISTA_SECCIONES.length + 3}. Observaciones
          </h2>
          <div className="min-h-[72px] border border-zinc-300" />
        </section>

        <section className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold text-zinc-700">Receptor (SmartTaller / cliente)</p>
            <div className="mt-8 border-b border-zinc-400" />
            <p className="mt-1 text-[10px] text-zinc-500">Nombre y firma</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700">Transportista</p>
            <div className="mt-8 border-b border-zinc-400" />
            <p className="mt-1 text-[10px] text-zinc-500">Nombre y firma</p>
          </div>
        </section>

        <footer className="mt-8 border-t border-zinc-200 pt-3 text-center text-[10px] text-zinc-500">
          {getAppHost()} · Planilla recepción en puerto · {TRANSPORTISTA_CHECKLIST.length} ítems
        </footer>
      </article>
    </>
  );
}
