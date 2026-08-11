"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Camera,
  CheckCircle2,
  FileUp,
  IdCard,
  Images,
  Loader2,
} from "lucide-react";
import { extractImportadorDocumentoAction } from "@/app/actions/nfc/importador-extract";
import type { ImportadorScanFields } from "@/lib/extract-identidad-ve";
import type { ImportadorDocumentos } from "@/lib/importadores/upload-documento";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";
import type { ImportadorTipo } from "@/lib/schemas/importador";

const ACCEPT_IMAGE =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic";
const ACCEPT_FILE =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf";

export type ImportadorDocKind = "rif" | "cedula";

type Props = {
  tipoCliente: ImportadorTipo;
  existingDocumentos?: ImportadorDocumentos;
  onExtracted: (
    fields: ImportadorScanFields,
    tipoDoc: ImportadorDocKind,
    file: File
  ) => void;
};

async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return file;
  }
  return normalizeImageFileForUpload(file);
}

function ScanChip({
  tipoDoc,
  label,
  hint,
  tipoCliente,
  existingUrl,
  onExtracted,
}: {
  tipoDoc: ImportadorDocKind;
  label: string;
  hint: string;
  tipoCliente: ImportadorTipo;
  existingUrl?: string | null;
  onExtracted: Props["onExtracted"];
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
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
        fd.set("tipoDoc", tipoDoc);
        fd.set("tipoCliente", tipoCliente);
        fd.set("file", prepared);
        const result = await extractImportadorDocumentoAction(fd);
        if (!result.success) {
          setError(result.error);
          return;
        }
        onExtracted(result.fields, tipoDoc, prepared);
        setDoneMsg(
          `${result.filledCount} campo${result.filledCount === 1 ? "" : "s"} rellenado${result.filledCount === 1 ? "" : "s"}`
        );
        setUrl(URL.createObjectURL(prepared));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo leer el documento"
        );
      }
    });
  }

  const loaded = Boolean(url);
  const btnClass =
    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/30 px-2 py-2 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-950/50 disabled:opacity-50";

  return (
    <div
      className={`rounded-xl border border-dashed p-3 ${
        doneMsg || loaded
          ? "border-emerald-700/50 bg-emerald-950/20"
          : "border-slate-700 bg-slate-900/50"
      }`}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-slate-100">
        {tipoDoc === "rif" ? (
          <IdCard className="h-4 w-4 shrink-0 text-cyan-400" />
        ) : (
          <Camera className="h-4 w-4 shrink-0 text-cyan-400" />
        )}
        {label}
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>
      {doneMsg ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {doneMsg}
        </p>
      ) : loaded ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Documento guardado
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
          Leyendo…
        </p>
      ) : (
        <div className="mt-2.5 flex gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => cameraRef.current?.click()}
            className={btnClass}
          >
            <Camera className="h-3.5 w-3.5 shrink-0" />
            Cámara
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => galleryRef.current?.click()}
            className={btnClass}
          >
            <Images className="h-3.5 w-3.5 shrink-0" />
            Galería
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className={btnClass}
          >
            <FileUp className="h-3.5 w-3.5 shrink-0" />
            Archivo
          </button>
        </div>
      )}

      {/* Cámara: captura directa */}
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT_IMAGE}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {/* Galería / carrete: sin capture */}
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPT_IMAGE}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {/* Archivos: PDF o foto desde el gestor */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_FILE}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Escaneo OCR de RIF y cédula para autocompletar el formulario de cliente. */
export function ImportadorDocScan({
  tipoCliente,
  existingDocumentos,
  onExtracted,
}: Props) {
  return (
    <section className="space-y-2.5 rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-3.5 sm:p-4">
      <h2 className="text-sm font-semibold text-slate-100">
        Autocompletar con documento
      </h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <ScanChip
          tipoDoc="rif"
          label="RIF"
          hint="Carnet o comprobante SENIAT"
          tipoCliente={tipoCliente}
          existingUrl={existingDocumentos?.rif?.url}
          onExtracted={onExtracted}
        />
        <ScanChip
          tipoDoc="cedula"
          label={
            tipoCliente === "juridica"
              ? "Cédula del representante"
              : "Cédula"
          }
          hint={
            tipoCliente === "juridica"
              ? "Cédula del representante legal"
              : "Cédula de identidad venezolana"
          }
          tipoCliente={tipoCliente}
          existingUrl={existingDocumentos?.cedula?.url}
          onExtracted={onExtracted}
        />
      </div>
    </section>
  );
}
