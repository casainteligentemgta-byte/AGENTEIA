export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatKm(km: number | null): string {
  if (km == null) return "—";
  return `${km.toLocaleString("es-CO")} km`;
}

export function formatOdometroDashboard(
  km: number | null,
  horas: number | null,
  unidad: string
): string {
  if (unidad === "horas") {
    if (horas == null) return "—";
    return `${horas.toLocaleString("es-CO")} h`;
  }
  return formatKm(km);
}
