import {
  parseSeguro,
  serializeSeguro,
  type SeguroData,
} from "@/lib/schemas/vehiculo-documentos";

export type SeguroFichaDatos = Pick<
  SeguroData,
  | "aseguradora"
  | "numeroPoliza"
  | "tipoCobertura"
  | "vigenciaDesde"
  | "vigenciaHasta"
  | "montoAsegurado"
  | "telefonoAseguradora"
  | "corredor"
  | "observaciones"
>;

/** Copia la ficha de seguro al expediente (sin avanzar la fase). */
export function vehiculoPatchFromSeguro(
  seguroFichaId: string,
  datos: SeguroFichaDatos,
  seguroRaw: unknown
): { seguro_ficha_id: string; seguro: Record<string, unknown> } {
  const existing = parseSeguro(seguroRaw);
  return {
    seguro_ficha_id: seguroFichaId,
    seguro: serializeSeguro({
      ...existing,
      aseguradora: datos.aseguradora,
      numeroPoliza: datos.numeroPoliza,
      tipoCobertura: datos.tipoCobertura,
      vigenciaDesde: datos.vigenciaDesde,
      vigenciaHasta: datos.vigenciaHasta,
      montoAsegurado: datos.montoAsegurado,
      telefonoAseguradora: datos.telefonoAseguradora,
      corredor: datos.corredor,
      observaciones: datos.observaciones ?? existing.observaciones,
    }),
  };
}
