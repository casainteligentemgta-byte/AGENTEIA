"use client";

import { Printer } from "lucide-react";
import {
  RECEPCION_CHECKLIST_SECCION,
  RECEPCION_SECCION_LABELS,
  NIVEL_COMBUSTIBLE_LABELS,
  NOTA_AUTORIZACION_PROPIETARIO,
} from "@/lib/schemas/orden-recepcion";
import {
  ESTADO_VISUAL_VISTAS,
  ESTADO_VISUAL_VISTA_LABELS,
} from "@/lib/schemas/estado-visual-recepcion";
import { checklistPorSeccion } from "@/lib/recepcion/catalog";

function LineField({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <span className="text-[11px] font-medium text-zinc-600">{label}</span>
      <div className="mt-0.5 border-b border-zinc-400 pb-4" />
    </div>
  );
}

function MarcaCell() {
  return (
    <td className="h-7 w-14 border border-zinc-300 text-center text-xs font-bold">✓ / X</td>
  );
}

export function HojaInspeccionPlantilla() {
  function handlePrint() {
    window.print();
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-zinc-400">
          Planilla en blanco — usa <strong className="text-zinc-200">Imprimir</strong> y guarda como PDF
        </p>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </button>
      </div>

      <article className="mx-auto max-w-4xl bg-white p-6 text-zinc-900 shadow-xl print:max-w-none print:p-0 print:shadow-none sm:p-10">
        <header className="border-b-2 border-zinc-800 pb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">SmartTaller</p>
          <h1 className="mt-1 text-xl font-bold uppercase tracking-wide">
            Hoja de inspección — Orden de recepción
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Inspección técnica al ingreso del vehículo al taller
          </p>
        </header>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase text-zinc-800">
            1. Información del propietario y vehículo
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <LineField label="Cliente" />
            <LineField label="Teléfono" />
            <LineField label="Placa" />
            <LineField label="Modelo" />
            <LineField label="Color" />
            <LineField label="Chasis" />
            <LineField label="Kilometraje (km)" />
            <div>
              <span className="text-[11px] font-medium text-zinc-600">Nivel de combustible</span>
              <div className="mt-1 flex flex-wrap gap-3 text-[10px]">
                {Object.values(NIVEL_COMBUSTIBLE_LABELS).map((l) => (
                  <label key={l} className="flex items-center gap-1">
                    <span className="inline-block h-3.5 w-3.5 border border-zinc-500" />
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LineField label="Fecha ingreso" />
              <LineField label="Hora" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-6 text-xs">
            <label className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 border border-zinc-500" />
              Llegó en grúa
            </label>
            <label className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 border border-zinc-500" />
              Vehículo sucio
            </label>
          </div>
          <div className="mt-3">
            <LineField label="Estado de ingreso / observaciones" wide />
          </div>
          <div className="mt-3">
            <LineField label="Motivo de la visita (trabajo solicitado)" wide />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase text-zinc-800">2. Checklist de inspección</h2>
          <p className="mb-4 text-[10px] text-zinc-600">
            Marque en cada ítem: <strong>✓</strong> correcto/presente o <strong>X</strong> falla/ausente
          </p>

          {RECEPCION_CHECKLIST_SECCION.map((seccion) => {
            const items = checklistPorSeccion(seccion);
            let lastSub = "";

            return (
              <div key={seccion} className="mb-6 break-inside-avoid">
                <h3 className="mb-2 border-b border-zinc-300 pb-1 text-xs font-bold text-zinc-800">
                  {RECEPCION_SECCION_LABELS[seccion]}
                </h3>
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-zinc-100">
                      <th className="border border-zinc-300 px-2 py-1 text-left font-semibold">Ítem</th>
                      <th className="border border-zinc-300 px-2 py-1 text-center font-semibold w-16">
                        ✓ / X
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const showSub = item.subseccion !== lastSub;
                      if (showSub) lastSub = item.subseccion;
                      return (
                        <tr key={item.id}>
                          <td className="border border-zinc-300 px-2 py-1">
                            {showSub && (
                              <span className="block text-[9px] font-semibold uppercase text-zinc-500">
                                {item.subseccion}
                              </span>
                            )}
                            {item.etiqueta}
                          </td>
                          <MarcaCell />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>

        <section className="mt-8 break-inside-avoid">
          <h2 className="mb-3 text-sm font-bold uppercase text-zinc-800">
            3. Estado visual — fotos del vehículo
          </h2>
          <p className="mb-4 text-[10px] text-zinc-600">
            Tome 4 fotos (frontal, trasero y laterales). Marque rayones, golpes u observaciones con
            lápiz sobre cada imagen.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {ESTADO_VISUAL_VISTAS.map((vista) => (
              <div key={vista} className="break-inside-avoid">
                <p className="mb-1 text-[10px] font-semibold text-zinc-700">
                  {ESTADO_VISUAL_VISTA_LABELS[vista]}
                </p>
                <div className="flex aspect-[4/3] items-center justify-center border-2 border-dashed border-zinc-400 bg-zinc-50 text-[9px] text-zinc-500">
                  Foto + anotaciones
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 break-inside-avoid border-t border-zinc-300 pt-6">
          <h2 className="mb-4 text-sm font-bold uppercase text-zinc-800">4. Autorización y validación</h2>

          <div className="mb-6 rounded border border-zinc-300 bg-zinc-50 p-3 text-[10px] leading-relaxed text-zinc-700">
            <label className="flex items-start gap-2">
              <span className="mt-0.5 inline-block h-4 w-4 shrink-0 border border-zinc-500" />
              <span>{NOTA_AUTORIZACION_PROPIETARIO}</span>
            </label>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-zinc-600">Firma del cliente</p>
              <div className="mt-8 border-b border-zinc-500" />
              <p className="mt-1 text-[10px] text-zinc-500">Nombre y conformidad</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600">Firma del asesor de servicios</p>
              <div className="mt-8 border-b border-zinc-500" />
              <p className="mt-1 text-[10px] text-zinc-500">Taller SmartTaller</p>
            </div>
          </div>
        </section>

        <footer className="mt-8 text-center text-[9px] text-zinc-400">
          Documento generado por SmartTaller · smartaller.vercel.app
        </footer>
      </article>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          nav,
          aside,
          header:not(article header),
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
