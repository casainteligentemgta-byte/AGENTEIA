"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { OrdenRecepcionDanosCanvas } from "@/components/dashboard/orden-recepcion-danos-canvas";
import {
  RECEPCION_CHECKLIST_SECCION,
  RECEPCION_CHECKLIST_VALOR,
  RECEPCION_CHECKLIST_VALOR_LABELS,
  RECEPCION_SECCION_LABELS,
  RECEPCION_TIPO_DANO,
  checklistToRecord,
  recordToChecklist,
  type OrdenRecepcionFormValue,
  type OrdenRecepcionDanoVisual,
  type OrdenRecepcionChecklistRespuesta,
} from "@/lib/schemas/orden-recepcion";
import { checklistPorSeccion } from "@/lib/recepcion/catalog";

type Props = {
  value: OrdenRecepcionFormValue;
  onChange: (value: OrdenRecepcionFormValue) => void;
  odometroLabel?: string;
};

export function OrdenRecepcionForm({ value, onChange, odometroLabel = "Kilometraje" }: Props) {
  const [tipoDanoActivo, setTipoDanoActivo] = useState<OrdenRecepcionDanoVisual["tipo"]>("rayado");

  const checklistRecord = checklistToRecord(value.checklist ?? []);
  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  function patch(partial: OrdenRecepcionFormValue) {
    onChange({ ...value, ...partial });
  }

  function setChecklistValor(itemId: string, valor: OrdenRecepcionChecklistRespuesta["valor"]) {
    const next = { ...checklistRecord, [itemId]: valor };
    patch({ checklist: recordToChecklist(next) });
  }

  return (
    <section className="glass rounded-2xl border border-blue-500/20 p-6">
      <div className="mb-6 flex items-start gap-3 border-b border-zinc-800 pb-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Orden de recepción del vehículo</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Formato de inspección al ingreso — checklist técnico, estado visual y firmas
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
          SmartTaller · Orden de recepción
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Fecha de ingreso</label>
            <input
              type="date"
              value={value.fechaIngreso || today}
              onChange={(e) => patch({ fechaIngreso: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Hora</label>
            <input
              type="time"
              value={value.horaIngreso || nowTime}
              onChange={(e) => patch({ horaIngreso: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">{odometroLabel} al ingreso</label>
            <input
              type="number"
              min={0}
              value={value.kilometraje ?? ""}
              onChange={(e) =>
                patch({ kilometraje: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="Ej. 15000"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-1">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={value.llegoGrua ?? false}
                onChange={(e) => patch({ llegoGrua: e.target.checked })}
                className="rounded border-zinc-600"
              />
              Llegó en grúa
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={value.vehiculoSucio ?? false}
                onChange={(e) => patch({ vehiculoSucio: e.target.checked })}
                className="rounded border-zinc-600"
              />
              Vehículo sucio
            </label>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-zinc-500">Estado de ingreso (notas)</label>
          <input
            value={value.estadoIngresoNotas ?? ""}
            onChange={(e) => patch({ estadoIngresoNotas: e.target.value })}
            placeholder="Observaciones al recibir el vehículo"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-zinc-500">Motivo de la visita</label>
          <textarea
            rows={2}
            value={value.motivoVisita ?? ""}
            onChange={(e) => patch({ motivoVisita: e.target.value })}
            placeholder='Ej. Rev. 15000 kms'
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {RECEPCION_CHECKLIST_SECCION.map((seccion) => {
        const items = checklistPorSeccion(seccion);
        let lastSub = "";

        return (
          <div key={seccion} className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-zinc-200">
              {RECEPCION_SECCION_LABELS[seccion]}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="pb-2 pr-4 font-medium">Ítem</th>
                    <th className="pb-2 w-32 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const showSub = item.subseccion !== lastSub;
                    if (showSub) lastSub = item.subseccion;
                    return (
                      <tr key={item.id} className="border-b border-zinc-800/50">
                        <td className="py-2 pr-4">
                          {showSub && (
                            <p className="mb-0.5 text-[10px] font-medium uppercase text-zinc-600">
                              {item.subseccion}
                            </p>
                          )}
                          <span className="text-zinc-300">{item.etiqueta}</span>
                        </td>
                        <td className="py-2">
                          <select
                            value={checklistRecord[item.id] ?? "no_aplica"}
                            onChange={(e) =>
                              setChecklistValor(
                                item.id,
                                e.target.value as OrdenRecepcionChecklistRespuesta["valor"]
                              )
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                          >
                            {RECEPCION_CHECKLIST_VALOR.map((v) => (
                              <option key={v} value={v}>
                                {RECEPCION_CHECKLIST_VALOR_LABELS[v]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Estado visual — esquema del vehículo</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {RECEPCION_TIPO_DANO.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipoDanoActivo(t)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                tipoDanoActivo === t
                  ? "border-blue-500 bg-blue-500/20 text-blue-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              Marcar: {t.replace("_", " ")}
            </button>
          ))}
        </div>
        <OrdenRecepcionDanosCanvas
          danos={value.danos ?? []}
          onChange={(danos) => patch({ danos })}
          tipoActivo={tipoDanoActivo}
        />
      </div>

      <div className="grid gap-4 border-t border-zinc-800 pt-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Firma del cliente</label>
          <input
            value={value.firmaCliente ?? ""}
            onChange={(e) => patch({ firmaCliente: e.target.value })}
            placeholder="Nombre completo del propietario"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Firma del asesor de servicios</label>
          <input
            value={value.firmaAsesor ?? ""}
            onChange={(e) => patch({ firmaAsesor: e.target.value })}
            placeholder="Nombre del asesor"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </section>
  );
}
