"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileUp,
  Loader2,
  XCircle,
} from "lucide-react";
import { verifyPuertoLibreImprontaAction } from "@/app/actions/nfc/importacion-impronta";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-vehiculo";
import { FotoDanoAnnotator } from "@/components/nfc/FotoDanoAnnotator";
import {
  DOCUMENTO_LABELS,
  type DocumentoTipo,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import { isDocumentoLote } from "@/lib/importacion/expediente-lote";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";

type AcceptMode = "pdf" | "both";

export type ImprontaVerifyUi = {
  estado: "coincide" | "no_coincide" | "no_leido";
  expected: string;
  leido: string | null;
  message: string;
};

type Props = {
  vehiculoId: string;
  tipo: DocumentoTipo;
  existingUrl?: string | null;
  onUploaded?: (
    documentos: VehiculosDocumentos,
    meta?: { loteCopiados?: number }
  ) => void;
  /** Texto auxiliar bajo el título (fotos vs documentos). */
  hint?: string;
  /** Etiqueta del botón cuando no hay archivo. */
  actionLabel?: string;
  /** pdf = solo PDF (manual); both = foto/escaneo o PDF. */
  acceptMode?: AcceptMode;
  /** Tema visual: dark (ficha/planilla digital) o light (hoja imprimible). */
  tone?: "dark" | "light";
  /**
   * Si true, al elegir una imagen abre el editor para marcar daños
   * (círculo / lápiz) antes de subir.
   */
  annotateBeforeUpload?: boolean;
  /**
   * Si true (foto_impronta), verifica con OCR que el serial coincida
   * con el del expediente antes/durante la subida.
   */
  verifySerialAgainstExpediente?: boolean;
  /** Estado inicial de verificación (desde importacion). */
  initialImprontaVerify?: ImprontaVerifyUi | null;
  onImprontaVerified?: (result: ImprontaVerifyUi) => void;
};

const ACCEPT_BOTH =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf";
const ACCEPT_PDF = "application/pdf,.pdf";

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

export function ImportDocumentoUpload({
  vehiculoId,
  tipo,
  existingUrl,
  onUploaded,
  hint,
  actionLabel,
  acceptMode = "both",
  tone = "dark",
  annotateBeforeUpload = false,
  verifySerialAgainstExpediente = false,
  initialImprontaVerify = null,
  onImprontaVerified,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(Boolean(existingUrl));
  const [url, setUrl] = useState<string | null>(existingUrl ?? null);
  const [annotateUrl, setAnnotateUrl] = useState<string | null>(null);
  const [annotateName, setAnnotateName] = useState("foto.jpg");
  const [impronta, setImpronta] = useState<ImprontaVerifyUi | null>(
    initialImprontaVerify
  );
  const light = tone === "light";
  const pdfOnly = acceptMode === "pdf";
  const shouldVerify = verifySerialAgainstExpediente && tipo === "foto_impronta";

  const resolvedHint =
    hint ??
    (pdfOnly
      ? "Solo PDF · máx. 10 MB"
      : shouldVerify
        ? "Foto de la impronta: se verifica que coincida con el serial del expediente"
        : annotateBeforeUpload
          ? "Toma la foto, marca daños (círculo/lápiz) y guarda · máx. 10 MB"
          : "Escanea foto (se convierte a PDF) o sube un PDF · máx. 10 MB");
  const shownHint = isDocumentoLote(tipo)
    ? `${resolvedHint} Se copia a todos los expedientes del mismo BL.`
    : resolvedHint;
  const resolvedLabel =
    actionLabel ?? (pdfOnly ? "Subir PDF" : "Escanear / PDF");

  useEffect(() => {
    setUrl(existingUrl ?? null);
    setDone(Boolean(existingUrl));
  }, [existingUrl]);

  useEffect(() => {
    setImpronta(initialImprontaVerify);
  }, [initialImprontaVerify]);

  useEffect(() => {
    return () => {
      if (annotateUrl) URL.revokeObjectURL(annotateUrl);
    };
  }, [annotateUrl]);

  function uploadAndMaybeVerify(file: File) {
    setError(null);
    startTransition(async () => {
      try {
        const normalized =
          file.type === "application/pdf"
            ? file
            : await normalizeImageFileForUpload(file);

        let verifyUi: ImprontaVerifyUi | null = null;
        if (shouldVerify && normalized.type !== "application/pdf") {
          const vfd = new FormData();
          vfd.set("vehiculoId", vehiculoId);
          vfd.set("file", normalized);
          const verified = await verifyPuertoLibreImprontaAction(vfd);
          if (!verified.success) {
            setError(verified.error);
            return;
          }
          verifyUi = {
            estado: verified.estado,
            expected: verified.expected,
            leido: verified.leido,
            message: verified.message,
          };
          setImpronta(verifyUi);
          onImprontaVerified?.(verifyUi);
          if (verified.estado === "no_coincide") {
            setError(verified.message);
            // Aún subimos la foto para dejar evidencia, pero el estado queda fallido.
          }
        }

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
        const nextUrl = result.documentos[tipo]?.url ?? null;
        setUrl(nextUrl);
        onUploaded?.(result.documentos, {
          loteCopiados: result.loteCopiados,
        });
        if (verifyUi?.estado === "coincide") {
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al subir el archivo");
      }
    });
  }

  function closeAnnotator() {
    if (annotateUrl) URL.revokeObjectURL(annotateUrl);
    setAnnotateUrl(null);
  }

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);

    if (pdfOnly && file.type !== "application/pdf") {
      setError("El manual del vehículo debe ser un archivo PDF.");
      return;
    }

    if (annotateBeforeUpload && isImageFile(file) && file.type !== "application/pdf") {
      if (annotateUrl) URL.revokeObjectURL(annotateUrl);
      const objectUrl = URL.createObjectURL(file);
      setAnnotateName(file.name || "foto.jpg");
      setAnnotateUrl(objectUrl);
      return;
    }

    uploadAndMaybeVerify(file);
  }

  return (
    <>
      <div
        className={`rounded-xl border border-dashed p-3 sm:p-4 ${
          light
            ? "border-zinc-300 bg-zinc-50 print:border-zinc-400 print:bg-white"
            : "border-slate-700 bg-slate-950/50"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p
              className={`flex flex-wrap items-center gap-2 text-sm font-medium ${light ? "text-zinc-800" : "text-slate-200"}`}
            >
              {DOCUMENTO_LABELS[tipo]}
              {done ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    light
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-emerald-900/40 text-emerald-300"
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Cargado
                </span>
              ) : null}
              {shouldVerify ? (
                <span className="text-xs font-normal text-cyan-400/80">
                  · verificación de serial
                </span>
              ) : null}
            </p>
            {url || done ? (
              <a
                href={url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className={`mt-0.5 inline-block truncate text-xs ${
                  light
                    ? "text-cyan-700 hover:text-cyan-800"
                    : "text-cyan-400 hover:text-cyan-300"
                }`}
              >
                {url ? "Ver archivo cargado" : "Archivo guardado en el perfil del vehículo"}
              </a>
            ) : shownHint.trim() ? (
              <p className={`mt-0.5 text-xs ${light ? "text-zinc-500" : "text-slate-500"}`}>
                {shownHint}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 print:hidden ${
              light
                ? "border border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-500"
                : "border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
            }`}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done ? (
              <CheckCircle2 className={`h-4 w-4 ${light ? "text-white" : "text-emerald-400"}`} />
            ) : pdfOnly || light ? (
              <FileUp className="h-4 w-4" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {pending
              ? shouldVerify
                ? "Verificando…"
                : "Subiendo…"
              : done
                ? "Sustituir"
                : resolvedLabel}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={pdfOnly ? ACCEPT_PDF : ACCEPT_BOTH}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        {impronta ? <ImprontaStatusBanner result={impronta} light={light} /> : null}
        {error ? (
          <p className={`mt-2 text-xs ${light ? "text-red-600" : "text-red-300"}`}>{error}</p>
        ) : null}
      </div>

      {annotateUrl ? (
        <FotoDanoAnnotator
          imageUrl={annotateUrl}
          fileName={annotateName}
          onCancel={closeAnnotator}
          onConfirm={(file) => {
            closeAnnotator();
            uploadAndMaybeVerify(file);
          }}
        />
      ) : null}
    </>
  );
}

function ImprontaStatusBanner({
  result,
  light,
}: {
  result: ImprontaVerifyUi;
  light: boolean;
}) {
  if (result.estado === "coincide") {
    return (
      <p
        className={`mt-2 flex items-start gap-1.5 text-xs ${
          light ? "text-emerald-700" : "text-emerald-300"
        }`}
      >
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {result.message}
      </p>
    );
  }
  if (result.estado === "no_coincide") {
    return (
      <p
        className={`mt-2 flex items-start gap-1.5 text-xs ${
          light ? "text-red-700" : "text-red-300"
        }`}
      >
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {result.message}
      </p>
    );
  }
  return (
    <p
      className={`mt-2 flex items-start gap-1.5 text-xs ${
        light ? "text-amber-700" : "text-amber-200"
      }`}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {result.message}
    </p>
  );
}
