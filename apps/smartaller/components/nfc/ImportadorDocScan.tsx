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
import {
  IMPORTADOR_DOC_HINTS,
  IMPORTADOR_DOC_LABELS,
  importadorDocUsaOcr,
  importadorDocsRequeridos,
  type ImportadorDocTipo,
} from "@/lib/importadores/documentos";
import type { ImportadorDocumentos } from "@/lib/importadores/upload-documento";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";
import type { ImportadorTipo } from "@/lib/schemas/importador";

const ACCEPT_FILE =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf";

export type ImportadorDocKind = ImportadorDocTipo;

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
  const usaOcr = importadorDocUsaOcr(tipoDoc);

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
        if (usaOcr) {
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
        } else {
          onExtracted({}, tipoDoc, prepared);
          setDoneMsg("Documento listo para guardar");
        }
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
      <p className="text-sm font-medium text-[#e9edef]">{label} *</p>
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
          {usaOcr ? "Leyendo…" : "Preparando…"}
        </p>
      ) : doneMsg || loaded ? (
        <div className="space-y-2">
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
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className="text-xs font-medium text-cyan-300 underline hover:text-cyan-100"
          >
            Cambiar
          </button>
        </div>
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

/** Carga obligatoria de documentos del cliente. RIF y cédula también rellenan datos. */
export function ImportadorDocScan({
  tipoCliente,
  existingDocumentos,
  onExtracted,
}: Props) {
  const requeridos = importadorDocsRequeridos(tipoCliente);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-white">
          Documentos del cliente *
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Hay que cargar todos. El RIF y la cédula o pasaporte también rellenan
          el formulario.
        </p>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {requeridos.map((tipoDoc) => (
          <ScanChip
            key={tipoDoc}
            tipoDoc={tipoDoc}
            label={IMPORTADOR_DOC_LABELS[tipoDoc]}
            hint={IMPORTADOR_DOC_HINTS[tipoDoc]}
            tipoCliente={tipoCliente}
            existingUrl={existingDocumentos?.[tipoDoc]?.url}
            onExtracted={onExtracted}
          />
        ))}
      </div>
    </section>
  );
}
