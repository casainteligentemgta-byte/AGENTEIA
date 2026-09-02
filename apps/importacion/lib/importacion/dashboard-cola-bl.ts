import { compareExpedientesAsc } from "@/lib/importacion/expediente";
import {
  groupByCargaBl,
  normalizeLoteBlKey,
} from "@/lib/importacion/expediente-lote";
import {
  dashboardFichaIdentidad,
  dashboardFichaLineas,
  dashboardFichaSearchText,
  type DashboardFichaIdentidad,
} from "@/lib/importacion/dashboard-ficha";

export type ColaBlVehiculo = {
  id: string;
  numeroBl?: string | null;
  codigoExpediente: string | null;
  created_at: string;
  updated_at?: string | null;
  fechaLlegadaBuque?: string | null;
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  vin?: string | null;
};

export type ColaBlCollapsed<T extends ColaBlVehiculo> =
  | { kind: "bl"; blKey: string; label: string; items: T[] }
  | { kind: "unidad"; item: T };

export type ColaBlSort = "expediente" | "llegada";

/** Fecha de llegada del buque (documentos de la carga), YYYY-MM-DD. */
export function fechaLlegadaCargaBl(
  items: { fechaLlegadaBuque?: string | null }[]
): string | null {
  let best: string | null = null;
  for (const item of items) {
    const day = normalizeFechaLlegadaDia(item.fechaLlegadaBuque);
    if (!day) continue;
    if (best == null || day < best) best = day;
  }
  return best;
}

function normalizeFechaLlegadaDia(raw?: string | null): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const day = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : s;
}

function compareFechaLlegadaAsc(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

/** Expedientes sueltos: fecha del buque, luego número de expediente. Sin fecha al final. */
export function sortUnidadesPorLlegada<T extends ColaBlVehiculo>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byFecha = compareFechaLlegadaAsc(
      fechaLlegadaCargaBl([a]),
      fechaLlegadaCargaBl([b])
    );
    if (byFecha !== 0) return byFecha;
    return compareExpedientesAsc(a, b);
  });
}

function compareBlPorExpediente<T extends ColaBlVehiculo>(
  a: { label: string; items: T[] },
  b: { label: string; items: T[] }
): number {
  const fa = [...a.items].sort(compareExpedientesAsc)[0];
  const fb = [...b.items].sort(compareExpedientesAsc)[0];
  if (fa && fb) return compareExpedientesAsc(fa, fb);
  return a.label.localeCompare(b.label);
}

/** Un grupo por BL; sin número quedan como filas sueltas, al final. */
export function collapseColaPorBl<T extends ColaBlVehiculo>(
  items: T[],
  options?: { sort?: ColaBlSort }
): ColaBlCollapsed<T>[] {
  const sort = options?.sort ?? "expediente";
  const groups = groupByCargaBl(items);
  const conBl = groups.filter((g) => g.blKey);
  const sinBl = groups.filter((g) => !g.blKey).flatMap((g) => g.items);

  if (sort === "llegada") {
    conBl.sort((a, b) => {
      const byFecha = compareFechaLlegadaAsc(
        fechaLlegadaCargaBl(a.items),
        fechaLlegadaCargaBl(b.items)
      );
      if (byFecha !== 0) return byFecha;
      return compareBlPorExpediente(a, b);
    });
  } else {
    conBl.sort(compareBlPorExpediente);
  }

  const out: ColaBlCollapsed<T>[] = [];
  for (const g of conBl) {
    out.push({
      kind: "bl",
      blKey: g.blKey,
      label: g.label,
      items: [...g.items].sort(compareExpedientesAsc),
    });
  }

  const sueltos =
    sort === "llegada"
      ? [...sinBl].sort((a, b) => {
          const byFecha = compareFechaLlegadaAsc(
            fechaLlegadaCargaBl([a]),
            fechaLlegadaCargaBl([b])
          );
          if (byFecha !== 0) return byFecha;
          return compareExpedientesAsc(a, b);
        })
      : [...sinBl].sort(compareExpedientesAsc);

  for (const item of sueltos) {
    out.push({ kind: "unidad", item });
  }
  return out;
}

/** Toda la mercancía del mismo BL, no solo la que sigue en esta cola. */
export function mercanciaDelMismoBl<T extends ColaBlVehiculo>(
  blKey: string,
  todos: T[]
): T[] {
  const key = normalizeLoteBlKey(blKey);
  if (!key) return [];
  return todos
    .filter((v) => normalizeLoteBlKey(v.numeroBl) === key)
    .sort(compareExpedientesAsc);
}

export type MercanciaBlLinea = {
  id: string;
  expediente: string;
  detalle: string;
  searchText: string;
};

/** Mercancía de un BL: expediente + marca/modelo/color/VIN, de menor a mayor. */
export function lineasMercanciaBl(items: ColaBlVehiculo[]): MercanciaBlLinea[] {
  return [...items].sort(compareExpedientesAsc).map((item) => {
    const expediente = item.codigoExpediente?.trim() || "Expediente";
    const ficha = dashboardFichaIdentidad(item);
    const detalle = dashboardFichaLineas(ficha).join(" · ");
    return {
      id: item.id,
      expediente,
      detalle,
      searchText: `${expediente} ${dashboardFichaSearchText(ficha)}`.trim(),
    };
  });
}

export function resumenUnidadesBl(
  items: { codigoExpediente: string | null }[]
): string {
  const n = items.length;
  const units = `${n} vehículo${n === 1 ? "" : "s"}`;
  const codes = items
    .map((i) => i.codigoExpediente?.trim())
    .filter((c): c is string => Boolean(c));
  if (codes.length === 0) return units;
  const shown = codes.slice(0, 4).join(", ");
  return codes.length > 4 ? `${units} · ${shown}…` : `${units} · ${shown}`;
}

export function fichaHomogeneaBl(
  items: ColaBlVehiculo[]
): DashboardFichaIdentidad {
  const marcas = uniqueClean(items.map((i) => i.marca));
  const modelos = uniqueClean(items.map((i) => i.modelo));
  return dashboardFichaIdentidad({
    marca: marcas.length === 1 ? marcas[0] : null,
    modelo: modelos.length === 1 ? modelos[0] : null,
    color: null,
    vin: null,
  });
}

function uniqueClean(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const s = (raw ?? "").trim();
    if (!s || s === "—" || /^POR-COMPLETAR$/i.test(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function latestIso(
  items: { updated_at?: string | null; created_at: string }[]
): string {
  let best = "";
  for (const item of items) {
    const iso = item.updated_at ?? item.created_at;
    if (iso > best) best = iso;
  }
  return best;
}
