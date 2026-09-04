/**
 * Dónde está el buque a partir del BL.
 * El nº de BL identifica la naviera; el mapa AIS en vivo pide API de pago.
 * Aquí: enlace al tracker público + días hasta la fecha de llegada guardada.
 */

export type NavieraDetectada = {
  codigo: string;
  nombre: string;
  trackingUrl: (bl: string) => string;
};

const NAVIERAS: NavieraDetectada[] = [
  {
    codigo: "MAEU",
    nombre: "Maersk",
    trackingUrl: (bl) =>
      `https://www.maersk.com/tracking/${encodeURIComponent(bl)}`,
  },
  {
    codigo: "MSCU",
    nombre: "MSC",
    trackingUrl: (bl) =>
      `https://www.msc.com/track-a-shipment?number=${encodeURIComponent(bl)}`,
  },
  {
    codigo: "CMDU",
    nombre: "CMA CGM",
    trackingUrl: (bl) =>
      `https://www.cma-cgm.com/ebusiness/tracking/search?SearchType=BL&Reference=${encodeURIComponent(bl)}`,
  },
  {
    codigo: "COSU",
    nombre: "COSCO",
    trackingUrl: (bl) =>
      `https://elines.coscoshipping.com/ebusiness/cargoTracking?queryType=BL&queryValue=${encodeURIComponent(bl)}`,
  },
  {
    codigo: "HLCU",
    nombre: "Hapag-Lloyd",
    trackingUrl: (bl) =>
      `https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html?blno=${encodeURIComponent(bl)}`,
  },
  {
    codigo: "EGLV",
    nombre: "Evergreen",
    trackingUrl: (bl) =>
      `https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do?TYPE=BL&BL=${encodeURIComponent(bl)}`,
  },
  {
    codigo: "OOLU",
    nombre: "OOCL",
    trackingUrl: (bl) =>
      `https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/cargotracking.aspx?BL=${encodeURIComponent(bl)}`,
  },
  {
    codigo: "ONEY",
    nombre: "ONE",
    trackingUrl: (bl) =>
      `https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNo=${encodeURIComponent(bl)}`,
  },
  {
    codigo: "ZIMU",
    nombre: "ZIM",
    trackingUrl: (bl) =>
      `https://www.zim.com/tools/track-a-shipment?consnumber=${encodeURIComponent(bl)}`,
  },
  {
    codigo: "YMLU",
    nombre: "Yang Ming",
    trackingUrl: (bl) =>
      `https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx?BL=${encodeURIComponent(bl)}`,
  },
];

export function normalizeBlTrackingKey(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[\s-]/g, "").toUpperCase();
}

export function searatesBlUrl(bl: string): string {
  return `https://www.searates.com/container/tracking/?number=${encodeURIComponent(bl)}&type=BL`;
}

export function detectarNaviera(numeroBl: string | null | undefined): NavieraDetectada | null {
  const key = normalizeBlTrackingKey(numeroBl);
  if (key.length < 4) return null;
  const prefix = key.slice(0, 4);
  return NAVIERAS.find((n) => prefix.startsWith(n.codigo) || n.codigo.startsWith(prefix)) ?? null;
}

/** Días hasta YYYY-MM-DD. Negativo = ya pasó. `hoy` solo para tests. */
export function diasHastaLlegadaBuque(
  fechaLlegadaBuque: string | null | undefined,
  hoy?: Date
): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((fechaLlegadaBuque ?? "").trim());
  if (!match) return null;
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = hoy ?? new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function etiquetaLlegadaBuque(dias: number | null): string | null {
  if (dias == null) return null;
  if (dias < 0) return `Llegó hace ${Math.abs(dias)} d`;
  if (dias === 0) return "Llega hoy";
  if (dias === 1) return "Llega mañana";
  return `Llega en ${dias} d`;
}

/** Badge corto para el botón del BL: "12 d", "hoy", "llegó". */
export function badgeContadorLlegada(dias: number | null): string | null {
  if (dias == null) return null;
  if (dias < 0) return "llegó";
  if (dias === 0) return "hoy";
  return `${dias} d`;
}

export type BuqueTracking = {
  numeroBl: string;
  navieraNombre: string | null;
  trackingUrl: string;
  dias: number | null;
  llegadaLabel: string | null;
  contadorBadge: string | null;
};

export function resolveBuqueTracking(params: {
  numeroBl?: string | null;
  fechaLlegadaBuque?: string | null;
  hoy?: Date;
}): BuqueTracking | null {
  const numeroBl = (params.numeroBl ?? "").trim();
  if (!numeroBl) return null;
  const naviera = detectarNaviera(numeroBl);
  const dias = diasHastaLlegadaBuque(params.fechaLlegadaBuque, params.hoy);
  return {
    numeroBl,
    navieraNombre: naviera?.nombre ?? null,
    trackingUrl: naviera ? naviera.trackingUrl(numeroBl) : searatesBlUrl(numeroBl),
    dias,
    llegadaLabel: etiquetaLlegadaBuque(dias),
    contadorBadge: badgeContadorLlegada(dias),
  };
}
