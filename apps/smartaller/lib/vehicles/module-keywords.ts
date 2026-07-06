import type { ModuloMantenimientoId } from "@/lib/vehicles/types";
import type { CategoriaSaludId } from "@/lib/validations/detalle-revision";

export const PALABRAS_MODULO: Record<string, string[]> = {
  aceite: ["aceite", "lubric", "oil"],
  neumaticos: ["neumático", "neumatico", "caucho", "llanta", "tire"],
  balanceo: ["balanceo", "balance"],
  rotacion: ["rotación", "rotacion"],
  alineacion: ["alineación", "alineacion"],
  bateria: ["batería", "bateria"],
  fluidos: ["fluido", "refrigerante", "freno"],
  cadena: ["cadena", "transmisión", "transmision"],
  frenos: ["freno", "pastilla", "disco"],
  hidraulico: ["hidráulico", "hidraulico"],
  filtros: ["filtro"],
  orugas: ["oruga", "tren de rodaje"],
  general: ["revisión", "revision", "mantenimiento", "servicio", "inspección", "inspeccion"],
};

const MODULO_A_CATEGORIA: Partial<Record<ModuloMantenimientoId, CategoriaSaludId>> = {
  aceite: "aceite",
  neumaticos: "neumaticos",
  bateria: "bateria",
};

export function palabrasParaCategoria(categoria: CategoriaSaludId): string[] {
  if (categoria === "general") {
    return PALABRAS_MODULO.general ?? ["revisión", "revision", "servicio"];
  }

  const modulos = Object.entries(MODULO_A_CATEGORIA)
    .filter(([, cat]) => cat === categoria)
    .map(([modulo]) => modulo);

  const palabras = modulos.flatMap((m) => PALABRAS_MODULO[m] ?? []);
  return palabras.length > 0 ? palabras : [categoria];
}
