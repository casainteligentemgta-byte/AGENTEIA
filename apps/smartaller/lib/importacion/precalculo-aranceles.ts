/** Precálculo de aranceles e impuestos SENIAT (por vehículo y por lote). */

export const ARANCEL_PCT_MIN = 20;
export const ARANCEL_PCT_MAX = 40;
export const ARANCEL_PCT_DEFAULT = 30;

export const TASA_SENIAT_PCT = 1;
export const IVA_PCT = 16;

/** Impuesto al lujo: solo si el CIF supera este umbral (USD). */
export const LUJO_CIF_UMBRAL_USD = 30_000;
export const LUJO_PCT_MIN = 10;
export const LUJO_PCT_MAX = 15;
export const LUJO_PCT_DEFAULT = 10;

export type PrecalculoArancelesInput = {
  valorCif: number | null | undefined;
  /** Ad-valorem 20–40. Por defecto 30. */
  arancelPct?: number | null;
  /** 10–15. Por defecto 10. Solo aplica si CIF > 30 000. */
  impuestoLujoPct?: number | null;
  /** Bs por USD (BCV / tasa oficial SENIAT del día). */
  tasaBs?: number | null;
};

export type PrecalculoLinea = {
  concepto: string;
  pct: number | null;
  usd: number;
  bs: number | null;
};

export type PrecalculoAranceles = {
  valorCif: number;
  arancelPct: number;
  tasaSeniatPct: number;
  ivaPct: number;
  impuestoLujoPct: number;
  lujoAplica: boolean;
  tasaBs: number | null;
  arancelUsd: number;
  tasaSeniatUsd: number;
  subtotalGravableUsd: number;
  ivaUsd: number;
  totalSinLujoUsd: number;
  impuestoLujoUsd: number;
  totalUsd: number;
  arancelBs: number | null;
  tasaSeniatBs: number | null;
  subtotalGravableBs: number | null;
  ivaBs: number | null;
  totalSinLujoBs: number | null;
  impuestoLujoBs: number | null;
  totalBs: number | null;
  lineas: PrecalculoLinea[];
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toBs(usd: number, tasaBs: number | null): number | null {
  if (tasaBs == null || !Number.isFinite(tasaBs) || tasaBs <= 0) return null;
  return roundMoney(usd * tasaBs);
}

export function clampArancelPct(raw: number | null | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return ARANCEL_PCT_DEFAULT;
  return Math.min(ARANCEL_PCT_MAX, Math.max(ARANCEL_PCT_MIN, raw));
}

export function clampImpuestoLujoPct(raw: number | null | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return LUJO_PCT_DEFAULT;
  return Math.min(LUJO_PCT_MAX, Math.max(LUJO_PCT_MIN, raw));
}

export function parseMoneyInput(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
  }
  if (raw == null) return null;
  let normalized = String(raw).trim().replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (!normalized) return null;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const decimals = normalized.length - lastComma - 1;
    normalized =
      decimals === 3 ? normalized.replace(/,/g, "") : normalized.replace(",", ".");
  } else if ((normalized.match(/\./g) ?? []).length > 1) {
    normalized = normalized.replace(/\./g, "");
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function aplicaImpuestoLujo(valorCif: number): boolean {
  return valorCif > LUJO_CIF_UMBRAL_USD;
}

export function precalcularAranceles(
  input: PrecalculoArancelesInput
): PrecalculoAranceles | null {
  const valorCif = input.valorCif;
  if (typeof valorCif !== "number" || !Number.isFinite(valorCif) || valorCif <= 0) {
    return null;
  }

  const cif = roundMoney(valorCif);
  const arancelPct = clampArancelPct(input.arancelPct);
  const impuestoLujoPct = clampImpuestoLujoPct(input.impuestoLujoPct);
  const tasaBs =
    typeof input.tasaBs === "number" && Number.isFinite(input.tasaBs) && input.tasaBs > 0
      ? input.tasaBs
      : null;

  const arancelUsd = roundMoney(cif * (arancelPct / 100));
  const tasaSeniatUsd = roundMoney(cif * (TASA_SENIAT_PCT / 100));
  const subtotalGravableUsd = roundMoney(cif + arancelUsd + tasaSeniatUsd);
  const ivaUsd = roundMoney(subtotalGravableUsd * (IVA_PCT / 100));
  const totalSinLujoUsd = roundMoney(subtotalGravableUsd + ivaUsd);
  const lujoAplica = aplicaImpuestoLujo(cif);
  const impuestoLujoUsd = lujoAplica
    ? roundMoney(cif * (impuestoLujoPct / 100))
    : 0;
  const totalUsd = roundMoney(totalSinLujoUsd + impuestoLujoUsd);

  const lineas: PrecalculoLinea[] = [
    { concepto: "Valor CIF", pct: 100, usd: cif, bs: toBs(cif, tasaBs) },
    {
      concepto: `Arancel (${ARANCEL_PCT_MIN}–${ARANCEL_PCT_MAX}%)`,
      pct: arancelPct,
      usd: arancelUsd,
      bs: toBs(arancelUsd, tasaBs),
    },
    {
      concepto: "Tasa SENIAT",
      pct: TASA_SENIAT_PCT,
      usd: tasaSeniatUsd,
      bs: toBs(tasaSeniatUsd, tasaBs),
    },
    {
      concepto: "Subtotal gravable",
      pct: null,
      usd: subtotalGravableUsd,
      bs: toBs(subtotalGravableUsd, tasaBs),
    },
    {
      concepto: "IVA",
      pct: IVA_PCT,
      usd: ivaUsd,
      bs: toBs(ivaUsd, tasaBs),
    },
    {
      concepto: "Total sin lujo",
      pct: null,
      usd: totalSinLujoUsd,
      bs: toBs(totalSinLujoUsd, tasaBs),
    },
    {
      concepto: `Impuesto al lujo${lujoAplica ? "" : " (no aplica)"}`,
      pct: lujoAplica ? impuestoLujoPct : 0,
      usd: impuestoLujoUsd,
      bs: toBs(impuestoLujoUsd, tasaBs),
    },
    {
      concepto: "TOTAL",
      pct: null,
      usd: totalUsd,
      bs: toBs(totalUsd, tasaBs),
    },
  ];

  return {
    valorCif: cif,
    arancelPct,
    tasaSeniatPct: TASA_SENIAT_PCT,
    ivaPct: IVA_PCT,
    impuestoLujoPct,
    lujoAplica,
    tasaBs,
    arancelUsd,
    tasaSeniatUsd,
    subtotalGravableUsd,
    ivaUsd,
    totalSinLujoUsd,
    impuestoLujoUsd,
    totalUsd,
    arancelBs: toBs(arancelUsd, tasaBs),
    tasaSeniatBs: toBs(tasaSeniatUsd, tasaBs),
    subtotalGravableBs: toBs(subtotalGravableUsd, tasaBs),
    ivaBs: toBs(ivaUsd, tasaBs),
    totalSinLujoBs: toBs(totalSinLujoUsd, tasaBs),
    impuestoLujoBs: toBs(impuestoLujoUsd, tasaBs),
    totalBs: toBs(totalUsd, tasaBs),
    lineas,
  };
}

export function multiplicarPrecalculo(
  calc: PrecalculoAranceles,
  cantidad: number
): PrecalculoAranceles | null {
  const n = Math.floor(cantidad);
  if (!Number.isFinite(n) || n < 1) return null;
  if (n === 1) return calc;

  const scale = (usd: number) => roundMoney(usd * n);
  const tasaBs = calc.tasaBs;
  const valorCif = scale(calc.valorCif);
  const arancelUsd = scale(calc.arancelUsd);
  const tasaSeniatUsd = scale(calc.tasaSeniatUsd);
  const subtotalGravableUsd = scale(calc.subtotalGravableUsd);
  const ivaUsd = scale(calc.ivaUsd);
  const totalSinLujoUsd = scale(calc.totalSinLujoUsd);
  const impuestoLujoUsd = scale(calc.impuestoLujoUsd);
  const totalUsd = scale(calc.totalUsd);

  return {
    ...calc,
    valorCif,
    arancelUsd,
    tasaSeniatUsd,
    subtotalGravableUsd,
    ivaUsd,
    totalSinLujoUsd,
    impuestoLujoUsd,
    totalUsd,
    arancelBs: toBs(arancelUsd, tasaBs),
    tasaSeniatBs: toBs(tasaSeniatUsd, tasaBs),
    subtotalGravableBs: toBs(subtotalGravableUsd, tasaBs),
    ivaBs: toBs(ivaUsd, tasaBs),
    totalSinLujoBs: toBs(totalSinLujoUsd, tasaBs),
    impuestoLujoBs: toBs(impuestoLujoUsd, tasaBs),
    totalBs: toBs(totalUsd, tasaBs),
    lineas: calc.lineas.map((linea) => ({
      ...linea,
      usd: scale(linea.usd),
      bs: toBs(scale(linea.usd), tasaBs),
    })),
  };
}

export function sumarPrecalculos(
  items: Array<PrecalculoArancelesInput | null | undefined>
): PrecalculoAranceles | null {
  const calcs = items
    .map((item) => (item ? precalcularAranceles(item) : null))
    .filter((item): item is PrecalculoAranceles => item != null);
  if (calcs.length === 0) return null;
  if (calcs.length === 1) return calcs[0]!;

  const tasaBs = calcs.every((c) => c.tasaBs === calcs[0]!.tasaBs)
    ? calcs[0]!.tasaBs
    : null;
  const arancelPct = calcs.every((c) => c.arancelPct === calcs[0]!.arancelPct)
    ? calcs[0]!.arancelPct
    : null;
  const lujoPct = calcs.every((c) => c.impuestoLujoPct === calcs[0]!.impuestoLujoPct)
    ? calcs[0]!.impuestoLujoPct
    : LUJO_PCT_DEFAULT;

  const sum = (pick: (c: PrecalculoAranceles) => number) =>
    roundMoney(calcs.reduce((acc, c) => acc + pick(c), 0));

  const valorCif = sum((c) => c.valorCif);
  const arancelUsd = sum((c) => c.arancelUsd);
  const tasaSeniatUsd = sum((c) => c.tasaSeniatUsd);
  const subtotalGravableUsd = sum((c) => c.subtotalGravableUsd);
  const ivaUsd = sum((c) => c.ivaUsd);
  const totalSinLujoUsd = sum((c) => c.totalSinLujoUsd);
  const impuestoLujoUsd = sum((c) => c.impuestoLujoUsd);
  const totalUsd = sum((c) => c.totalUsd);
  const lujoAplica = calcs.some((c) => c.lujoAplica);

  const lineas: PrecalculoLinea[] = [
    { concepto: "Valor CIF", pct: 100, usd: valorCif, bs: toBs(valorCif, tasaBs) },
    {
      concepto: `Arancel (${ARANCEL_PCT_MIN}–${ARANCEL_PCT_MAX}%)`,
      pct: arancelPct,
      usd: arancelUsd,
      bs: toBs(arancelUsd, tasaBs),
    },
    {
      concepto: "Tasa SENIAT",
      pct: TASA_SENIAT_PCT,
      usd: tasaSeniatUsd,
      bs: toBs(tasaSeniatUsd, tasaBs),
    },
    {
      concepto: "Subtotal gravable",
      pct: null,
      usd: subtotalGravableUsd,
      bs: toBs(subtotalGravableUsd, tasaBs),
    },
    { concepto: "IVA", pct: IVA_PCT, usd: ivaUsd, bs: toBs(ivaUsd, tasaBs) },
    {
      concepto: "Total sin lujo",
      pct: null,
      usd: totalSinLujoUsd,
      bs: toBs(totalSinLujoUsd, tasaBs),
    },
    {
      concepto: `Impuesto al lujo${lujoAplica ? "" : " (no aplica)"}`,
      pct: lujoAplica ? lujoPct : 0,
      usd: impuestoLujoUsd,
      bs: toBs(impuestoLujoUsd, tasaBs),
    },
    { concepto: "TOTAL", pct: null, usd: totalUsd, bs: toBs(totalUsd, tasaBs) },
  ];

  return {
    valorCif,
    arancelPct: arancelPct ?? ARANCEL_PCT_DEFAULT,
    tasaSeniatPct: TASA_SENIAT_PCT,
    ivaPct: IVA_PCT,
    impuestoLujoPct: lujoPct,
    lujoAplica,
    tasaBs,
    arancelUsd,
    tasaSeniatUsd,
    subtotalGravableUsd,
    ivaUsd,
    totalSinLujoUsd,
    impuestoLujoUsd,
    totalUsd,
    arancelBs: toBs(arancelUsd, tasaBs),
    tasaSeniatBs: toBs(tasaSeniatUsd, tasaBs),
    subtotalGravableBs: toBs(subtotalGravableUsd, tasaBs),
    ivaBs: toBs(ivaUsd, tasaBs),
    totalSinLujoBs: toBs(totalSinLujoUsd, tasaBs),
    impuestoLujoBs: toBs(impuestoLujoUsd, tasaBs),
    totalBs: toBs(totalUsd, tasaBs),
    lineas,
  };
}

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const BS_FMT = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return USD_FMT.format(value);
}

export function formatBs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `Bs ${BS_FMT.format(value)}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value}%`;
}

export function inputFromImportacion(imp: {
  valorCif?: number | null;
  arancelPct?: number | null;
  tarifaAdValoremPct?: number | null;
  impuestoLujoPct?: number | null;
  tasaCambioBcv?: number | null;
}): PrecalculoArancelesInput {
  return {
    valorCif: imp.valorCif,
    arancelPct: imp.arancelPct ?? imp.tarifaAdValoremPct,
    impuestoLujoPct: imp.impuestoLujoPct,
    tasaBs: imp.tasaCambioBcv,
  };
}

export function resumenLotePrecalculo(
  calc: PrecalculoAranceles | null,
  cantidad: number
): string | null {
  if (!calc || cantidad < 1) return null;
  if (cantidad === 1) return `Precálculo ${formatUsd(calc.totalUsd)}`;
  return `${cantidad} vehículos · precálculo ${formatUsd(calc.totalUsd)}`;
}
