"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { cargaMasivaRowFromScanFields } from "@/lib/importacion/carga-masiva-template";
import { normalizeSerialKey } from "@/lib/importacion/carga-masiva-ui";
import { OCR_UI_UNLOCK_MS } from "@/lib/importacion/carga-masiva-client";
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

/** Factura o certificado con varios VIN: revisión masiva inline. */
export type MultiDocDetectedPayload = {
  rows: CargaMasivaRow[];
  message: string;
  docTipo: PuertoLibreScanTipo;
  file?: File;
  extraCertFiles?: File[];
  facturaFile?: File;
  /** Si true, empareja certificados contra las filas (no re-OCR el PDF que ya armó la tabla). */
  mergeCerts?: boolean;
};

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
  /** Factura o certificado multi-VIN: abre revisión masiva inline (sin navegar a otra ruta). */
  onMultiDetected?: (payload: MultiDocDetectedPayload) => void;
  /** VIN / serial ya cargado en el formulario individual. */
  currentVin?: string;
  /** Lista acumulada de certificados (añadir, no sustituir). */
  onCertFilesChange?: (files: File[]) => void;
  /** Abre la planilla de varios vehículos (un expediente por VIN). */
  onOpenVariosVehiculos?: () => void;
};

async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return file;
  }
  return normalizeImageFileForUpload(file);
}

function uniqueSerials(rows: CargaMasivaRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const key = normalizeSerialKey(row.serialCarroceria || row.vin);
    if (key) set.add(key);
  }
  return Array.from(set);
}

function ScanButton({
  tipo,
  label,
  icon: Icon,
  vehiculoId,
  existingUrl,
  onExtracted,
  onDocumentUploaded,
  onMultiDetected,
  ocr,
  currentVin,
  onOpenVariosVehiculos,
}: {
  tipo: PuertoLibreScanTipo;
  label: string;
  icon: typeof Camera;
  vehiculoId?: string;
  existingUrl?: string | null;
  onExtracted: Props["onExtracted"];
  onDocumentUploaded?: Props["onDocumentUploaded"];
  onMultiDetected?: Props["onMultiDetected"];
  ocr: boolean;
  currentVin?: string;
  onOpenVariosVehiculos?: Props["onOpenVariosVehiculos"];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(existingUrl ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const loaded = Boolean(url);

  useEffect(() => {
    setUrl(existingUrl ?? null);
  }, [existingUrl]);

  function openMasivaFallback(rows: CargaMasivaRow[], message: string, file: File) {
    if (onMultiDetected) {
      onMultiDetected({
        rows,
        message,
        docTipo: tipo,
        file,
        facturaFile: tipo === "factura_comercial" ? file : undefined,
      });
      return;
    }
    try {
      sessionStorage.setItem(
        PL_CARGA_MASIVA_SEED_KEY,
        JSON.stringify({ rows, message })
      );
    } catch {
      setError(
        `Se detectaron ${rows.length} vehículos. Abre la planilla de varios vehículos en Nueva importación.`
      );
      return;
    }
    router.push("/smartimport/importaciones/nueva?masiva=1&seed=1");
  }

  function handleFile(file: File | null) {
    if (!file) return;
    const gen = ++runId.current;
    setError(null);
    setDoneMsg(null);
    setWarning(null);
    setPending(true);

    void (async () => {
      const unlockTimer = window.setTimeout(() => {
        if (gen !== runId.current) return;
        setPending(false);
        setWarning(
          "La lectura sigue en segundo plano. El PDF ya queda adjunto: reintenta o abre la planilla de varios vehículos."
        );
      }, OCR_UI_UNLOCK_MS);

      try {
        const prepared = await prepareFile(file);
        if (gen !== runId.current) return;
        onExtracted({}, tipo, prepared);
        setPendingFile(prepared);
        setUrl("pending");
        setDoneMsg("Leyendo datos…");

        let filledCount = 0;

        if (ocr) {
          const fd = new FormData();
          fd.set("tipo", tipo);
          fd.set("file", prepared);
          const result = await extractPuertoLibreDocumentoAction(fd);
          if (gen !== runId.current) return;
          if (!result.success) {
            setWarning(result.error);
            setDoneMsg("Archivo adjunto. Completa a mano o reintenta.");
            return;
          }

          if (
            (result.tipo === "factura_comercial" ||
              result.tipo === "certificado_origen") &&
            result.multi === true &&
            result.rows.length > 1
          ) {
            const docLabel =
              result.tipo === "certificado_origen"
                ? "certificado de origen"
                : "hoja anexa / factura";
            const message = `Se detectaron ${result.vehicleCount} vehículos en el ${docLabel}. Revisa la tabla y registra un expediente por unidad.`;
            setDoneMsg(`${result.vehicleCount} vehículos detectados`);
            setWarning(null);
            openMasivaFallback(result.rows, message, prepared);
            return;
          }

          filledCount = result.filledCount;
          onExtracted(result.fields, tipo, prepared);
          if (result.warning) {
            setWarning(result.warning);
          } else {
            setWarning(null);
          }
        }

        if (vehiculoId) {
          const uploadFd = new FormData();
          uploadFd.set("vehiculoId", vehiculoId);
          uploadFd.set("tipo", tipo);
          uploadFd.set("file", prepared);
          const uploaded = await uploadPuertoLibreDocumentoAction(uploadFd);
          if (gen !== runId.current) return;
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
          setDoneMsg(
            ocr
              ? filledCount > 0
                ? `${filledCount} campo${filledCount === 1 ? "" : "s"} rellenado${filledCount === 1 ? "" : "s"}. Se adjuntará al registrar`
                : "Archivo adjunto. Si no aparecen VIN, abre la planilla de varios vehículos."
              : "Se adjuntará al registrar"
          );
        }
      } catch (err) {
        if (gen !== runId.current) return;
        setWarning(
          err instanceof Error
            ? err.message
            : "No se pudo leer el documento. El archivo queda adjunto."
        );
        setDoneMsg("Archivo adjunto. Reintenta o completa a mano.");
      } finally {
        window.clearTimeout(unlockTimer);
        if (gen === runId.current) setPending(false);
      }
    })();
  }

  const showVariosCta = Boolean(
    onOpenVariosVehiculos || (onMultiDetected && (warning || loaded))
  );

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
          {pending ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Leyendo datos (puede tardar un minuto)…
            </p>
          ) : loaded ? (
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
      {warning ? <p className="mt-2 text-xs text-amber-200">{warning}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {showVariosCta ? (
        <button
          type="button"
          onClick={() => {
            if (onOpenVariosVehiculos) {
              onOpenVariosVehiculos();
              return;
            }
            if (onMultiDetected && pendingFile) {
              onMultiDetected({
                rows: [],
                message:
                  "Planilla de varios vehículos: un expediente por VIN. Completa o extrae de nuevo.",
                docTipo: tipo,
                file: pendingFile,
                facturaFile: tipo === "factura_comercial" ? pendingFile : undefined,
              });
            }
          }}
          className="mt-2 text-xs text-cyan-300 hover:underline"
        >
          {currentVin
            ? "¿El PDF tiene más vehículos? Abrir planilla"
            : "Abrir planilla de varios vehículos"}
        </button>
      ) : null}
    </div>
  );
}

function CertScanPanel({
  vehiculoId,
  existingUrl,
  onExtracted,
  onDocumentUploaded,
  onMultiDetected,
  currentVin,
  onCertFilesChange,
  onOpenVariosVehiculos,
}: {
  vehiculoId?: string;
  existingUrl?: string | null;
  onExtracted: Props["onExtracted"];
  onDocumentUploaded?: Props["onDocumentUploaded"];
  onMultiDetected?: Props["onMultiDetected"];
  currentVin?: string;
  onCertFilesChange?: Props["onCertFilesChange"];
  onOpenVariosVehiculos?: Props["onOpenVariosVehiculos"];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const loaded = files.length > 0 || Boolean(existingUrl);

  function openMasiva(payload: MultiDocDetectedPayload) {
    if (onMultiDetected) {
      onMultiDetected(payload);
      return;
    }
    try {
      sessionStorage.setItem(
        PL_CARGA_MASIVA_SEED_KEY,
        JSON.stringify({ rows: payload.rows, message: payload.message })
      );
    } catch {
      setError(payload.message);
      return;
    }
    router.push("/smartimport/importaciones/nueva?masiva=1&seed=1");
  }

  function handleFiles(list: File[]) {
    if (list.length === 0) return;
    const gen = ++runId.current;
    setError(null);
    setDoneMsg(null);
    setWarning(null);
    setPending(true);

    void (async () => {
      const unlockTimer = window.setTimeout(() => {
        if (gen !== runId.current) return;
        setPending(false);
        setWarning(
          "La lectura sigue en segundo plano. Los PDF ya quedan adjuntos: reintenta o abre la planilla."
        );
      }, OCR_UI_UNLOCK_MS);

      try {
        const prepared: File[] = [];
        for (const file of list) {
          prepared.push(await prepareFile(file));
        }
        if (gen !== runId.current) return;

        setFiles((prev) => {
          const next = [...prev, ...prepared];
          onCertFilesChange?.(next);
          return next;
        });
        if (prepared[0]) {
          onExtracted({}, "certificado_origen", prepared[0]);
        }
        setDoneMsg("Leyendo datos…");

        const collectedRows: CargaMasivaRow[] = [];
        let lastFields: PuertoLibreRegistroScanFields = {};
        let lastFilled = 0;
        let lastWarning: string | null = null;

        for (let i = 0; i < prepared.length; i++) {
          const file = prepared[i]!;
          if (gen !== runId.current) return;
          setDoneMsg(`Leyendo certificado ${i + 1}/${prepared.length}…`);
          const fd = new FormData();
          fd.set("tipo", "certificado_origen");
          fd.set("file", file);
          const result = await extractPuertoLibreDocumentoAction(fd);
          if (gen !== runId.current) return;
          if (!result.success) {
            lastWarning = result.error;
            continue;
          }
          if (result.tipo !== "certificado_origen") continue;
          if (result.multi === true && result.rows.length > 1) {
            collectedRows.push(...result.rows);
            lastFields = result.fields;
            lastFilled = result.filledCount;
          } else {
            collectedRows.push(
              cargaMasivaRowFromScanFields(result.fields, file.name)
            );
            lastFields = result.fields;
            lastFilled = result.filledCount;
          }
          if (result.warning) lastWarning = result.warning;
        }

        const vins = uniqueSerials(collectedRows);
        const formVin = normalizeSerialKey(currentVin ?? "");
        const otherVins = vins.filter((v) => v !== formVin);

        if (vins.length > 1 || (formVin && otherVins.length > 0)) {
          const message = `Se detectaron ${vins.length || otherVins.length} VIN en certificado(s). Un expediente por vehículo.`;
          setDoneMsg(`${vins.length} VIN detectados`);
          setWarning(null);
          openMasiva({
            rows: collectedRows,
            message,
            docTipo: "certificado_origen",
            file: prepared[0],
            extraCertFiles: prepared.slice(1),
          });
          return;
        }

        if (prepared[0]) {
          onExtracted(lastFields, "certificado_origen", prepared[0]);
        }

        if (vehiculoId && prepared[0]) {
          const uploadFd = new FormData();
          uploadFd.set("vehiculoId", vehiculoId);
          uploadFd.set("tipo", "certificado_origen");
          uploadFd.set("file", prepared[prepared.length - 1]!);
          const uploaded = await uploadPuertoLibreDocumentoAction(uploadFd);
          if (gen !== runId.current) return;
          if (!uploaded.success) {
            setError(uploaded.error);
            return;
          }
          onDocumentUploaded?.(uploaded.documentos, "certificado_origen");
        }

        if (lastWarning) setWarning(lastWarning);
        setDoneMsg(
          lastFilled > 0
            ? `${lastFilled} campo${lastFilled === 1 ? "" : "s"} leído${lastFilled === 1 ? "" : "s"}. Puedes añadir más certificados.`
            : prepared.length > 0
              ? "Certificado añadido. Puedes agregar otros o abrir la planilla de varios vehículos."
              : null
        );
      } catch (err) {
        if (gen !== runId.current) return;
        setWarning(
          err instanceof Error
            ? err.message
            : "No se pudo leer el certificado. El archivo queda adjunto."
        );
        setDoneMsg("Certificado adjunto. Reintenta o completa a mano.");
      } finally {
        window.clearTimeout(unlockTimer);
        if (gen === runId.current) setPending(false);
      }
    })();
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onCertFilesChange?.(next);
      return next;
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
            <Camera className="h-4 w-4 shrink-0 text-cyan-400" />
            <span className="truncate">Certificado de origen</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Puedes añadir varios PDF. Se emparejan por VIN (un expediente por vehículo).
          </p>
          {pending ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Leyendo datos (puede tardar un minuto)…
            </p>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            handleFiles(list);
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
          ) : files.length > 0 ? (
            <>
              <Plus className="h-4 w-4" />
              Añadir certificado
            </>
          ) : (
            "Foto o PDF"
          )}
        </button>
        {files.length > 0 ? (
          <ul className="space-y-1">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-2 text-xs text-slate-300"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="rounded-md p-1 text-slate-500 hover:text-red-300"
                  aria-label={`Quitar ${file.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : existingUrl ? (
          <p className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Cargado en el expediente
          </p>
        ) : null}
      </div>
      {doneMsg ? (
        <p className="mt-2 text-xs text-emerald-300/90">{doneMsg}</p>
      ) : null}
      {warning ? <p className="mt-2 text-xs text-amber-200">{warning}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {onOpenVariosVehiculos ? (
        <button
          type="button"
          disabled={pending}
          onClick={onOpenVariosVehiculos}
          className="mt-2 text-xs text-cyan-300 hover:underline"
        >
          Abrir planilla de varios vehículos
        </button>
      ) : null}
    </div>
  );
}

export function PuertoLibreDocScan({
  vehiculoId,
  existingUrls,
  onExtracted,
  onDocumentUploaded,
  onMultiDetected,
  currentVin,
  onCertFilesChange,
  onOpenVariosVehiculos,
}: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
        <ClipboardList className="h-4 w-4 text-cyan-400" />
        Autorellenar con documentos
      </h2>
      <p className="text-xs text-slate-500">
        Un PDF de factura puede traer 1 o N vehículos: cada VIN es un expediente.
        Los certificados se añaden (no se sustituyen) y se emparejan por serial.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ScanButton
          tipo="factura_comercial"
          label="Factura de compra"
          icon={FileText}
          vehiculoId={vehiculoId}
          existingUrl={existingUrls?.factura_comercial}
          onExtracted={onExtracted}
          onDocumentUploaded={onDocumentUploaded}
          onMultiDetected={onMultiDetected}
          ocr={OCR_TIPOS.has("factura_comercial")}
          currentVin={currentVin}
          onOpenVariosVehiculos={onOpenVariosVehiculos}
        />
        <CertScanPanel
          vehiculoId={vehiculoId}
          existingUrl={existingUrls?.certificado_origen}
          onExtracted={onExtracted}
          onDocumentUploaded={onDocumentUploaded}
          onMultiDetected={onMultiDetected}
          currentVin={currentVin}
          onCertFilesChange={onCertFilesChange}
          onOpenVariosVehiculos={onOpenVariosVehiculos}
        />
      </div>
    </section>
  );
}
