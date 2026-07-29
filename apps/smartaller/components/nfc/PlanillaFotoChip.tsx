"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/puerto-libre-vehiculo";
import type { DocumentoTipo, VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";

type Props = {
  vehiculoId: string;
  tipo: DocumentoTipo;
  existingUrl?: string | null;
  onUploaded?: (documentos: VehiculosDocumentos) => void;
  tone?: "dark" | "light";
  /** Etiqueta corta del botón. */
  label?: string;
};

/** Botón compacto de foto; guarda en vehiculos.documentos (Supabase Storage). */
export function PlanillaFotoChip({
  vehiculoId,
  tipo,
  existingUrl,
  onUploaded,
  tone = "dark",
  label = "Foto",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(existingUrl ?? null);
  const light = tone === "light";
  const done = Boolean(url);

  useEffect(() => {
    setUrl(existingUrl ?? null);
  }, [existingUrl]);

  function handleFile(file: File | null) {
    if (!file) return;
    if (!vehiculoId) {
      setError("Abre la planilla desde la ficha del vehículo para guardar en Supabase.");
      return;
    }
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
          setError(result.error || "No se pudo guardar en Supabase");
          return;
        }
        const next = result.documentos[tipo]?.url ?? null;
        if (!next) {
          setError("Subida OK pero no se recibió URL. Revisa Storage vehiculos-documentos.");
          return;
        }
        setUrl(next);
        onUploaded?.(result.documentos);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al subir la foto");
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        disabled={pending || !vehiculoId}
        onClick={() => inputRef.current?.click()}
        aria-label={done ? `Ver o cambiar foto ${label}` : `Cargar foto ${label}`}
        className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 print:min-h-0 print:py-1 print:text-xs ${
          done
            ? light
              ? "bg-cyan-600 text-white ring-2 ring-cyan-400/40"
              : "bg-cyan-600 text-white ring-2 ring-cyan-400/50"
            : light
              ? "border border-cyan-300 bg-cyan-50 text-cyan-800"
              : "bg-slate-800 text-cyan-300 hover:bg-slate-700"
        }`}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : done ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {pending ? "Subiendo…" : done ? "Foto ✓" : label}
      </button>
      {/* Sin capture forzado: permite cámara, galería o PDF */}
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
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={`truncate text-[10px] print:hidden ${
            light ? "text-cyan-700" : "text-cyan-400"
          }`}
        >
          Ver en Supabase
        </a>
      ) : null}
      {error ? (
        <p className={`text-[10px] leading-snug ${light ? "text-red-600" : "text-red-300"}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
