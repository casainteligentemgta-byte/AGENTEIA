"use client";

import { useMemo, useState, useTransition } from "react";
import { Calculator } from "lucide-react";
import { savePrecalculoArancelesAction } from "@/app/actions/nfc/importacion-vehiculo";
import {
  ARANCEL_PCT_DEFAULT,
  ARANCEL_PCT_MAX,
  ARANCEL_PCT_MIN,
  LUJO_CIF_UMBRAL_USD,
  LUJO_PCT_DEFAULT,
  LUJO_PCT_MAX,
  LUJO_PCT_MIN,
  formatBs,
  formatPct,
  formatUsd,
  inputFromImportacion,
  multiplicarPrecalculo,
  parseMoneyInput,
  precalcularAranceles,
  sumarPrecalculos,
  type PrecalculoAranceles,
} from "@/lib/importacion/precalculo-aranceles";

export type PrecalculoUnidad = {
  valorCif?: number | null;
  arancelPct?: number | null;
  tarifaAdValoremPct?: number | null;
  impuestoLujoPct?: number | null;
  tasaCambioBcv?: number | null;
};

type Props = {
  vehiculoId?: string;
  valorCif?: number | null;
  arancelPct?: number | null;
  tarifaAdValoremPct?: number | null;
  impuestoLujoPct?: number | null;
  tasaCambioBcv?: number | null;
  partidaArancelaria?: string | null;
  /** Unidades del mismo BL: se suman en lugar de multiplicar. */
  unidades?: PrecalculoUnidad[];
  canEdit?: boolean;
  onSaved?: () => void;
};

function TablaPrecalculo({
  calc,
  titulo,
}: {
  calc: PrecalculoAranceles;
  titulo?: string;
}) {
  return (
    <div className="overflow-x-auto">
      {titulo ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          {titulo}
        </p>
      ) : null}
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3 font-medium">Concepto</th>
            <th className="py-2 pr-3 font-medium">%</th>
            <th className="py-2 pr-3 text-right font-medium">Monto USD</th>
            <th className="py-2 text-right font-medium">Monto Bs</th>
          </tr>
        </thead>
        <tbody>
          {calc.lineas.map((linea) => {
            const isTotal = linea.concepto === "TOTAL";
            return (
              <tr
                key={linea.concepto}
                className={
                  isTotal
                    ? "border-t border-cyan-800/60 bg-cyan-950/30 font-semibold text-cyan-100"
                    : "border-b border-slate-800/80 text-slate-200"
                }
              >
                <td className="py-2 pr-3">{linea.concepto}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-400">
                  {formatPct(linea.pct)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatUsd(linea.usd)}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-300">
                  {formatBs(linea.bs)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PrecalculoArancelesCard({
  vehiculoId,
  valorCif,
  arancelPct,
  tarifaAdValoremPct,
  impuestoLujoPct,
  tasaCambioBcv,
  partidaArancelaria,
  unidades,
  canEdit = Boolean(vehiculoId),
  onSaved,
}: Props) {
  const [cifStr, setCifStr] = useState(
    valorCif != null && Number.isFinite(valorCif) ? String(valorCif) : ""
  );
  const [arancel, setArancel] = useState(
    String(arancelPct ?? tarifaAdValoremPct ?? ARANCEL_PCT_DEFAULT)
  );
  const [lujo, setLujo] = useState(String(impuestoLujoPct ?? LUJO_PCT_DEFAULT));
  const [cantidad, setCantidad] = useState(
    unidades && unidades.length > 1 ? String(unidades.length) : "1"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cif = parseMoneyInput(cifStr);
  const arancelNum = parseMoneyInput(arancel);
  const lujoNum = parseMoneyInput(lujo);
  const n = Math.max(1, Math.floor(parseMoneyInput(cantidad) ?? 1));

  const porVehiculo = useMemo(
    () =>
      precalcularAranceles({
        valorCif: cif,
        arancelPct: arancelNum,
        impuestoLujoPct: lujoNum,
        tasaBs: tasaCambioBcv,
      }),
    [cif, arancelNum, lujoNum, tasaCambioBcv]
  );

  const loteDesdeUnidades = useMemo(() => {
    if (!unidades || unidades.length < 2) return null;
    return sumarPrecalculos(unidades.map((u) => inputFromImportacion(u)));
  }, [unidades]);

  const lote = loteDesdeUnidades ?? (porVehiculo && n > 1
    ? multiplicarPrecalculo(porVehiculo, n)
    : null);

  const lujoAplica = (cif ?? 0) > LUJO_CIF_UMBRAL_USD;
  const editable = canEdit && Boolean(vehiculoId);

  function guardar() {
    if (!vehiculoId || !porVehiculo) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await savePrecalculoArancelesAction({
        vehiculoId,
        valorCif: porVehiculo.valorCif,
        arancelPct: porVehiculo.arancelPct,
        impuestoLujoPct: porVehiculo.impuestoLujoPct,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage(
        `Precálculo guardado · total ${formatUsd(porVehiculo.totalUsd)}`
      );
      onSaved?.();
    });
  }

  return (
    <section className="rounded-2xl border border-cyan-900/40 bg-slate-950/40 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
        <Calculator className="h-5 w-5 text-cyan-400" />
        Precálculo de aranceles e impuestos
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Estimado SENIAT por vehículo. El arancel va de {ARANCEL_PCT_MIN} a{" "}
        {ARANCEL_PCT_MAX}%. IVA {porVehiculo?.ivaPct ?? 16}% sobre CIF + arancel
        + tasa SENIAT. Impuesto al lujo solo si el CIF supera{" "}
        {formatUsd(LUJO_CIF_UMBRAL_USD)}.
        {partidaArancelaria?.trim()
          ? ` Partida ${partidaArancelaria.trim()}.`
          : ""}
        {tasaCambioBcv
          ? ` Bs con tasa BCV ${tasaCambioBcv} (oficial del día).`
          : " Carga la tasa BCV para ver montos en bolívares."}
      </p>

      {editable ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Valor CIF (USD)</span>
            <input
              value={cifStr}
              onChange={(e) => setCifStr(e.target.value)}
              inputMode="decimal"
              placeholder="25000"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">
              Arancel % ({ARANCEL_PCT_MIN}–{ARANCEL_PCT_MAX})
            </span>
            <input
              type="number"
              min={ARANCEL_PCT_MIN}
              max={ARANCEL_PCT_MAX}
              step={1}
              value={arancel}
              onChange={(e) => setArancel(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">
              Lujo % ({LUJO_PCT_MIN}–{LUJO_PCT_MAX})
              {lujoAplica ? "" : " · no aplica"}
            </span>
            <input
              type="number"
              min={LUJO_PCT_MIN}
              max={LUJO_PCT_MAX}
              step={1}
              value={lujo}
              onChange={(e) => setLujo(e.target.value)}
              disabled={!lujoAplica}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500/60 disabled:opacity-50"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Vehículos en la carga</span>
            <input
              type="number"
              min={1}
              max={200}
              step={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
        </div>
      ) : null}

      {porVehiculo ? (
        <div className="mt-5">
          <TablaPrecalculo
            calc={porVehiculo}
            titulo={lote ? "Por vehículo" : undefined}
          />
        </div>
      ) : lote ? null : (
        <p className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-sm text-amber-100">
          Falta el valor CIF para calcular aranceles e impuestos.
        </p>
      )}

      {lote ? (
        <div className="mt-6">
          <TablaPrecalculo
            calc={lote}
            titulo={
              loteDesdeUnidades
                ? `${unidades?.length ?? n} vehículos de este BL`
                : `Por ${n} vehículos (mismo CIF)`
            }
          />
        </div>
      ) : null}

      {editable ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={pending || !porVehiculo}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar precálculo"}
          </button>
          {message ? (
            <p className="text-sm text-emerald-300">{message}</p>
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
