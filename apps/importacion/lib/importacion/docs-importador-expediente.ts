import type { ImportadorDocumentos } from "@/lib/importadores/upload-documento";
import type {
  VehiculoDocumentoRef,
  VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

export type DocImportadorExpediente = "cedula_importador" | "rif_importador";

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
 * Cédula y RIF del cliente → docs del expediente.
 * No pisa un archivo que ya esté en el expediente.
 */
export function mergeCedulaRifDesdeCliente(
  current: VehiculosDocumentos,
  cliente: ImportadorDocumentos
): { next: VehiculosDocumentos; added: DocImportadorExpediente[] } {
  const next: VehiculosDocumentos = { ...current };
  const added: DocImportadorExpediente[] = [];

  if (cliente.cedula?.url && !current.cedula_importador?.url) {
    next.cedula_importador = asVehiculoRef(cliente.cedula);
    added.push("cedula_importador");
  }
  if (cliente.rif?.url && !current.rif_importador?.url) {
    next.rif_importador = asVehiculoRef(cliente.rif);
    added.push("rif_importador");
  }

  return { next, added };
}
