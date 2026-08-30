"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Trash2 } from "lucide-react";
import type { CargaMasivaEtapaProgress } from "@/lib/importacion/carga-masiva-etapas";
import { FileDropZone } from "@/components/VehicleImport/FileDropZone";
import { isPdfOrImageFile, VEHICLE_IMPORT_MAX } from "@/lib/validations/vehicle-import";

type Props = {
  factura: File | null;
  certificados: File[];
  extracting: boolean;
  progress: CargaMasivaEtapaProgress | null;
  foundCount: number | null;
  error: string | null;
  onFactura: (file: File | null) => void;
  onCertificados: (files: File[]) => void;
  onProcess: () => void;
  onManual: () => void;
};

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function FileChip({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const image = file.type.startsWith("image/");

  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, image]);

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-3 text-cyan-50">
        <span className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cyan-700/50 bg-cyan-950">
          {image && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex flex-col items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-300">
              <FileText className="h-4 w-4" />
              {isPdf(file) ? "PDF" : "DOC"}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate">{file.name}</span>
          <span className="text-xs text-cyan-200/70">
            {(file.size / 1024).toFixed(0)} KB
          </span>
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg p-1 text-cyan-300/70 hover:bg-cyan-900/60 hover:text-red-300"
        aria-label={`Quitar ${file.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

export function Step1UploadDocuments({
  factura,
  certificados,
  extracting,
  progress,
  foundCount,
  error,
  onFactura,
  onCertificados,
  onProcess,
  onManual,
}: Props) {
  const [localError, setLocalError] = useState<string | null>(null);
  const ready = Boolean(factura) && !extracting;
  const alert = error ?? localError;

  function takeFactura(files: File[]) {
    applyIncoming(files, "factura");
  }

  function takeCertificados(files: File[]) {
    applyIncoming(files, "cert");
  }

  function takeAmbos(files: File[]) {
    applyIncoming(files, "ambos");
  }

  function applyIncoming(files: File[], prefer: "factura" | "cert" | "ambos") {
    const valid = files.filter(isPdfOrImageFile);
    if (valid.length === 0) {
      setLocalError("Usa PDF o una foto nítida");
      return;
    }
    setLocalError(
      valid.length < files.length
        ? "Se omitieron archivos que no son PDF o foto"
        : null
    );
    const split = splitFacturaYCertificados(valid, prefer);
    if (split.factura) onFactura(split.factura);
    if (split.certificados.length > 0) {
      const seen = new Set(
        certificados.map((file) => `${file.name}:${file.size}`)
      );
      const next = [...certificados];
      for (const file of split.certificados) {
        const key = `${file.name}:${file.size}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(file);
      }
      onCertificados(next);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-50">Subir documentos</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Sube la factura y, si la tienes, el certificado de origen. Extraemos
          VIN, marca, modelo, color y motor.
        </p>
      </div>

      <aside className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100/90">
        <p className="font-medium text-cyan-50">Factura + certificado juntos</p>
        <p className="mt-0.5 text-cyan-200/80">
          Puedes elegir varios PDF a la vez. Un PDF puede traer de 1 a{" "}
          {VEHICLE_IMPORT_MAX} VIN. El certificado completa el serial de motor.
        </p>
      </aside>

      {!factura ? (
        <FileDropZone
          multiple
          label="Arrastra o elige factura y certificado"
          hint="Uno o varios PDF / fotos. El primero es la factura si el nombre no dice certificado."
          disabled={extracting}
          onFiles={takeAmbos}
        />
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-300">Factura comercial</h3>
        {factura ? (
          <div className="flex items-center gap-2">
            <ul className="min-w-0 flex-1 space-y-2">
              <FileChip file={factura} onRemove={() => onFactura(null)} />
            </ul>
            <FileDropZone
              compact
              label="Agregar otro"
              disabled={extracting}
              onFiles={takeFactura}
            />
          </div>
        ) : (
          <FileDropZone
            label="Arrastra o elige la factura"
            hint="Un PDF (o foto) con uno o varios vehículos"
            disabled={extracting}
            onFiles={takeFactura}
          />
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-300">Certificados de origen</h3>
        {certificados.length > 0 ? (
          <div className="flex items-start gap-2">
            <ul className="min-w-0 flex-1 space-y-2">
              {certificados.map((file, index) => (
                <FileChip
                  key={`${file.name}-${index}`}
                  file={file}
                  onRemove={() =>
                    onCertificados(certificados.filter((_, i) => i !== index))
                  }
                />
              ))}
            </ul>
            <FileDropZone
              compact
              multiple
              label="Agregar otro"
              disabled={extracting}
              onFiles={takeCertificados}
            />
          </div>
        ) : (
          <FileDropZone
            label="Arrastra o elige certificados"
            hint="Opcional. Completa motor y cruza el VIN. Puedes extraer solo con la factura."
            multiple
            disabled={extracting}
            onFiles={takeCertificados}
          />
        )}
      </section>

      {alert ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200" role="alert">
          {alert}
        </p>
      ) : null}

      {extracting || progress || foundCount != null ? (
        <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
          {extracting ? (
            <p className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Extrayendo… {progress?.hint ?? "leyendo documentos"}
            </p>
          ) : foundCount != null ? (
            <p>✓ {foundCount} vehículo{foundCount === 1 ? "" : "s"} encontrado{foundCount === 1 ? "" : "s"}</p>
          ) : (
            <p>{progress?.hint ?? "Procesando documentos"}</p>
          )}
          {progress ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-cyan-400 transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!ready}
        onClick={onProcess}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        {extracting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Extrayendo…
          </>
        ) : (
          "Procesar y extraer datos"
        )}
      </button>

      <p className="text-center text-sm">
        <button
          type="button"
          onClick={onManual}
          className="text-cyan-400 hover:underline"
        >
          ¿Ingresar manualmente en lugar?
        </button>
      </p>
    </div>
  );
}

function looksLikeCertificado(name: string): boolean {
  return /certificado|origin|coo|origen/i.test(name);
}

function splitFacturaYCertificados(
  files: File[],
  prefer: "factura" | "cert" | "ambos"
): { factura: File | null; certificados: File[] } {
  if (prefer === "cert") {
    return { factura: null, certificados: files };
  }
  if (prefer === "factura" && files.length === 1) {
    return { factura: files[0] ?? null, certificados: [] };
  }
  const certificados: File[] = [];
  const leftover: File[] = [];
  for (const file of files) {
    if (looksLikeCertificado(file.name)) certificados.push(file);
    else leftover.push(file);
  }
  const factura = leftover[0] ?? null;
  if (leftover.length > 1) certificados.push(...leftover.slice(1));
  return { factura, certificados };
}
