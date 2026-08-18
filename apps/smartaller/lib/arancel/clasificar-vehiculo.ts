import { z } from "zod";
import {
  ARANCEL_VEHICULOS_FUENTE,
  PARTIDAS_VEHICULARES,
  formatPartida10,
  type CombustibleArancel,
  type PartidaVehicular,
  type UsoArancelVehiculo,
} from "@/lib/arancel/vehiculos-seed";
import type { TipoCombustible } from "@/lib/schemas/importacion-alta";

export const clasificarVehiculoInputSchema = z.object({
  tipoCombustible: z
    .enum(["gasolina", "diesel", "electrico", "hibrido", "gnv", "otro"])
    .optional()
    .nullable(),
  cilindradaCc: z.number().nonnegative().nullable().optional(),
  uso: z
    .enum(["turismo", "bus", "carga", "especial"])
    .optional()
    .default("turismo"),
  traccion4x4: z.boolean().optional().default(false),
  pesoMaxTon: z.number().nonnegative().nullable().optional(),
});

export type ClasificarVehiculoInput = z.infer<typeof clasificarVehiculoInputSchema>;

export type PartidaSugerida = {
  codigo: string;
  codigoFormateado: string;
  descripcionCorta: string;
  confianza: number;
  fundamento: string;
  permisos: string[];
  tarifaAdValoremPct: number | null;
  fuente: string;
};

export type ClasificarVehiculoResult = {
  sugerida: PartidaSugerida | null;
  alternativas: PartidaSugerida[];
  advertencias: string[];
};

function toCombustible(
  tipo: TipoCombustible | null | undefined
): CombustibleArancel {
  if (!tipo) return "otro";
  return tipo;
}

function inCc(row: PartidaVehicular, cc: number | null | undefined): boolean {
  if (row.ccMin == null && row.ccMax == null) return true;
  if (cc == null || !Number.isFinite(cc)) return false;
  if (row.ccMin != null && cc < row.ccMin) return false;
  if (row.ccMax != null && cc > row.ccMax) return false;
  return true;
}

function inPeso(row: PartidaVehicular, peso: number | null | undefined): boolean {
  if (row.pesoMaxTonMin == null && row.pesoMaxTonMax == null) return true;
  if (peso == null) return true;
  if (row.pesoMaxTonMin != null && peso < row.pesoMaxTonMin) return false;
  if (row.pesoMaxTonMax != null && peso > row.pesoMaxTonMax) return false;
  return true;
}

function scoreRow(
  row: PartidaVehicular,
  input: {
    uso: UsoArancelVehiculo;
    combustible: CombustibleArancel;
    cc: number | null;
    traccion4x4: boolean;
    pesoMaxTon: number | null | undefined;
  }
): number {
  if (row.uso !== input.uso) return 0;
  if (row.combustible !== "cualquiera" && row.combustible !== input.combustible) {
    return 0;
  }
  if (!inCc(row, input.cc)) return 0;
  if (!inPeso(row, input.pesoMaxTon)) return 0;
  if (row.traccion4x4 != null && row.traccion4x4 !== input.traccion4x4) return 0;
  if (row.codigo === "8703210010") return 0;

  let score = 40;
  if (row.combustible === input.combustible) score += 30;
  if (inCc(row, input.cc) && (row.ccMin != null || row.ccMax != null)) score += 20;
  if (row.traccion4x4 === input.traccion4x4) score += 8;
  if (row.traccion4x4 === null) score += 4;
  return Math.min(99, score);
}

function toSugerida(row: PartidaVehicular, confianza: number): PartidaSugerida {
  return {
    codigo: row.codigo,
    codigoFormateado: formatPartida10(row.codigo),
    descripcionCorta: row.descripcionCorta,
    confianza,
    fundamento: `${row.notas}. ${ARANCEL_VEHICULOS_FUENTE}`,
    permisos: row.permisos,
    tarifaAdValoremPct: null,
    fuente: "reglas",
  };
}

/**
 * Clasifica un vehículo de Puerto Libre (default: turismo 87.03).
 * No persiste. El operador debe confirmar la partida.
 */
export function clasificarVehiculo(
  raw: ClasificarVehiculoInput
): ClasificarVehiculoResult {
  const parsed = clasificarVehiculoInputSchema.safeParse(raw);
  const input = parsed.success
    ? parsed.data
    : { uso: "turismo" as const, traccion4x4: false };

  const advertencias: string[] = [
    "La tarifa Ad-Valorem SENIAT no está en este anexo; solo el código SA.",
    "Confirma el 10.º dígito contra la Gaceta / NANDINA vigente.",
  ];

  const uso = (input.uso ?? "turismo") as UsoArancelVehiculo;
  const combustible = toCombustible(input.tipoCombustible);
  const cc =
    typeof input.cilindradaCc === "number" && Number.isFinite(input.cilindradaCc)
      ? input.cilindradaCc
      : null;
  const traccion4x4 = Boolean(input.traccion4x4);
  const pesoMaxTon = input.pesoMaxTon ?? null;

  if (!input.tipoCombustible) {
    advertencias.unshift("Indica el tipo de combustible para afinar la subpartida.");
  }
  if (uso === "turismo" && combustible !== "electrico" && combustible !== "hibrido" && combustible !== "otro" && cc == null) {
    advertencias.unshift("Falta cilindrada (cc): la subpartida 8703 depende de ella.");
  }

  const ranked = PARTIDAS_VEHICULARES.map((row) => ({
    row,
    score: scoreRow(row, {
      uso,
      combustible,
      cc,
      traccion4x4,
      pesoMaxTon,
    }),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    const residual = PARTIDAS_VEHICULARES.find((p) => p.codigo === "8703900090");
    return {
      sugerida: residual ? toSugerida(residual, 35) : null,
      alternativas: [],
      advertencias: [
        "No hubo coincidencia exacta; se ofrece el residual 8703.90.00.90.",
        ...advertencias,
      ],
    };
  }

  const [best, ...rest] = ranked;
  return {
    sugerida: toSugerida(best!.row, best!.score),
    alternativas: rest.slice(0, 3).map((item) => toSugerida(item.row, item.score)),
    advertencias,
  };
}
