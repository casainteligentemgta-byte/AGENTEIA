"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, FileText, Loader2, Ship } from "lucide-react";
import { extractPuertoLibreDocumentoAction } from "@/app/actions/nfc/puerto-libre-extract";
import type { PuertoLibreRegistroScanFields } from "@/lib/extract-puerto-libre-docs";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf";

type ScanTipo = "factura_comercial" | "bl_guia";

type Props = {
  onExtracted: (fields: PuertoLibreRegistroScanFields, tipo: ScanTipo) => void;
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
  onExtracted,
}: {
  tipo: ScanTipo;
  label: string;
  icon: typeof Camera;
  onExtracted: Props["onExtracted"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

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
        onExtracted(result.fields, result.tipo);
        setDoneMsg(`${result.filledCount} campo${result.filledCount === 1 ? "" : "s"} rellenado${result.filledCount === 1 ? "" : "s"}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo leer el documento");
      }
    });
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-3.5">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-slate-100">
            <Icon className="h-4 w-4 shrink-0 text-cyan-400" />
            {label}
          </p>
          {doneMsg ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {doneMsg}. Revisa y corrige si hace falta.
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
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {pending ? "Leyendo…" : "Foto o PDF"}
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

/** Escaneo OCR de factura comercial y BL para autollenar el registro PL. */
export function PuertoLibreDocScan({ onExtracted }: Props) {
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
          onExtracted={onExtracted}
        />
        <ScanButton
          tipo="bl_guia"
          label="BL / Guía"
          icon={Ship}
          onExtracted={onExtracted}
        />
      </div>
    </section>
  );
}
