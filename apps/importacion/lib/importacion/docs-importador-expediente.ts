import type { ImportadorDocTipo } from "@/lib/importadores/documentos";
import type { ImportadorDocumentos } from "@/lib/importadores/upload-documento";
import type {
  DocumentoTipo,
  VehiculoDocumentoRef,
  VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

export type DocImportadorExpediente =
  | "cedula_importador"
  | "rif_importador"
  | "acta_constitutiva"
  | "constancia_domicilio"
  | "comprobante_inscripcion_tributaria";

const CLIENTE_A_EXPEDIENTE: Record<ImportadorDocTipo, DocImportadorExpediente> =
  {
    rif: "rif_importador",
    cedula: "cedula_importador",
    acta_constitutiva: "acta_constitutiva",
    constancia_domicilio: "constancia_domicilio",
    comprobante_inscripcion_tributaria: "comprobante_inscripcion_tributaria",
  };

function asVehiculoRef(ref: {
  url: string;
  path: string;
  scanned_at: string;
  file_name: string;
}): VehiculoDocumentoRef {
  return {
    url: ref.url,
    path: ref.path,
    scanned_at: ref.scanned_at,
    file_name: ref.file_name,
  };
}

/**
 * Docs del cliente → expediente. No pisa un archivo que ya esté cargado.
 */
export function mergeCedulaRifDesdeCliente(
  current: VehiculosDocumentos,
  cliente: ImportadorDocumentos
): { next: VehiculosDocumentos; added: DocImportadorExpediente[] } {
  const next: VehiculosDocumentos = { ...current };
  const added: DocImportadorExpediente[] = [];

  for (const [clienteTipo, vehiculoTipo] of Object.entries(
    CLIENTE_A_EXPEDIENTE
  ) as Array<[ImportadorDocTipo, DocImportadorExpediente]>) {
    const ref = cliente[clienteTipo];
    if (!ref?.url) continue;
    if (current[vehiculoTipo as DocumentoTipo]?.url) continue;
    next[vehiculoTipo] = asVehiculoRef(ref);
    added.push(vehiculoTipo);
  }

  return { next, added };
}
