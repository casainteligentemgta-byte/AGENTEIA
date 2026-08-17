import {
  getAppBaseUrl,
  getAppHost,
  PRODUCTION_APP_HOST,
  PRODUCTION_APP_URL,
} from "@/lib/app-url";

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatKilometraje(km: number | null | undefined): string {
  if (km == null) return "—";
  return `${km.toLocaleString("es-CO")} km`;
}

/** Normaliza `time` de Postgres / valores legacy a string HH:MM(:SS). */
export function normalizeHoraIngreso(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const hours = record.hours ?? record.hour;
    const minutes = record.minutes ?? record.minute;
    if (typeof hours === "number" && typeof minutes === "number") {
      const hh = String(hours).padStart(2, "0");
      const mm = String(minutes).padStart(2, "0");
      const seconds = record.seconds ?? record.second;
      const ss =
        typeof seconds === "number" ? `:${String(seconds).padStart(2, "0")}` : ":00";
      return `${hh}:${mm}${ss}`;
    }
  }
  return String(raw);
}

/** Muestra hora de ingreso (ej. 14:30) sin asumir que el valor es string. */
export function formatHoraIngreso(raw: unknown): string {
  const hora = normalizeHoraIngreso(raw);
  if (!hora) return "";
  return hora.slice(0, 5);
}

export function normalizePlaca(placa: string): string {
  return placa.trim().toUpperCase().replace(/\s+/g, "");
}

export function getDescripcion(m: {
  descripcion: string | null;
  descripcion_servicio?: string | null;
}): string {
  return m.descripcion ?? m.descripcion_servicio ?? "Sin descripción";
}

export { getAppBaseUrl, getAppHost, PRODUCTION_APP_HOST, PRODUCTION_APP_URL };

export function getInspeccionVehiculoUrl(
  vehiculoId: string,
  options?: { sesionToken?: string }
): string {
  const base = getAppBaseUrl();
  if (!vehiculoId) return `${base}/dashboard/vehiculos/nuevo`;
  const params = new URLSearchParams({ telegram: "1" });
  if (options?.sesionToken) {
    params.set("sesion", options.sesionToken);
  }
  return `${base}/dashboard/vehiculos/${vehiculoId}/inspeccion?${params.toString()}`;
}

export function getClientePortalUrl(placa: string): string {
  return `${getAppBaseUrl()}/cliente?placa=${encodeURIComponent(normalizePlaca(placa))}`;
}
