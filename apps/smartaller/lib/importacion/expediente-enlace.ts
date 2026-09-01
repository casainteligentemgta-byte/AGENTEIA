import { resolveCodigoExpediente } from "@/lib/importacion/expediente";
import { parseImportacion } from "@/lib/schemas/vehiculo-documentos";

export type ExpedienteEnlace = {
  id: string;
  codigoExpediente: string;
  marca: string | null;
  modelo: string | null;
  fichaId: string | null;
  detalle: string | null;
};

export function labelExpedienteEnlace(
  importacion: unknown,
  placa: string | null
): string {
  const parsed = parseImportacion(importacion);
  return (
    resolveCodigoExpediente({
      codigoExpediente: parsed.codigoExpediente,
      placa,
    }) ??
    placa?.trim() ??
    "Expediente"
  );
}

export function isMissingRelation(
  error: { message?: string; code?: string } | null,
  needles: string[]
): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (error?.code === "42P01" || error?.code === "42703") return true;
  return needles.some((n) => msg.includes(n.toLowerCase()));
}
