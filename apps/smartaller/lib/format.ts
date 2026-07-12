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

export function normalizePlaca(placa: string): string {
  return placa.trim().toUpperCase().replace(/\s+/g, "");
}

export function getDescripcion(m: {
  descripcion: string | null;
  descripcion_servicio?: string | null;
}): string {
  return m.descripcion ?? m.descripcion_servicio ?? "Sin descripción";
}

export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3003")
  );
}

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
