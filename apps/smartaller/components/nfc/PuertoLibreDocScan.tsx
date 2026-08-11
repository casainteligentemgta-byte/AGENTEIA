"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
} from "lucide-react";
import { extractPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-extract";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-vehiculo";
import type { PuertoLibreRegistroScanFields } from "@/lib/extract-puerto-libre-docs";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";
import type { VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";
import { PL_CARGA_MASIVA_SEED_KEY } from "@/lib/importacion/carga-masiva-seed";

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf";

/** Documentos de Registro (fase 1): OCR en factura y certificado de origen. */
export type PuertoLibreScanTipo =
  | "factura_comercial"
  | "certificado_origen";

const OCR_TIPOS = new Set<PuertoLibreScanTipo>([
  "factura_comercial",
  "certificado_origen",
]);

type Props = {
  /** Si hay vehículo, el archivo se guarda en vehiculos.documentos. */
  vehiculoId?: string;
  /** URLs ya persistidas para mostrar estado cargado. */
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
  ocr,
}: {
  tipo: PuertoLibreScanTipo;
  label: string;
  icon: typeof Camera;
  vehiculoId?: string;
  existingUrl?: string | null;
  onExtracted: Props["onExtracted"];
  onDocumentUploaded?: Props["onDocumentUploaded"];
  ocr: boolean;
}) {
  const router = useRouter();
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
        let filledCount = 0;

        if (ocr) {
          const fd = new FormData();
          fd.set("tipo", tipo);
          fd.set("file", prepared);
          const result = await extractPuertoLibreDocumentoAction(fd);
          if (!result.success) {
            setError(result.error);
            return;
          }

          if (
            result.tipo === "factura_comercial" &&
            result.multi === true &&
            result.rows.length > 1
          ) {
            try {
              sessionStorage.setItem(
                PL_CARGA_MASIVA_SEED_KEY,
                JSON.stringify({
                  rows: result.rows,
                  message: `Se detectaron ${result.vehicleCount} vehículos en la hoja anexa / factura. Revisa la tabla y registra un expediente por unidad.`,
                })
              );
            } catch {
              setError(
                `Se detectaron ${result.vehicleCount} vehículos. Abre Carga masiva y sube de nuevo la hoja anexa.`
              );
              return;
            }
            setDoneMsg(
              `${result.vehicleCount} vehículos detectados → carga masiva`
            );
            router.push("/importacion/carga-masiva?seed=1");
            return;
          }

          filledCount = result.filledCount;
          onExtracted(result.fields, tipo, prepared);
        } else {
          onExtracted({}, tipo, prepared);
        }

        if (vehiculoId) {
          const uploadFd = new FormData();
          uploadFd.set("vehiculoId", vehiculoId);
          uploadFd.set("tipo", tipo);
          uploadFd.set("file", prepared);
          const uploaded = await uploadPuertoLibreDocumentoAction(uploadFd);
          if (!uploaded.success) {
            setError(uploaded.error);
            setDoneMsg(
              ocr
                ? `${filledCount} campo${filledCount === 1 ? "" : "s"} leído${filledCount === 1 ? "" : "s"}, pero no se pudo guardar el archivo`
                : "No se pudo guardar el archivo"
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
            ocr
              ? `${filledCount} campo${filledCount === 1 ? "" : "s"} rellenado${filledCount === 1 ? "" : "s"}. Se adjuntará al registrar`
              : "Se adjuntará al registrar"
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
            <span className="truncate">{label}</span>
          </p>
          {loaded ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Cargado
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {ocr ? "Foto o PDF · la IA rellena campos" : "Foto o PDF"}
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            handleFile(f);
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Leyendo…
            </>
          ) : loaded ? (
            "Sustituir"
          ) : (
            "Foto o PDF"
          )}
        </button>
      </div>
      {doneMsg ? (
        <p className="mt-2 text-xs text-emerald-300/90">{doneMsg}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

export function PuertoLibreDocScan({
  vehiculoId,
  existingUrls,
  onExtracted,
  onDocumentUploaded,
}: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <ClipboardList className="h-4 w-4 text-cyan-400" />
          Autorellenar con documentos
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Factura de compra y certificado de origen. Si la factura es una{" "}
          <span className="text-slate-300">hoja anexa con varios VIN</span>, te
          llevamos a carga masiva (un expediente por vehículo).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ScanButton
          tipo="factura_comercial"
          label="Factura de compra"
          icon={FileText}
          vehiculoId={vehiculoId}
          existingUrl={existingUrls?.factura_comercial}
          onExtracted={onExtracted}
          onDocumentUploaded={onDocumentUploaded}
          ocr={OCR_TIPOS.has("factura_comercial")}
        />
        <ScanButton
          tipo="certificado_origen"
          label="Certificado de origen"
          icon={Camera}
          vehiculoId={vehiculoId}
          existingUrl={existingUrls?.certificado_origen}
          onExtracted={onExtracted}
          onDocumentUploaded={onDocumentUploaded}
          ocr={OCR_TIPOS.has("certificado_origen")}
        />
      </div>
    </section>
  );
}
