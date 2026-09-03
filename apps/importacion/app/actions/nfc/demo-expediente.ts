"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createPuertoLibreVehiculoAction } from "@/app/actions/nfc/importacion-vehiculo";
import { ensureImportadorForTaller } from "@/app/actions/nfc/importadores";
import { syncLoteDocumentoToSiblings } from "@/lib/importacion/expediente-lote-sync";
import { isDocumentoLote } from "@/lib/importacion/expediente-lote";
import {
  DEMO_IMPORTADOR_NOMBRE,
  DEMO_PLANTILLAS_FOLDER,
  DEMO_UNIDAD_COLORES,
  DEMO_UNIDADES,
  DEMO_VEHICULO,
  type DemoUnidadIndex,
  demoMotorFromTallerId,
  demoNumeroBlFromTallerId,
  demoPlantillaPath,
  demoRifFromTallerId,
  demoSerialFromTallerId,
  demoSerialLegacyFromTallerId,
  isSafeDemoPlantillaFilename,
  mapPlantillaFilenameToTipo,
} from "@/lib/importacion/demo-plantillas";
import {
  parseImportacion,
  parseVehiculosDocumentos,
  serializeImportacion,
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
  numeroBl: string | null;
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

const UNIDADES: DemoUnidadIndex[] = [1, 2, 3];

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
    color: row.color ?? "",
    serialCarroceria: row.serial_carroceria ?? "",
    codigoExpediente: imp.codigoExpediente ?? null,
    importadorNombre: imp.importadorNombre?.trim() || DEMO_IMPORTADOR_NOMBRE,
    numeroBl: imp.numeroBl ?? null,
    documentosAdjuntos: tiposAdjuntos(parseVehiculosDocumentos(row.documentos)),
  };
}

const VEHICULO_SELECT =
  "id, placa, marca, modelo, color, serial_carroceria, documentos, importacion";

async function loadBySerial(tallerId: string, serial: string) {
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

async function loadCargaDemo(tallerId: string) {
  const serials = UNIDADES.map((u) => demoSerialFromTallerId(tallerId, u));
  const legacy = demoSerialLegacyFromTallerId(tallerId);
  const rows: NonNullable<Awaited<ReturnType<typeof loadBySerial>>["row"]>[] =
    [];
  for (const serial of serials) {
    const found = await loadBySerial(tallerId, serial);
    if (found.error) return { error: found.error, rows: [] };
    if (found.row) rows.push(found.row);
  }
  if (rows.length < DEMO_UNIDADES) {
    const old = await loadBySerial(tallerId, legacy);
    if (old.error) return { error: old.error, rows };
    if (old.row && !rows.some((r) => r.id === old.row!.id)) {
      rows.unshift(old.row);
    }
  }
  return { error: null, rows };
}

async function ensureNumeroBl(
  tallerId: string,
  row: { id: string; importacion: unknown },
  numeroBl: string
) {
  const imp = parseImportacion(row.importacion);
  if ((imp.numeroBl ?? "").trim()) return;
  const admin = createAdminClient();
  await admin
    .from("vehiculos")
    .update({
      importacion: serializeImportacion({ ...imp, numeroBl }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("taller_id", tallerId);
}

/**
 * Crea (o reutiliza) la carga de demostración: 3 expedientes, un BL.
 * RLS: service role tras requireTallerAuth; solo escribe en ese taller_id.
 */
export async function ensureDemoExpedienteAction(): Promise<
  | {
      success: true;
      created: boolean;
      numeroBl: string;
      vehiculos: DemoExpedienteVehiculo[];
    }
  | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const numeroBl = demoNumeroBlFromTallerId(auth.taller.id);
  const existing = await loadCargaDemo(auth.taller.id);
  if (existing.error) return { success: false, error: existing.error };

  for (const row of existing.rows) {
    await ensureNumeroBl(auth.taller.id, row, numeroBl);
  }

  if (existing.rows.length >= DEMO_UNIDADES) {
    const reloaded = await loadCargaDemo(auth.taller.id);
    return {
      success: true,
      created: false,
      numeroBl,
      vehiculos: (reloaded.rows ?? existing.rows).slice(0, 3).map(mapVehiculoRow),
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

  let createdAny = false;
  const haveSerials = new Set(
    existing.rows.map((r) => String(r.serial_carroceria ?? "").toUpperCase())
  );

  for (const unidad of UNIDADES) {
    const serial = demoSerialFromTallerId(auth.taller.id, unidad);
    const legacy = demoSerialLegacyFromTallerId(auth.taller.id);
    if (haveSerials.has(serial) || (unidad === 1 && haveSerials.has(legacy))) {
      continue;
    }

    const created = await createPuertoLibreVehiculoAction({
      marca: DEMO_VEHICULO.marca,
      modelo: DEMO_VEHICULO.modelo,
      color: DEMO_UNIDAD_COLORES[unidad],
      anio: DEMO_VEHICULO.anio,
      serialMotor: demoMotorFromTallerId(auth.taller.id, unidad),
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
      numeroBl,
      observaciones: `Carga demo unidad ${unidad}/${DEMO_UNIDADES}. Factura y certificado son de la carga; se copian a cada expediente.`,
    });

    if (!created.success) {
      const again = await loadBySerial(auth.taller.id, serial);
      if (again.row) continue;
      return { success: false, error: created.error };
    }
    createdAny = true;
  }

  const loaded = await loadCargaDemo(auth.taller.id);
  if (loaded.error || loaded.rows.length === 0) {
    return {
      success: false,
      error: loaded.error ?? "No se pudo recargar la carga de demostración",
    };
  }

  revalidatePath("/smartimport/expediente-demo");
  revalidatePath("/smartimport");
  revalidatePath("/smartimport/lote");
  return {
    success: true,
    created: createdAny,
    numeroBl,
    vehiculos: loaded.rows.slice(0, 3).map(mapVehiculoRow),
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
    const sizeRaw =
      item.metadata && typeof item.metadata === "object"
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

async function reloadCarga(
  tallerId: string
): Promise<DemoExpedienteVehiculo[]> {
  const loaded = await loadCargaDemo(tallerId);
  return loaded.rows.map(mapVehiculoRow);
}

/**
 * Copia un PDF de demo-plantillas/ al primer expediente y, si es de carga,
 * lo replica en los 3 del mismo BL.
 */
export async function adjuntarPdfDemoAction(
  raw: unknown
): Promise<
  | {
      success: true;
      tipo: DocumentoTipo;
      copiados: number;
      vehiculos: DemoExpedienteVehiculo[];
    }
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

  const documento = {
    url: urlData.publicUrl,
    path: destPath,
    scanned_at: new Date().toISOString(),
    file_name: parsed.data.filename,
  };
  const current = parseVehiculosDocumentos(row.documentos);
  const next: VehiculosDocumentos = { ...current, [tipo]: documento };

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

  let copiados = 0;
  const importacion = parseImportacion(updated.importacion);
  if (isDocumentoLote(tipo)) {
    copiados = await syncLoteDocumentoToSiblings({
      admin,
      tallerId: auth.taller.id,
      sourceVehiculoId: updated.id,
      sourceImportacion: importacion,
      tipo,
      documento,
    });
  }

  revalidatePath("/smartimport/expediente-demo");
  revalidatePath("/smartimport");
  revalidatePath("/smartimport/lote");
  revalidatePath(`/smartimport/${row.id}`);
  revalidatePath(`/smartimport/${row.id}/planilla`);

  return {
    success: true,
    tipo,
    copiados,
    vehiculos: await reloadCarga(auth.taller.id),
  };
}

export async function adjuntarTodosPdfsDemoAction(
  raw: unknown
): Promise<
  | {
      success: true;
      adjuntados: number;
      errores: string[];
      vehiculos: DemoExpedienteVehiculo[];
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
  let vehiculos: DemoExpedienteVehiculo[] = [];
  let adjuntados = 0;

  for (const item of usable) {
    const result = await adjuntarPdfDemoAction({
      vehiculoId: idParsed.data.vehiculoId,
      filename: item.name,
    });
    if (result.success) {
      adjuntados += 1;
      vehiculos = result.vehiculos;
    } else {
      errores.push(`${item.name}: ${result.error}`);
    }
  }

  if (vehiculos.length === 0) {
    return {
      success: false,
      error: errores[0] ?? "No se adjuntó ningún PDF",
    };
  }

  return { success: true, adjuntados, errores, vehiculos };
}
