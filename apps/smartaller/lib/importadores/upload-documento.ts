import type { SupabaseClient } from "@supabase/supabase-js";
import {
  IMPORTADOR_DOC_TIPOS,
  type ImportadorDocTipo,
} from "@/lib/importadores/documentos";
import {
  isGenericMimeType,
  resolveImageMimeType,
  validateImageMimeResolved,
} from "@/lib/mime-image";
import { VEHICULO_DOCS_BUCKET } from "@/lib/vehiculos/upload-documento";

export type { ImportadorDocTipo } from "@/lib/importadores/documentos";

export type ImportadorDocumentoRef = {
  url: string;
  path: string;
  scanned_at: string;
  file_name: string;
};

export type ImportadorDocumentos = Partial<
  Record<ImportadorDocTipo, ImportadorDocumentoRef>
>;

const MAX_BYTES = 10 * 1024 * 1024;

export function validateImportadorDocumentoFile(file: File): string | null {
  if (file.type === "application/pdf") {
    if (file.size > MAX_BYTES) return "El archivo supera 10 MB";
    if (file.size === 0) return "Archivo vacío";
    return null;
  }

  if (isGenericMimeType(file.type)) {
    if (file.size > MAX_BYTES) return "El archivo supera 10 MB";
    if (file.size === 0) return "Archivo vacío";
    return null;
  }

  const mime = resolveImageMimeType({
    declaredMime: file.type,
    fileName: file.name,
  });
  const mimeError = validateImageMimeResolved(mime, file.type);
  if (mimeError) return mimeError;

  if (file.size > MAX_BYTES) return "El archivo supera 10 MB";
  if (file.size === 0) return "Archivo vacío";
  return null;
}

export function parseImportadorDocumentos(raw: unknown): ImportadorDocumentos {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: ImportadorDocumentos = {};
  for (const key of IMPORTADOR_DOC_TIPOS) {
    const ref = obj[key];
    if (!ref || typeof ref !== "object" || Array.isArray(ref)) continue;
    const r = ref as Record<string, unknown>;
    if (typeof r.url === "string" && typeof r.path === "string") {
      out[key] = {
        url: r.url,
        path: r.path,
        scanned_at:
          typeof r.scanned_at === "string"
            ? r.scanned_at
            : new Date().toISOString(),
        file_name: typeof r.file_name === "string" ? r.file_name : key,
      };
    }
  }
  return out;
}

/** Sube un documento del cliente al storage (bucket vehiculos-documentos). */
export async function uploadImportadorDocumento(
  supabase: SupabaseClient,
  params: {
    tallerId: string;
    importadorId: string;
    tipo: ImportadorDocTipo;
    file: File;
  }
): Promise<ImportadorDocumentoRef> {
  const validationError = validateImportadorDocumentoFile(params.file);
  if (validationError) throw new Error(validationError);

  const originalBuffer = Buffer.from(await params.file.arrayBuffer());
  const id = crypto.randomUUID();
  const folder = `importadores/${params.importadorId}`;

  let contentType: string;
  let fileName: string;
  let path: string;

  if (params.file.type === "application/pdf" || /\.pdf$/i.test(params.file.name)) {
    contentType = "application/pdf";
    fileName = params.file.name?.toLowerCase().endsWith(".pdf")
      ? params.file.name
      : `${params.tipo}.pdf`;
    path = `${params.tallerId}/${folder}/${params.tipo}-${id}.pdf`;
  } else {
    const mimeType =
      resolveImageMimeType({
        declaredMime: params.file.type,
        fileName: params.file.name,
        buffer: originalBuffer,
      }) ?? "image/jpeg";
    contentType = mimeType;
    const ext =
      mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : mimeType === "image/heic" || mimeType === "image/heif"
            ? "heic"
            : "jpg";
    fileName = params.file.name || `${params.tipo}.${ext}`;
    path = `${params.tallerId}/${folder}/${params.tipo}-${id}.${ext}`;
  }

  const { error } = await supabase.storage
    .from(VEHICULO_DOCS_BUCKET)
    .upload(path, originalBuffer, { contentType, upsert: false });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from(VEHICULO_DOCS_BUCKET)
    .getPublicUrl(path);

  return {
    url: urlData.publicUrl,
    path,
    scanned_at: new Date().toISOString(),
    file_name: fileName,
  };
}
