import {
  inputFromImportacion,
  precalcularAranceles,
} from "@/lib/importacion/precalculo-aranceles";
import { tasaOficialEsDeHoy, type TasaBcvLookup } from "@/lib/importacion/tasa-bcv";

export const ESTADOS_PAGO_ARANCELES = ["pendiente", "pagado"] as const;
export type EstadoPagoAranceles = (typeof ESTADOS_PAGO_ARANCELES)[number];

export type PagoArancelesSnapshot = {
  estado: EstadoPagoAranceles;
  totalUsd: number | null;
  totalBs: number | null;
  tasaBs: number | null;
  tasaFecha: string | null;
  pagadoAt: string | null;
};

export type ImportacionPagoFields = {
  valorCif?: number | null;
  arancelPct?: number | null;
  tarifaAdValoremPct?: number | null;
  impuestoLujoPct?: number | null;
  tasaCambioBcv?: number | null;
  tasaOficialFecha?: string | null;
  tasaOficialFuente?: "bcv" | "manual" | null;
  pagoArancelesEstado?: string | null;
  pagoArancelesUsd?: number | null;
  pagoArancelesBs?: number | null;
  pagoArancelesPagadoAt?: string | null;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseEstadoPagoAranceles(
  raw: string | null | undefined
): EstadoPagoAranceles {
  return raw === "pagado" ? "pagado" : "pendiente";
}

export function usdABsOficial(
  usd: number | null | undefined,
  tasaBs: number | null | undefined
): number | null {
  if (
    typeof usd !== "number" ||
    !Number.isFinite(usd) ||
    usd < 0 ||
    typeof tasaBs !== "number" ||
    !Number.isFinite(tasaBs) ||
    tasaBs <= 0
  ) {
    return null;
  }
  return roundMoney(usd * tasaBs);
}

export function totalUsdPago(imp: ImportacionPagoFields): number | null {
  if (
    typeof imp.pagoArancelesUsd === "number" &&
    Number.isFinite(imp.pagoArancelesUsd) &&
    imp.pagoArancelesUsd > 0
  ) {
    return roundMoney(imp.pagoArancelesUsd);
  }
  const calc = precalcularAranceles(inputFromImportacion(imp));
  return calc ? calc.totalUsd : null;
}

export function snapshotPagoAranceles(
  imp: ImportacionPagoFields
): PagoArancelesSnapshot {
  const estado = parseEstadoPagoAranceles(imp.pagoArancelesEstado);
  const totalUsd = totalUsdPago(imp);
  const tasaBs =
    typeof imp.tasaCambioBcv === "number" &&
    Number.isFinite(imp.tasaCambioBcv) &&
    imp.tasaCambioBcv > 0
      ? imp.tasaCambioBcv
      : null;
  const storedBs =
    typeof imp.pagoArancelesBs === "number" && Number.isFinite(imp.pagoArancelesBs)
      ? roundMoney(imp.pagoArancelesBs)
      : null;
  return {
    estado,
    totalUsd,
    totalBs:
      estado === "pagado" ? storedBs ?? usdABsOficial(totalUsd, tasaBs) : usdABsOficial(totalUsd, tasaBs),
    tasaBs,
    tasaFecha: imp.tasaOficialFecha?.trim().slice(0, 10) || null,
    pagadoAt: imp.pagoArancelesPagadoAt?.trim() || null,
  };
}

export function tieneMontoParaConvertir(imp: ImportacionPagoFields): boolean {
  return totalUsdPago(imp) != null;
}

/** Pendiente de pago y sin tasa de hoy → hay que reconvertir. */
export function debeActualizarTasaOficial(
  imp: ImportacionPagoFields,
  hoy: string
): boolean {
  if (parseEstadoPagoAranceles(imp.pagoArancelesEstado) === "pagado") return false;
  if (!tieneMontoParaConvertir(imp)) return false;
  if (!tasaOficialEsDeHoy(imp.tasaOficialFecha, hoy)) return true;
  const tasa = imp.tasaCambioBcv;
  if (typeof tasa !== "number" || !Number.isFinite(tasa) || tasa <= 0) return true;
  const usd = totalUsdPago(imp);
  const bs = usdABsOficial(usd, tasa);
  if (bs == null) return true;
  if (
    typeof imp.pagoArancelesBs !== "number" ||
    !Number.isFinite(imp.pagoArancelesBs)
  ) {
    return true;
  }
  return Math.abs(imp.pagoArancelesBs - bs) > 0.009;
}

export function aplicarTasaOficialAlPago<T extends ImportacionPagoFields>(
  imp: T,
  lookup: TasaBcvLookup
): T {
  if (parseEstadoPagoAranceles(imp.pagoArancelesEstado) === "pagado") {
    return imp;
  }
  const totalUsd = totalUsdPago(imp);
  if (totalUsd == null) return imp;
  const totalBs = usdABsOficial(totalUsd, lookup.tasa);
  return {
    ...imp,
    tasaCambioBcv: lookup.tasa,
    tasaOficialFecha: lookup.fechaVigente || lookup.fechaConsulta,
    tasaOficialFuente: "bcv",
    pagoArancelesEstado: "pendiente",
    pagoArancelesUsd: totalUsd,
    pagoArancelesBs: totalBs,
  };
}

export function marcarPagoAranceles<T extends ImportacionPagoFields>(
  imp: T,
  pagadoAt: string
): T {
  const snap = snapshotPagoAranceles(imp);
  if (snap.totalUsd == null) return imp;
  return {
    ...imp,
    pagoArancelesEstado: "pagado",
    pagoArancelesUsd: snap.totalUsd,
    pagoArancelesBs: snap.totalBs,
    pagoArancelesPagadoAt: pagadoAt,
  };
}

export function sumarPagosBs(
  items: ImportacionPagoFields[]
): { totalUsd: number; totalBs: number | null; pendientes: number } {
  let totalUsd = 0;
  let totalBs = 0;
  let tieneBs = false;
  let pendientes = 0;
  for (const item of items) {
    const snap = snapshotPagoAranceles(item);
    if (snap.totalUsd == null) continue;
    totalUsd += snap.totalUsd;
    if (snap.estado !== "pagado") pendientes += 1;
    if (snap.totalBs != null) {
      totalBs += snap.totalBs;
      tieneBs = true;
    }
  }
  return {
    totalUsd: roundMoney(totalUsd),
    totalBs: tieneBs ? roundMoney(totalBs) : null,
    pendientes,
  };
}
