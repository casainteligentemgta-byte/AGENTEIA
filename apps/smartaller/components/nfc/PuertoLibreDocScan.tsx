"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, FileText, Loader2, Ship } from "lucide-react";
import { extractPuertoLibreDocumentoAction } from "@/app/actions/nfc/puerto-libre-extract";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/puerto-libre-vehiculo";
import type { PuertoLibreRegistroScanFields } from "@/lib/extract-puerto-libre-docs";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";
import type { VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf";

export type PuertoLibreScanTipo = "factura_comercial" | "bl_guia";

type Props = {
  /** Si hay vehículo, el archivo se guarda en vehiculos.documentos (mismo destino que Embarque). */
  vehiculoId?: string;
  /** URLs ya persistidas (factura / BL) para mostrar estado cargado. */
  existingUrls?: Partial<Record<PuertoLibreScanTipo, string | null | undefined>>;
  onExtracted: (
    fields: PuertoLibreRegistroScanFields,
    tipo: PuertoLibreScanTipo,
    file: File
  ) => void;
  /** Se llama cuando el archivo queda persistido en la BD del vehículo. */
  onDocumentUploaded?: (documentos: VehiculosDocumentos, tipo: PuertoLibreScanTipo) => void;
};

async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return file;
  }
  return normalizeImageFileForUpload(file);
}

function ScanButton({
  tipo,
  label,
  icon: Icon,
  vehiculoId,
  existingUrl,
  onExtracted,
  onDocumentUploaded,
}: {
  tipo: PuertoLibreScanTipo;
  label: string;
  icon: typeof Camera;
  vehiculoId?: string;
  existingUrl?: string | null;
  onExtracted: Props["onExtracted"];
  onDocumentUploaded?: Props["onDocumentUploaded"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(existingUrl ?? null);
  const loaded = Boolean(url);

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
        fd.set("tipo", tipo);
        fd.set("file", prepared);
        const result = await extractPuertoLibreDocumentoAction(fd);
        if (!result.success) {
          setError(result.error);
          return;
        }
        onExtracted(result.fields, result.tipo, prepared);

        if (vehiculoId) {
          const uploadFd = new FormData();
          uploadFd.set("vehiculoId", vehiculoId);
          uploadFd.set("tipo", tipo);
          uploadFd.set("file", prepared);
          const uploaded = await uploadPuertoLibreDocumentoAction(uploadFd);
          if (!uploaded.success) {
            setError(uploaded.error);
            setDoneMsg(
              `${result.filledCount} campo${result.filledCount === 1 ? "" : "s"} leído${result.filledCount === 1 ? "" : "s"}, pero no se pudo guardar el archivo`
            );
            return;
          }
          const nextUrl = uploaded.documentos[tipo]?.url ?? null;
          setUrl(nextUrl);
          onDocumentUploaded?.(uploaded.documentos, tipo);
          setDoneMsg("Documento guardado en el expediente");
        } else {
          setUrl("pending");
          setDoneMsg(
            `${result.filledCount} campo${result.filledCount === 1 ? "" : "s"} rellenado${result.filledCount === 1 ? "" : "s"}. Se adjuntará al registrar`
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo leer el documento");
      }
    });
  }

  return (
    <div
      className={`rounded-xl border border-dashed p-3.5 ${
        loaded
          ? "border-emerald-700/50 bg-emerald-950/20"
          : "border-slate-700 bg-slate-900/50"
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-slate-100">
            <Icon className="h-4 w-4 shrink-0 text-cyan-400" />
            {label}
            {loaded ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                Cargado
              </span>
            ) : null}
          </p>
          {url && url !== "pending" ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-cyan-400 hover:text-cyan-300"
            >
              Ver archivo cargado
            </a>
          ) : null}
          {doneMsg ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {doneMsg}
            </p>
          ) : null}
          {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-950/50 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : loaded ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {pending ? "Procesando…" : loaded ? "Sustituir" : "Foto o PDF"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Escaneo OCR de factura/BL; persiste en vehiculos.documentos cuando hay vehiculoId. */
export function PuertoLibreDocScan({
  vehiculoId,
  existingUrls,
  onExtracted,
  onDocumentUploaded,
}: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-100">
        Autorellenar con documentos
      </h2>
      <div className="grid gap-3">
        <ScanButton
          tipo="factura_comercial"
          label="Factura comercial"
          icon={FileText}
          vehiculoId={vehiculoId}
          existingUrl={existingUrls?.factura_comercial}
          onExtracted={onExtracted}
          onDocumentUploaded={onDocumentUploaded}
        />
        <ScanButton
          tipo="bl_guia"
          label="BL / Guía"
          icon={Ship}
          vehiculoId={vehiculoId}
          existingUrl={existingUrls?.bl_guia}
          onExtracted={onExtracted}
          onDocumentUploaded={onDocumentUploaded}
        />
      </div>
    </section>
  );
}
