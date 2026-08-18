/**
 * Catálogo Cap. 87 (vehículos) a 10 dígitos.
 * Fuente: Anexo de subpartidas vehiculares (Ficha de Homologación / FH).
 * Estructura SA coincidente con NANDINA; el 10.º dígito nacional debe
 * contrastarse con la Gaceta SENIAT vigente. Este anexo no publica AEC.
 */
export const ARANCEL_VEHICULOS_FUENTE =
  "Anexo subpartidas vehiculares Cap. 87 (control FH). Verificar Gaceta SENIAT.";

export type UsoArancelVehiculo =
  | "turismo"
  | "bus"
  | "carga"
  | "especial"
  | "chasis"
  | "carroceria"
  | "remolque";

export type CombustibleArancel =
  | "gasolina"
  | "diesel"
  | "gnv"
  | "electrico"
  | "hibrido"
  | "otro"
  | "cualquiera";

export type PartidaVehicular = {
  codigo: string;
  descripcionCorta: string;
  uso: UsoArancelVehiculo;
  combustible: CombustibleArancel;
  /** Inclusive. */
  ccMin: number | null;
  /** Inclusive. */
  ccMax: number | null;
  traccion4x4: boolean | null;
  pesoMaxTonMin: number | null;
  pesoMaxTonMax: number | null;
  notas: string;
  permisos: string[];
};

const FH = ["FH / homologación"];

export const PARTIDAS_VEHICULARES: PartidaVehicular[] = [
  {
    codigo: "8701200000",
    descripcionCorta: "Tractores de carretera para semirremolques",
    uso: "especial",
    combustible: "cualquiera",
    ccMin: null,
    ccMax: null,
    traccion4x4: null,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 — 87.01",
    permisos: FH,
  },
  {
    codigo: "8703210010",
    descripcionCorta: "Cuatrimotos utilitarias, gasolina ≤ 1000 cm³",
    uso: "turismo",
    combustible: "gasolina",
    ccMin: 0,
    ccMax: 1000,
    traccion4x4: null,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 — 87.03. Solo cuatrimoto.",
    permisos: FH,
  },
  {
    codigo: "8703210090",
    descripcionCorta: "Turismo gasolina ≤ 1000 cm³",
    uso: "turismo",
    combustible: "gasolina",
    ccMin: 0,
    ccMax: 1000,
    traccion4x4: null,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.21",
    permisos: FH,
  },
  {
    codigo: "8703221020",
    descripcionCorta: "Turismo GNV 1000–1500 cm³, 4x4",
    uso: "turismo",
    combustible: "gnv",
    ccMin: 1001,
    ccMax: 1500,
    traccion4x4: true,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.22",
    permisos: FH,
  },
  {
    codigo: "8703221090",
    descripcionCorta: "Turismo gasolina 1000–1500 cm³, 4x4",
    uso: "turismo",
    combustible: "gasolina",
    ccMin: 1001,
    ccMax: 1500,
    traccion4x4: true,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.22",
    permisos: FH,
  },
  {
    codigo: "8703229030",
    descripcionCorta: "Turismo GNV 1000–1500 cm³",
    uso: "turismo",
    combustible: "gnv",
    ccMin: 1001,
    ccMax: 1500,
    traccion4x4: false,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.22",
    permisos: FH,
  },
  {
    codigo: "8703229090",
    descripcionCorta: "Turismo gasolina 1000–1500 cm³",
    uso: "turismo",
    combustible: "gasolina",
    ccMin: 1001,
    ccMax: 1500,
    traccion4x4: false,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.22",
    permisos: FH,
  },
  {
    codigo: "8703231020",
    descripcionCorta: "Turismo GNV 1500–3000 cm³, 4x4",
    uso: "turismo",
    combustible: "gnv",
    ccMin: 1501,
    ccMax: 3000,
    traccion4x4: true,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.23",
    permisos: FH,
  },
  {
    codigo: "8703231090",
    descripcionCorta: "Turismo gasolina 1500–3000 cm³, 4x4",
    uso: "turismo",
    combustible: "gasolina",
    ccMin: 1501,
    ccMax: 3000,
    traccion4x4: true,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.23",
    permisos: FH,
  },
  {
    codigo: "8703239030",
    descripcionCorta: "Turismo GNV 1500–3000 cm³",
    uso: "turismo",
    combustible: "gnv",
    ccMin: 1501,
    ccMax: 3000,
    traccion4x4: false,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.23",
    permisos: FH,
  },
  {
    codigo: "8703239090",
    descripcionCorta: "Turismo gasolina 1500–3000 cm³",
    uso: "turismo",
    combustible: "gasolina",
    ccMin: 1501,
    ccMax: 3000,
    traccion4x4: false,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.23 (la más frecuente en PL)",
    permisos: FH,
  },
  {
    codigo: "8703241020",
    descripcionCorta: "Turismo GNV > 3000 cm³, 4x4",
    uso: "turismo",
    combustible: "gnv",
    ccMin: 3001,
    ccMax: null,
    traccion4x4: true,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.24",
    permisos: FH,
  },
  {
    codigo: "8703241090",
    descripcionCorta: "Turismo gasolina > 3000 cm³, 4x4",
    uso: "turismo",
    combustible: "gasolina",
    ccMin: 3001,
    ccMax: null,
    traccion4x4: true,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.24",
    permisos: FH,
  },
  {
    codigo: "8703249030",
    descripcionCorta: "Turismo GNV > 3000 cm³",
    uso: "turismo",
    combustible: "gnv",
    ccMin: 3001,
    ccMax: null,
    traccion4x4: false,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.24",
    permisos: FH,
  },
  {
    codigo: "8703249090",
    descripcionCorta: "Turismo gasolina > 3000 cm³",
    uso: "turismo",
    combustible: "gasolina",
    ccMin: 3001,
    ccMax: null,
    traccion4x4: false,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.24",
    permisos: FH,
  },
  {
    codigo: "8703311000",
    descripcionCorta: "Turismo diésel ≤ 1500 cm³, 4x4",
    uso: "turismo",
    combustible: "diesel",
    ccMin: 0,
    ccMax: 1500,
    traccion4x4: true,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.31",
    permisos: FH,
  },
  {
    codigo: "8703319000",
    descripcionCorta: "Turismo diésel ≤ 1500 cm³",
    uso: "turismo",
    combustible: "diesel",
    ccMin: 0,
    ccMax: 1500,
    traccion4x4: false,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.31",
    permisos: FH,
  },
  {
    codigo: "8703321000",
    descripcionCorta: "Turismo diésel 1500–2500 cm³, 4x4",
    uso: "turismo",
    combustible: "diesel",
    ccMin: 1501,
    ccMax: 2500,
    traccion4x4: true,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.32",
    permisos: FH,
  },
  {
    codigo: "8703329000",
    descripcionCorta: "Turismo diésel 1500–2500 cm³",
    uso: "turismo",
    combustible: "diesel",
    ccMin: 1501,
    ccMax: 2500,
    traccion4x4: false,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.32",
    permisos: FH,
  },
  {
    codigo: "8703331000",
    descripcionCorta: "Turismo diésel > 2500 cm³, 4x4",
    uso: "turismo",
    combustible: "diesel",
    ccMin: 2501,
    ccMax: null,
    traccion4x4: true,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.33",
    permisos: FH,
  },
  {
    codigo: "8703339000",
    descripcionCorta: "Turismo diésel > 2500 cm³",
    uso: "turismo",
    combustible: "diesel",
    ccMin: 2501,
    ccMax: null,
    traccion4x4: false,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — 8703.33",
    permisos: FH,
  },
  {
    codigo: "8703900010",
    descripcionCorta: "Turismo con motor eléctrico",
    uso: "turismo",
    combustible: "electrico",
    ccMin: null,
    ccMax: null,
    traccion4x4: null,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 — 8703.90",
    permisos: FH,
  },
  {
    codigo: "8703900030",
    descripcionCorta: "Turismo híbrido",
    uso: "turismo",
    combustible: "hibrido",
    ccMin: null,
    ccMax: null,
    traccion4x4: null,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 — 8703.90",
    permisos: FH,
  },
  {
    codigo: "8703900090",
    descripcionCorta: "Los demás turismo (87.03)",
    uso: "turismo",
    combustible: "otro",
    ccMin: null,
    ccMax: null,
    traccion4x4: null,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 y 6 — residual 8703.90",
    permisos: FH,
  },
  {
    codigo: "8702109000",
    descripcionCorta: "Bus diésel > 16 personas",
    uso: "bus",
    combustible: "diesel",
    ccMin: null,
    ccMax: null,
    traccion4x4: null,
    pesoMaxTonMin: null,
    pesoMaxTonMax: null,
    notas: "RGI 1 — 87.02 (servicio público en el anexo)",
    permisos: FH,
  },
  {
    codigo: "8704211000",
    descripcionCorta: "Carga diésel, PBT ≤ 4,537 t",
    uso: "carga",
    combustible: "diesel",
    ccMin: null,
    ccMax: null,
    traccion4x4: null,
    pesoMaxTonMin: 0,
    pesoMaxTonMax: 4.537,
    notas: "RGI 1 y 6 — 8704.21",
    permisos: FH,
  },
  {
    codigo: "8704311090",
    descripcionCorta: "Carga gasolina, PBT < 4,537 t",
    uso: "carga",
    combustible: "gasolina",
    ccMin: null,
    ccMax: null,
    traccion4x4: null,
    pesoMaxTonMin: 0,
    pesoMaxTonMax: 4.536,
    notas: "RGI 1 y 6 — 8704.31",
    permisos: FH,
  },
  {
    codigo: "8704900011",
    descripcionCorta: "Carga eléctrica, PBT < 4,537 t",
    uso: "carga",
    combustible: "electrico",
    ccMin: null,
    ccMax: null,
    traccion4x4: null,
    pesoMaxTonMin: 0,
    pesoMaxTonMax: 4.536,
    notas: "RGI 1 — 8704.90",
    permisos: FH,
  },
  {
    codigo: "8704900012",
    descripcionCorta: "Carga híbrida, PBT < 4,537 t",
    uso: "carga",
    combustible: "hibrido",
    ccMin: null,
    ccMax: null,
    traccion4x4: null,
    pesoMaxTonMin: 0,
    pesoMaxTonMax: 4.536,
    notas: "RGI 1 — 8704.90",
    permisos: FH,
  },
];

export function formatPartida10(codigo: string): string {
  const d = codigo.replace(/\D/g, "").padEnd(10, "0").slice(0, 10);
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}.${d.slice(8, 10)}`;
}

export function lookupPartidaVehicular(codigo: string): PartidaVehicular | null {
  const d = codigo.replace(/\D/g, "");
  return PARTIDAS_VEHICULARES.find((p) => p.codigo === d) ?? null;
}
