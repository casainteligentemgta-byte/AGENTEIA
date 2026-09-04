import type { ImportadorTipo } from "@/lib/schemas/importador";

export const IMPORTADOR_DOC_TIPOS = [
  "rif",
  "cedula",
  "acta_constitutiva",
  "constancia_domicilio",
  "comprobante_inscripcion_tributaria",
] as const;

export type ImportadorDocTipo = (typeof IMPORTADOR_DOC_TIPOS)[number];

export const IMPORTADOR_DOC_LABELS: Record<ImportadorDocTipo, string> = {
  rif: "RIF vigente (Registro de Información Fiscal)",
  cedula: "Cédula de identidad o pasaporte (laminado y vigente)",
  acta_constitutiva: "Acta constitutiva de la empresa",
  constancia_domicilio: "Constancia de domicilio",
  comprobante_inscripcion_tributaria: "Comprobante de inscripción tributaria",
};

export const IMPORTADOR_DOC_HINTS: Record<ImportadorDocTipo, string> = {
  rif: "Carnet o comprobante SENIAT vigente · rellena datos",
  cedula: "Laminado y vigente. También acepta pasaporte.",
  acta_constitutiva: "Obligatoria si el cliente es persona jurídica",
  constancia_domicilio: "Servicio o constancia de residencia",
  comprobante_inscripcion_tributaria: "Inscripción SENIAT / tributaria",
};

const OCR_TIPOS = new Set<ImportadorDocTipo>(["rif", "cedula"]);

export function importadorDocUsaOcr(tipo: ImportadorDocTipo): boolean {
  return OCR_TIPOS.has(tipo);
}

export function isImportadorDocTipo(value: string): value is ImportadorDocTipo {
  return (IMPORTADOR_DOC_TIPOS as readonly string[]).includes(value);
}

/** Acta constitutiva solo si es jurídica. */
export function importadorDocsRequeridos(
  tipo: ImportadorTipo
): ImportadorDocTipo[] {
  if (tipo === "juridica") return [...IMPORTADOR_DOC_TIPOS];
  return IMPORTADOR_DOC_TIPOS.filter((t) => t !== "acta_constitutiva");
}

export function importadorDocsFaltantes(
  tipo: ImportadorTipo,
  docs: Partial<Record<ImportadorDocTipo, { url?: string } | undefined>> | null | undefined,
  pending?: Partial<Record<ImportadorDocTipo, unknown>>
): ImportadorDocTipo[] {
  return importadorDocsRequeridos(tipo).filter((t) => {
    const cargado = Boolean(docs?.[t]?.url) || Boolean(pending?.[t]);
    return !cargado;
  });
}

export function importadorDocsResumen(
  tipo: ImportadorTipo,
  docs: Partial<Record<ImportadorDocTipo, { url?: string } | undefined>> | null | undefined
): { cargados: number; total: number } {
  const required = importadorDocsRequeridos(tipo);
  const cargados = required.filter((t) => Boolean(docs?.[t]?.url)).length;
  return { cargados, total: required.length };
}
