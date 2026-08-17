"use client";

import {
  ESTADO_RECEPCION,
  ESTADO_RECEPCION_LABELS,
  INVENTARIO_RECEPCION_ITEMS,
  NIVEL_COMBUSTIBLE,
  NIVEL_COMBUSTIBLE_LABELS,
  SISTEMAS_RECEPCION,
  ZONAS_EXTERIOR,
  type EstadoRecepcion,
  type NivelCombustible,
  type RecepcionVehiculo,
} from "@/lib/schemas/recepcion-vehiculo";
import { ClipboardCheck } from "lucide-react";

export type RecepcionVehiculoFormValue = Partial<RecepcionVehiculo>;

type Props = {
  value: RecepcionVehiculoFormValue;
  onChange: (value: RecepcionVehiculoFormValue) => void;
  odometroLabel?: string;
};

function EstadoSelect({
  name,
  value,
  onChange,
}: {
  name: string;
  value: EstadoRecepcion;
  onChange: (v: EstadoRecepcion) => void;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value as EstadoRecepcion)}
      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
    >
      {ESTADO_RECEPCION.map((e) => (
        <option key={e} value={e}>
          {ESTADO_RECEPCION_LABELS[e]}
        </option>
      ))}
    </select>
  );
}

export function RecepcionVehiculoSection({ value, onChange, odometroLabel = "Kilometraje" }: Props) {
  const exterior = value.exterior ?? {};
  const sistemas = value.sistemas ?? {};
  const inventario = value.inventario ?? {};

  function patch(partial: RecepcionVehiculoFormValue) {
    onChange({ ...value, ...partial });
  }

  function setExterior(id: string, estado: EstadoRecepcion) {
    patch({ exterior: { ...exterior, [id]: estado } });
  }

  function setSistema(id: string, estado: EstadoRecepcion) {
    patch({ sistemas: { ...sistemas, [id]: estado } });
  }

  function toggleInventario(id: string) {
    patch({ inventario: { ...inventario, [id]: !inventario[id] } });
  }

  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  return (
    <section className="glass rounded-2xl border border-blue-500/20 p-6">
      <div className="mb-6 flex items-start gap-3 border-b border-zinc-800 pb-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Acta de recepción del vehículo</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Orden de ingreso — estado del vehículo al momento de recibirlo en el taller
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
              value={value.kilometrajeIngreso ?? ""}
              onChange={(e) =>
                patch({
                  kilometrajeIngreso: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Ej. 45230"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Nivel de combustible</label>
            <select
              value={value.nivelCombustible ?? "1_2"}
              onChange={(e) => patch({ nivelCombustible: e.target.value as NivelCombustible })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {NIVEL_COMBUSTIBLE.map((n) => (
                <option key={n} value={n}>
                  {NIVEL_COMBUSTIBLE_LABELS[n]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-zinc-500">Motivo de ingreso / trabajo solicitado</label>
          <textarea
            rows={2}
            value={value.motivoIngreso ?? ""}
            onChange={(e) => patch({ motivoIngreso: e.target.value })}
            placeholder="Ej. Revisión general, ruido en frenos, cambio de aceite…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Inventario entregado con el vehículo</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {INVENTARIO_RECEPCION_ITEMS.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300"
            >
              <input
                type="checkbox"
                checked={Boolean(inventario[item.id])}
                onChange={() => toggleInventario(item.id)}
                className="rounded border-zinc-600"
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Estado exterior</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="pb-2 pr-4 font-medium">Zona</th>
                <th className="pb-2 w-28 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ZONAS_EXTERIOR.map((z) => (
                <tr key={z.id} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 text-zinc-300">{z.label}</td>
                  <td className="py-2">
                    <EstadoSelect
                      name={`exterior_${z.id}`}
                      value={(exterior[z.id] as EstadoRecepcion) ?? "na"}
                      onChange={(v) => setExterior(z.id, v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Sistemas, fluidos e interior</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="pb-2 pr-4 font-medium">Ítem</th>
                <th className="pb-2 w-28 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {SISTEMAS_RECEPCION.map((s) => (
                <tr key={s.id} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 text-zinc-300">{s.label}</td>
                  <td className="py-2">
                    <EstadoSelect
                      name={`sistema_${s.id}`}
                      value={(sistemas[s.id] as EstadoRecepcion) ?? "na"}
                      onChange={(v) => setSistema(s.id, v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Daños u observaciones preexistentes</label>
          <textarea
            rows={3}
            value={value.danosPreexistentes ?? ""}
            onChange={(e) => patch({ danosPreexistentes: e.target.value })}
            placeholder="Rayones, golpes, piezas faltantes, testigos encendidos…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Objetos de valor reportados</label>
          <textarea
            rows={3}
            value={value.objetosValor ?? ""}
            onChange={(e) => patch({ objetosValor: e.target.value })}
            placeholder="Documentos, equipos, pertenencias en el vehículo…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="mt-6 space-y-4 border-t border-zinc-800 pt-5">
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={value.autorizaDiagnostico !== false}
            onChange={(e) => patch({ autorizaDiagnostico: e.target.checked })}
            className="mt-0.5 rounded border-zinc-600"
          />
          El propietario autoriza el diagnóstico y las pruebas necesarias sobre el vehículo.
        </label>

        <div>
          <label className="mb-1 block text-xs text-zinc-500">Nombre del propietario (conformidad)</label>
          <input
            type="text"
            value={value.firmaCliente ?? ""}
            onChange={(e) => patch({ firmaCliente: e.target.value })}
            placeholder="Firma digital — nombre completo"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </section>
  );
}
