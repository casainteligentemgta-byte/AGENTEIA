import { compareExpedientesAsc } from "@/lib/importacion/expediente";
import { groupByCargaBl } from "@/lib/importacion/expediente-lote";
import {
  dashboardFichaIdentidad,
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

/** Un grupo por BL; sin número quedan como filas sueltas, al final. */
export function collapseColaPorBl<T extends ColaBlVehiculo>(
  items: T[]
): ColaBlCollapsed<T>[] {
  const groups = groupByCargaBl(items);
  const conBl = groups.filter((g) => g.blKey);
  const sinBl = groups.filter((g) => !g.blKey).flatMap((g) => g.items);

  conBl.sort((a, b) => {
    const fa = [...a.items].sort(compareExpedientesAsc)[0];
    const fb = [...b.items].sort(compareExpedientesAsc)[0];
    if (fa && fb) return compareExpedientesAsc(fa, fb);
    return a.label.localeCompare(b.label);
  });

  const out: ColaBlCollapsed<T>[] = [];
  for (const g of conBl) {
    out.push({
      kind: "bl",
      blKey: g.blKey,
      label: g.label,
      items: [...g.items].sort(compareExpedientesAsc),
    });
  }
  for (const item of [...sinBl].sort(compareExpedientesAsc)) {
    out.push({ kind: "unidad", item });
  }
  return out;
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
