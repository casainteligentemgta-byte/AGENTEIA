"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, IdCard, Loader2 } from "lucide-react";
import { extractPropietarioCedulaAction } from "@/app/actions/nfc/propietario-extract";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-vehiculo";
import type { PropietarioScanFields } from "@/lib/extract-identidad-ve";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";
import type { VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";

const ACCEPT_FILE =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf";

type Props = {
  vehiculoId: string;
  existingUrl?: string | null;
  onExtracted: (fields: PropietarioScanFields) => void;
  onDocumentUploaded?: (documentos: VehiculosDocumentos) => void;
};

async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return file;
  }
  return normalizeImageFileForUpload(file);
}

/** OCR de cédula venezolana para autocompletar datos del comprador/propietario. */
export function PropietarioCedulaScan({
  vehiculoId,
  existingUrl,
  onExtracted,
  onDocumentUploaded,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(existingUrl ?? null);

  useEffect(() => {
    setUrl(existingUrl ?? null);
  }, [existingUrl]);

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setDoneMsg(null);

    startTransition(async () => {
      try {
        const prepared = await prepareFile(file);
        const fd = new FormData();
        fd.set("file", prepared);
        const result = await extractPropietarioCedulaAction(fd);
        if (!result.success) {
          setError(result.error);
          return;
        }

        onExtracted(result.fields);

        const uploadFd = new FormData();
        uploadFd.set("vehiculoId", vehiculoId);
        uploadFd.set("tipo", "cedula");
        uploadFd.set("file", prepared);
        const uploaded = await uploadPuertoLibreDocumentoAction(uploadFd);
        if (!uploaded.success) {
          setError(uploaded.error);
          setDoneMsg(
            `${result.filledCount} campo${result.filledCount === 1 ? "" : "s"} leído${result.filledCount === 1 ? "" : "s"}, pero no se pudo guardar la foto`
          );
          return;
        }

        const nextUrl = uploaded.documentos.cedula?.url ?? null;
        setUrl(nextUrl);
        onDocumentUploaded?.(uploaded.documentos);
        setDoneMsg(
          `${result.filledCount} campo${result.filledCount === 1 ? "" : "s"} rellenado${result.filledCount === 1 ? "" : "s"} · cédula guardada`
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo leer la cédula"
        );
      }
    });
  }

  const loaded = Boolean(url);

  return (
    <section className="space-y-2.5 rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-3.5 sm:p-4">
      <h3 className="text-sm font-semibold text-slate-100">
        Autocompletar con cédula
      </h3>
      <div
        className={`rounded-xl border border-dashed p-3 ${
          doneMsg || loaded
            ? "border-emerald-700/50 bg-emerald-950/20"
            : "border-slate-700 bg-slate-900/50"
        }`}
      >
        <p className="flex items-center gap-2 text-sm font-medium text-slate-100">
          <IdCard className="h-4 w-4 shrink-0 text-cyan-400" />
          Cédula de identidad
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Foto o PDF · nombre, cédula y fecha de nacimiento
        </p>
        {doneMsg ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {doneMsg}
          </p>
        ) : loaded ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Cédula guardada
            {existingUrl ? (
              <>
                {" · "}
                <a
                  href={existingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-emerald-200"
                >
                  Ver
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        {error ? <p className="mt-1.5 text-xs text-red-300">{error}</p> : null}

        {pending ? (
          <p className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-3 py-2 text-xs font-medium text-cyan-100">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Leyendo cédula…
          </p>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/30 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-950/50 disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5 shrink-0" />
            Tomar / subir foto cédula
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_FILE}
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
