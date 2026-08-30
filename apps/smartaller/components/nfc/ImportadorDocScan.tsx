"use client";

import { useEffect, useRef, useState, useTransition, type DragEvent } from "react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { extractImportadorDocumentoAction } from "@/app/actions/nfc/importador-extract";
import type { ImportadorScanFields } from "@/lib/extract-identidad-ve";
import type { ImportadorDocumentos } from "@/lib/importadores/upload-documento";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";
import type { ImportadorTipo } from "@/lib/schemas/importador";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(existingUrl ?? null);
  const [over, setOver] = useState(false);

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

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setOver(false);
    if (pending) return;
    handleFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#e9edef]">{label}</p>
      <div
        className={`rounded-2xl border border-dashed px-4 py-6 text-center ${
          doneMsg || loaded
            ? "border-emerald-700/50 bg-emerald-950/20"
            : over
              ? "border-cyan-400 bg-cyan-950/30"
              : "border-slate-600 bg-[#070f16]"
        }`}
      >
      {pending ? (
        <p className="inline-flex items-center justify-center gap-2 text-sm text-cyan-100">
          <Loader2 className="h-4 w-4 animate-spin" />
          Leyendo…
        </p>
      ) : doneMsg || loaded ? (
        <p className="inline-flex items-center justify-center gap-1.5 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {doneMsg ?? "Documento guardado"}
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
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!pending) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className="flex w-full flex-col items-center justify-center gap-2 text-center disabled:opacity-50"
        >
          <Upload className="h-6 w-6 text-cyan-400" />
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <FileText className="h-4 w-4" />
            Arrastra o elige el documento
          </span>
          <span className="text-xs text-slate-500">{hint}</span>
        </button>
      )}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

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
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-white">
          Autocompletar con documento
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Un PDF o una foto para rellenar los datos del cliente.
        </p>
      </div>
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
