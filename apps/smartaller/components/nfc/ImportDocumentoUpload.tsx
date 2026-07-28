"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
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
};

export function ImportDocumentoUpload({
  vehiculoId,
  tipo,
  existingUrl,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(Boolean(existingUrl));

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);

    startTransition(async () => {
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
      onUploaded?.(result.documentos);
    });
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200">{DOCUMENTO_LABELS[tipo]}</p>
          {existingUrl || done ? (
            <a
              href={existingUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-block truncate text-xs text-cyan-400 hover:text-cyan-300"
            >
              {existingUrl ? "Ver documento en el perfil" : "Guardado en el perfil del vehículo"}
            </a>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">
              Escanea con la cámara o sube JPG/PNG/PDF · se guarda en este vehículo
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : done ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {pending ? "Guardando…" : done ? "Reescanear" : "Escanear"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
