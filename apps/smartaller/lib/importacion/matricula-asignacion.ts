import {
  parseImportacion,
  serializeImportacion,
} from "@/lib/schemas/vehiculo-documentos";

export type MatriculaFichaDatos = {
  placa: string | null;
  oficinaIntt: string | null;
  fechaTramite: string | null;
  requiereHomologacion: boolean;
  observaciones: string | null;
};

/** Copia la ficha de matrícula al expediente (sin completar la carpeta). */
export function vehiculoPatchFromMatricula(
  matriculaFichaId: string,
  datos: MatriculaFichaDatos,
  placaActual: string | null,
  importacionRaw: unknown
): {
  matricula_ficha_id: string;
  placa: string;
  importacion: Record<string, unknown>;
} {
  const existing = parseImportacion(importacionRaw);
  const placa = (datos.placa ?? "").trim() || (placaActual ?? "").trim();
  return {
    matricula_ficha_id: matriculaFichaId,
    placa,
    importacion: serializeImportacion({
      ...existing,
      requiereHomologacion: datos.requiereHomologacion,
    }),
  };
}
