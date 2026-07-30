"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, ChevronDown, Pencil, Search, X } from "lucide-react";
import type { PuertoLibreVehiculoListItem } from "@/app/actions/nfc/puerto-libre-vehiculo";

export type PlanillaVehiculoOption = Pick<
  PuertoLibreVehiculoListItem,
  "id" | "placa" | "marca" | "modelo" | "color" | "codigoExpediente" | "fotoUrl" | "created_at"
>;

type Props = {
  current: PlanillaVehiculoOption;
  vehiculos: PlanillaVehiculoOption[];
};

function tituloLinea(v: PlanillaVehiculoOption): string {
  const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(" - ");
  if (marcaModelo) return marcaModelo;
  return v.codigoExpediente || v.placa || "Vehículo";
}

function codigoLinea(v: PlanillaVehiculoOption): string {
  return v.codigoExpediente || v.placa;
}

/** Color · placa (solo si hay placa real, no el código de expediente). */
function colorPlacaLinea(v: PlanillaVehiculoOption): string {
  const placa =
    v.placa?.trim() &&
    v.placa.trim().toUpperCase() !== (v.codigoExpediente ?? "").trim().toUpperCase()
      ? v.placa.trim()
      : "";
  return [v.color, placa].filter(Boolean).join(" · ");
}

export function PlanillaVehiculoSelector({ current, vehiculos }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return vehiculos;
    return vehiculos.filter((v) => {
      const hay = [v.codigoExpediente, v.placa, v.marca, v.modelo, v.color]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [vehiculos, q]);

  function selectVehiculo(id: string) {
    setOpen(false);
    setQ("");
    if (id === current.id) return;
    router.push(`/puerto-libre/${id}/planilla`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-700/80 bg-white p-3 text-left shadow-md transition hover:shadow-lg active:scale-[0.99]"
      >
        <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400">
          {current.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.fotoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Car className="h-8 w-8" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-zinc-900">
            Auto {codigoLinea(current)}
          </p>
          <p className="truncate text-sm text-zinc-700">{tituloLinea(current)}</p>
          {colorPlacaLinea(current) ? (
            <p className="truncate text-sm capitalize text-zinc-500">
              {colorPlacaLinea(current)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2 self-stretch py-0.5">
          <ChevronDown className="h-5 w-5 text-zinc-500" />
          <Pencil className="h-4 w-4 text-zinc-400" />
        </div>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/80 backdrop-blur-sm">
          <div className="mt-auto max-h-[85vh] overflow-hidden rounded-t-3xl border border-slate-700 bg-zinc-950 shadow-2xl sm:mx-auto sm:mb-8 sm:mt-16 sm:w-full sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">Seleccionar vehículo</p>
                <p className="text-xs text-zinc-500">
                  Lista de expedientes nuevos (actualizable)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQ("");
                }}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-800 px-4 py-3">
              <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por expediente, marca, modelo…"
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
                />
              </label>
            </div>

            <ul className="max-h-[55vh] space-y-2 overflow-y-auto px-4 py-3">
              {filtered.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
                  No hay vehículos que coincidan
                </li>
              ) : (
                filtered.map((v) => {
                  const active = v.id === current.id;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => selectVehiculo(v.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                          active
                            ? "border-cyan-500/50 bg-cyan-950/30"
                            : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-800 text-slate-500">
                          {v.fotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.fotoUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Car className="h-6 w-6" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-sm font-semibold text-cyan-300">
                            {codigoLinea(v)}
                          </p>
                          <p className="truncate text-sm text-slate-200">{tituloLinea(v)}</p>
                          {colorPlacaLinea(v) ? (
                            <p className="truncate text-xs capitalize text-slate-500">
                              {colorPlacaLinea(v)}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
