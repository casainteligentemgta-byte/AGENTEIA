"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createPuertoLibreVehiculoAction } from "@/app/actions/nfc/importacion-vehiculo";
import { ensureImportadorForTaller } from "@/app/actions/nfc/importadores";
import {
  DEMO_IMPORTADOR_NOMBRE,
  DEMO_PLANTILLAS_FOLDER,
  DEMO_VEHICULO,
  demoMotorFromTallerId,
  demoPlantillaPath,
  demoRifFromTallerId,
  demoSerialFromTallerId,
  isSafeDemoPlantillaFilename,
  mapPlantillaFilenameToTipo,
} from "@/lib/importacion/demo-plantillas";
import {
  parseImportacion,
  parseVehiculosDocumentos,
  type DocumentoTipo,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { VEHICULO_DOCS_BUCKET } from "@/lib/vehiculos/upload-documento";

type ActionErr = { success: false; error: string };

export type DemoExpedienteVehiculo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  color: string;
  serialCarroceria: string;
  codigoExpediente: string | null;
  importadorNombre: string;
  documentosAdjuntos: DocumentoTipo[];
};

export type DemoPlantillaItem = {
  name: string;
  path: string;
  tipo: DocumentoTipo | null;
  size: number | null;
  publicUrl: string;
};

const adjuntarSchema = z.object({
  vehiculoId: z.string().uuid(),
  filename: z
    .string()
    .trim()
    .min(1)
    .refine(isSafeDemoPlantillaFilename, "Nombre de archivo inválido"),
});

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) {
    return { error: "Debes iniciar sesión" as const, taller: null };
  }
  const taller = await getMyTaller();
  if (!taller) {
    return { error: "No se encontró tu taller" as const, taller: null };
  }
  return { error: null, taller };
}

function tiposAdjuntos(docs: VehiculosDocumentos): DocumentoTipo[] {
  return (Object.keys(docs) as DocumentoTipo[]).filter((tipo) => {
    const ref = docs[tipo];
    return Boolean(ref?.path);
  });
}

function mapVehiculoRow(row: {
  id: string;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serial_carroceria: string | null;
  documentos: unknown;
  importacion: unknown;
}): DemoExpedienteVehiculo {
  const imp = parseImportacion(row.importacion);
  return {
    id: row.id,
    placa: row.placa ?? "",
    marca: row.marca ?? DEMO_VEHICULO.marca,
    modelo: row.modelo ?? DEMO_VEHICULO.modelo,
    color: row.color ?? DEMO_VEHICULO.color,
    serialCarroceria: row.serial_carroceria ?? "",
    codigoExpediente: imp.codigoExpediente ?? null,
    importadorNombre: imp.importadorNombre?.trim() || DEMO_IMPORTADOR_NOMBRE,
    documentosAdjuntos: tiposAdjuntos(parseVehiculosDocumentos(row.documentos)),
  };
}

const VEHICULO_SELECT =
  "id, placa, marca, modelo, color, serial_carroceria, documentos, importacion";

async function loadDemoVehiculo(tallerId: string, serial: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehiculos")
    .select(VEHICULO_SELECT)
    .eq("taller_id", tallerId)
    .eq("serial_carroceria", serial)
    .maybeSingle();
  if (error) return { error: error.message, row: null };
  return { error: null, row: data };
}

/**
 * Crea (o reutiliza) el expediente de demostración del taller de la sesión.
 * RLS: service role tras requireTallerAuth; solo escribe en ese taller_id.
 */
export async function ensureDemoExpedienteAction(): Promise<
  | { success: true; created: boolean; vehiculo: DemoExpedienteVehiculo }
  | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const serial = demoSerialFromTallerId(auth.taller.id);
  const existing = await loadDemoVehiculo(auth.taller.id, serial);
  if (existing.error) return { success: false, error: existing.error };
  if (existing.row) {
    return {
      success: true,
      created: false,
      vehiculo: mapVehiculoRow(existing.row),
    };
  }

  const rif = demoRifFromTallerId(auth.taller.id);
  const importador = await ensureImportadorForTaller({
    tallerId: auth.taller.id,
    nombre: DEMO_IMPORTADOR_NOMBRE,
    documento: rif,
    tipo: "juridica",
    direccion: "Av. 4 de Mayo, Porlamar, Nueva Esparta",
  });
  if (!importador.ok) {
    return { success: false, error: importador.error };
  }

  const created = await createPuertoLibreVehiculoAction({
    marca: DEMO_VEHICULO.marca,
    modelo: DEMO_VEHICULO.modelo,
    color: DEMO_VEHICULO.color,
    anio: DEMO_VEHICULO.anio,
    serialMotor: demoMotorFromTallerId(auth.taller.id),
    vin: serial,
    serialCarroceria: serial,
    kilometraje: 0,
    condicion: "nuevo",
    esSubasta: false,
    tipoCombustible: "diesel",
    fechaLlegadaBuque: "",
    regimen: "puerto_libre",
    importadorId: importador.importadorId,
    paisOrigen: "Japón",
    observaciones:
      "Expediente de demostración. Adjunta los PDF que ya están en la nube.",
  });

  if (!created.success) {
    const again = await loadDemoVehiculo(auth.taller.id, serial);
    if (again.row) {
      return {
        success: true,
        created: false,
        vehiculo: mapVehiculoRow(again.row),
      };
    }
    return { success: false, error: created.error };
  }

  const loaded = await loadDemoVehiculo(auth.taller.id, serial);
  if (loaded.error || !loaded.row) {
    return {
      success: false,
      error: loaded.error ?? "Se creó el expediente pero no se pudo recargar",
    };
  }

  revalidatePath("/smartimport/expediente-demo");
  revalidatePath("/smartimport");
  return {
    success: true,
    created: true,
    vehiculo: mapVehiculoRow(loaded.row),
  };
}

/**
 * Lista los PDF en demo-plantillas/ (service role: el prefijo no es taller_id).
 */
export async function listDemoPlantillaPdfsAction(): Promise<
  | {
      success: true;
      plantillas: DemoPlantillaItem[];
      bucket: string;
      folder: string;
    }
  | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(VEHICULO_DOCS_BUCKET)
    .list(DEMO_PLANTILLAS_FOLDER, {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });

  if (error) {
    return {
      success: false,
      error: `No se pudieron listar los PDF de la nube: ${error.message}`,
    };
  }

  const plantillas: DemoPlantillaItem[] = [];
  for (const item of data ?? []) {
    if (!item.name || item.id == null) continue;
    if (!isSafeDemoPlantillaFilename(item.name)) continue;
    const path = demoPlantillaPath(item.name);
    const { data: urlData } = admin.storage
      .from(VEHICULO_DOCS_BUCKET)
      .getPublicUrl(path);
    const sizeRaw = item.metadata && typeof item.metadata === "object"
      ? (item.metadata as { size?: unknown }).size
      : undefined;
    plantillas.push({
      name: item.name,
      path,
      tipo: mapPlantillaFilenameToTipo(item.name),
      size: typeof sizeRaw === "number" ? sizeRaw : null,
      publicUrl: urlData.publicUrl,
    });
  }

  return {
    success: true,
    plantillas,
    bucket: VEHICULO_DOCS_BUCKET,
    folder: DEMO_PLANTILLAS_FOLDER,
  };
}

/**
 * Copia un PDF de demo-plantillas/ a la carpeta del vehículo del taller.
 * RLS: session + taller; destino siempre `{tallerId}/{vehiculoId}/…`.
 */
export async function adjuntarPdfDemoAction(
  raw: unknown
): Promise<
  | { success: true; tipo: DocumentoTipo; vehiculo: DemoExpedienteVehiculo }
  | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = adjuntarSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const tipo = mapPlantillaFilenameToTipo(parsed.data.filename);
  if (!tipo) {
    return {
      success: false,
      error: `No reconocí el tipo de «${parsed.data.filename}». Usa factura_comercial.pdf, certificado_origen.pdf, bl_guia.pdf o lista_empaque.pdf.`,
    };
  }

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("vehiculos")
    .select(VEHICULO_SELECT)
    .eq("id", parsed.data.vehiculoId)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  if (rowError) return { success: false, error: rowError.message };
  if (!row) return { success: false, error: "Expediente no encontrado" };

  const sourcePath = demoPlantillaPath(parsed.data.filename);
  const destPath = `${auth.taller.id}/${row.id}/${tipo}-${crypto.randomUUID()}.pdf`;

  const { error: copyError } = await admin.storage
    .from(VEHICULO_DOCS_BUCKET)
    .copy(sourcePath, destPath);

  if (copyError) {
    return {
      success: false,
      error: `No se pudo copiar ${parsed.data.filename}: ${copyError.message}`,
    };
  }

  const { data: urlData } = admin.storage
    .from(VEHICULO_DOCS_BUCKET)
    .getPublicUrl(destPath);

  const current = parseVehiculosDocumentos(row.documentos);
  const next: VehiculosDocumentos = {
    ...current,
    [tipo]: {
      url: urlData.publicUrl,
      path: destPath,
      scanned_at: new Date().toISOString(),
      file_name: parsed.data.filename,
    },
  };

  const { data: updated, error: updateError } = await admin
    .from("vehiculos")
    .update({ documentos: next, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("taller_id", auth.taller.id)
    .select(VEHICULO_SELECT)
    .maybeSingle();

  if (updateError || !updated) {
    return {
      success: false,
      error:
        updateError?.message ??
        "El PDF se copió pero no se guardó en el expediente",
    };
  }

  revalidatePath("/smartimport/expediente-demo");
  revalidatePath("/smartimport");
  revalidatePath(`/smartimport/${row.id}`);
  revalidatePath(`/smartimport/${row.id}/planilla`);

  return {
    success: true,
    tipo,
    vehiculo: mapVehiculoRow(updated),
  };
}

export async function adjuntarTodosPdfsDemoAction(
  raw: unknown
): Promise<
  | {
      success: true;
      adjuntados: number;
      errores: string[];
      vehiculo: DemoExpedienteVehiculo;
    }
  | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const idParsed = z
    .object({ vehiculoId: z.string().uuid() })
    .safeParse(raw);
  if (!idParsed.success) {
    return { success: false, error: "Expediente inválido" };
  }

  const listed = await listDemoPlantillaPdfsAction();
  if (!listed.success) return listed;

  const usable = listed.plantillas.filter((item) => item.tipo);
  if (usable.length === 0) {
    return {
      success: false,
      error:
        "No hay PDF reconocibles en demo-plantillas/. Sube factura_comercial.pdf, certificado_origen.pdf, bl_guia.pdf y lista_empaque.pdf al bucket vehiculos-documentos.",
    };
  }

  const errores: string[] = [];
  let vehiculo: DemoExpedienteVehiculo | null = null;
  let adjuntados = 0;

  for (const item of usable) {
    const result = await adjuntarPdfDemoAction({
      vehiculoId: idParsed.data.vehiculoId,
      filename: item.name,
    });
    if (result.success) {
      adjuntados += 1;
      vehiculo = result.vehiculo;
    } else {
      errores.push(`${item.name}: ${result.error}`);
    }
  }

  if (!vehiculo) {
    return {
      success: false,
      error: errores[0] ?? "No se adjuntó ningún PDF",
    };
  }

  return { success: true, adjuntados, errores, vehiculo };
}
