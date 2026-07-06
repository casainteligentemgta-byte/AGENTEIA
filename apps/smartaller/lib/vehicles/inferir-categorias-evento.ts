import {
  CATEGORIAS_VEHICULO,
  type CategoriaVehiculoId,
  parseDetalleRevision,
} from "@/lib/schemas/categoria-vehiculo";
import { palabrasParaCategoria } from "@/lib/vehicles/module-keywords";

const PALABRAS_GENERAL_ESTRICTAS = [
  "revisión general",
  "revision general",
  "revisión",
  "revision",
  "inspección",
  "inspeccion",
];

const ETIQUETAS_CATEGORIA: Record<CategoriaVehiculoId, string> = {
  bateria: "Batería",
  neumaticos: "Neumáticos",
  aceite: "Aceite",
  general: "General",
};

export function etiquetaCategoria(id: CategoriaVehiculoId): string {
  return ETIQUETAS_CATEGORIA[id];
}

function textoCoincidePalabras(texto: string, palabras: string[]): boolean {
  return palabras.some((p) => texto.includes(p));
}

function coincideGeneral(texto: string): boolean {
  return PALABRAS_GENERAL_ESTRICTAS.some((p) => texto.includes(p));
}

export function inferirCategoriasEvento(
  descripcion: string | null,
  descripcionServicio: string | null,
  detalleRevision: unknown
): CategoriaVehiculoId[] {
  const encontradas = new Set<CategoriaVehiculoId>();
  const detalle = parseDetalleRevision(detalleRevision);
  const texto = `${descripcion ?? ""} ${descripcionServicio ?? ""}`.toLowerCase();

  if (detalle.categorias) {
    for (const cat of CATEGORIAS_VEHICULO) {
      const entrada = detalle.categorias[cat];
      if (entrada?.estado) {
        encontradas.add(cat);
      }
    }
  }

  if (typeof detalle.voltaje_bateria === "number") {
    encontradas.add("bateria");
  }

  for (const cat of ["bateria", "neumaticos", "aceite"] as const) {
    if (textoCoincidePalabras(texto, palabrasParaCategoria(cat))) {
      encontradas.add(cat);
    }
  }

  if (coincideGeneral(texto)) {
    encontradas.add("general");
  }

  return CATEGORIAS_VEHICULO.filter((c) => encontradas.has(c));
}

export function eventoCoincideCategoria(
  categorias: CategoriaVehiculoId[],
  filtro: CategoriaVehiculoId | null
): boolean {
  if (!filtro) return true;
  return categorias.includes(filtro);
}

export const FILTROS_TIMELINE: { id: CategoriaVehiculoId | null; label: string }[] = [
  { id: null, label: "Todos" },
  ...CATEGORIAS_VEHICULO.map((id) => ({ id, label: ETIQUETAS_CATEGORIA[id] })),
];
