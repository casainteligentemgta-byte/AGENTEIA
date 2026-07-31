"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/puerto-libre-vehiculo";
import {
  DOCUMENTO_LABELS,
  type DocumentoTipo,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";

type Props = {
  vehiculoId: string;
  tipo: DocumentoTipo;
  existingUrl?: string | null;
  onUploaded?: (documentos: VehiculosDocumentos) => void;
  /** Texto auxiliar bajo el título (fotos vs documentos). */
  hint?: string;
  /** Etiqueta del botón cuando no hay archivo. */
  actionLabel?: string;
  /** Tema visual: dark (ficha/planilla digital) o light (hoja imprimible). */
  tone?: "dark" | "light";
};

export function ImportDocumentoUpload({
  vehiculoId,
  tipo,
  existingUrl,
  onUploaded,
  hint = "Escanea foto (se convierte a PDF) o sube un PDF · máx. 10 MB",
  actionLabel = "Escanear / PDF",
  tone = "dark",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(Boolean(existingUrl));
  const [url, setUrl] = useState<string | null>(existingUrl ?? null);
  const light = tone === "light";

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);

    startTransition(async () => {
      try {
        const normalized =
          file.type === "application/pdf" ? file : await normalizeImageFileForUpload(file);
        const formData = new FormData();
        formData.set("vehiculoId", vehiculoId);
        formData.set("tipo", tipo);
        formData.set("file", normalized);

        const result = await uploadPuertoLibreDocumentoAction(formData);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setDone(true);
        const nextUrl = result.documentos[tipo]?.url ?? null;
        setUrl(nextUrl);
        onUploaded?.(result.documentos);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al subir el archivo");
      }
    });
  }

  return (
    <div
      className={`rounded-xl border border-dashed p-3 sm:p-4 ${
        light
          ? "border-zinc-300 bg-zinc-50 print:border-zinc-400 print:bg-white"
          : "border-slate-700 bg-slate-950/50"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p
            className={`text-sm font-medium ${light ? "text-zinc-800" : "text-slate-200"}`}
          >
            {DOCUMENTO_LABELS[tipo]}
          </p>
          {url || done ? (
            <a
              href={url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className={`mt-0.5 inline-block truncate text-xs ${
                light ? "text-cyan-700 hover:text-cyan-800" : "text-cyan-400 hover:text-cyan-300"
              }`}
            >
              {url ? "Ver archivo cargado" : "Archivo guardado en el perfil del vehículo"}
            </a>
          ) : hint.trim() ? (
            <p className={`mt-0.5 text-xs ${light ? "text-zinc-500" : "text-slate-500"}`}>
              {hint}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 print:hidden ${
            light
              ? "border border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-500"
              : "border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
          }`}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : done ? (
            <CheckCircle2 className={`h-4 w-4 ${light ? "text-white" : "text-emerald-400"}`} />
          ) : light ? (
            <FileUp className="h-4 w-4" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {pending ? "Subiendo…" : done ? "Cambiar archivo" : actionLabel}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {error ? (
        <p className={`mt-2 text-xs ${light ? "text-red-600" : "text-red-300"}`}>{error}</p>
      ) : null}
    </div>
  );
}
