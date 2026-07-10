"use client";

import { ClipboardCheck } from "lucide-react";
import { ChecklistMarcaCelda } from "@/components/dashboard/checklist-marca-celda";
import { EstadoVisualFotos } from "@/components/dashboard/estado-visual-fotos";
import { FirmaExpandible } from "@/components/dashboard/firma-expandible";
import {
  RECEPCION_CHECKLIST_SECCION,
  RECEPCION_SECCION_LABELS,
  NIVEL_COMBUSTIBLE,
  NIVEL_COMBUSTIBLE_LABELS,
  NOTA_AUTORIZACION_PROPIETARIO,
  checklistToMarcaRecord,
  marcaRecordToChecklist,
  type ChecklistMarca,
  type OrdenRecepcionFormValue,
} from "@/lib/schemas/orden-recepcion";
import { emptyEstadoVisualSlots } from "@/lib/schemas/estado-visual-recepcion";
import { checklistPorSeccion } from "@/lib/recepcion/catalog";
import { FichaVehiculoInspeccionResumen } from "@/components/dashboard/ficha-vehiculo-inspeccion-resumen";
import type { FichaVehiculoInspeccion } from "@/lib/ordenes-recepcion/ficha-vehiculo";

type Props = {
  value: OrdenRecepcionFormValue;
  onChange: (value: OrdenRecepcionFormValue) => void;
  odometroLabel?: string;
  fichaVehiculo?: FichaVehiculoInspeccion;
  vehiculoId?: string;
  abrirCamaraFrontal?: boolean;
};

export function OrdenRecepcionForm({
  value,
  onChange,
  odometroLabel = "Kilometraje",
  fichaVehiculo,
  vehiculoId,
  abrirCamaraFrontal,
}: Props) {
  const checklistRecord = checklistToMarcaRecord(value.checklist ?? []);
  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  function patch(partial: OrdenRecepcionFormValue) {
    onChange({ ...value, ...partial });
  }

  function setChecklistMarca(itemId: string, marca: ChecklistMarca | undefined) {
    const next = { ...checklistRecord, [itemId]: marca };
    patch({ checklist: marcaRecordToChecklist(next) });
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

      {fichaVehiculo && <FichaVehiculoInspeccionResumen ficha={fichaVehiculo} />}

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">
          2. Estado visual — foto frontal y demás vistas
        </h3>
        <EstadoVisualFotos
          value={value.estadoVisual ?? { fotos: emptyEstadoVisualSlots() }}
          onChange={(estadoVisual) => patch({ estadoVisual })}
          vehiculoId={vehiculoId}
          abrirCamaraFrontal={abrirCamaraFrontal}
        />
      </div>

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Ingreso al taller</h3>
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
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Nivel de combustible</label>
            <select
              value={value.nivelCombustible ?? ""}
              onChange={(e) =>
                patch({
                  nivelCombustible: e.target.value
                    ? (e.target.value as OrdenRecepcionFormValue["nivelCombustible"])
                    : undefined,
                })
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Seleccionar…</option>
              {NIVEL_COMBUSTIBLE.map((n) => (
                <option key={n} value={n}>
                  {NIVEL_COMBUSTIBLE_LABELS[n]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-6">
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
            placeholder="Ej. Rev. 15000 kms"
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
              3. {RECEPCION_SECCION_LABELS[seccion]}
            </h3>
            <p className="mb-2 text-xs text-zinc-500">Marque ✓ (correcto/presente) o X (falla/ausente)</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="pb-2 pr-4 font-medium">Ítem</th>
                    <th className="pb-2 w-24 text-center font-medium">✓ / X</th>
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
                          <ChecklistMarcaCelda
                            marca={checklistRecord[item.id]}
                            onChange={(marca) => setChecklistMarca(item.id, marca)}
                          />
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

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={value.autorizacionPropietario ?? false}
            onChange={(e) => patch({ autorizacionPropietario: e.target.checked })}
            className="mt-1 rounded border-zinc-600"
          />
          <span>{NOTA_AUTORIZACION_PROPIETARIO}</span>
        </label>
      </div>

      <div className="grid gap-4 border-t border-zinc-800 pt-5 sm:grid-cols-2">
        <FirmaExpandible
          label="Firma del cliente"
          value={value.firmaCliente ?? ""}
          onChange={(firmaCliente) => patch({ firmaCliente })}
        />
        <FirmaExpandible
          label="Firma del asesor de servicios"
          value={value.firmaAsesor ?? ""}
          onChange={(firmaAsesor) => patch({ firmaAsesor })}
        />
      </div>
    </section>
  );
}
