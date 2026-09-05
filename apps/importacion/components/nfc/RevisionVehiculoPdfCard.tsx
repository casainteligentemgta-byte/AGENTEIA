"use client";

import { useState, useTransition } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { guardarRevisionVehiculoPdfAction } from "@/app/actions/nfc/importacion-vehiculo";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { DOCUMENTO_LABELS, type VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";

type Props = {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  checklistCompleto: boolean;
  canEdit?: boolean;
  onUploaded?: (next: VehiculosDocumentos) => void;
};

/** Carga o genera el PDF de la inspección que hacen los funcionarios del SENIAT. */
export function RevisionVehiculoPdfCard({
  vehiculoId,
  docs,
  checklistCompleto,
  canEdit = false,
  onUploaded,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localDocs, setLocalDocs] = useState(docs);
  const url = localDocs.revision_vehiculo?.url;

  function guardar() {
    setError(null);
    startTransition(async () => {
      const result = await guardarRevisionVehiculoPdfAction({ vehiculoId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setLocalDocs(result.documentos);
      onUploaded?.(result.documentos);
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-100">
        <FileText className="h-5 w-5 text-cyan-400" />
        {DOCUMENTO_LABELS.revision_vehiculo}
        <span className="rounded-md bg-cyan-950/70 px-2 py-0.5 text-xs font-normal text-cyan-200">
          SENIAT
        </span>
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Carga el PDF de la inspección que realizan los funcionarios del SENIAT.
        La otra inspección (fotos y cuestionario) la hace el personal de la
        aduanera.
      </p>

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:underline"
        >
          <Download className="h-4 w-4" />
          Ver PDF de revisión
        </a>
      ) : null}

      {canEdit ? (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={guardar}
            disabled={pending || !checklistCompleto}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {url ? "Volver a generar PDF" : "Guardar revisión en PDF"}
          </button>
          {!checklistCompleto ? (
            <p className="text-xs text-amber-200">
              Completa el cuestionario (todos los ítems) para generar el PDF.
            </p>
          ) : null}
          <ImportDocumentoUpload
            vehiculoId={vehiculoId}
            tipo="revision_vehiculo"
            existingUrl={url}
            acceptMode="pdf"
            hint="PDF de inspección SENIAT · máx. 10 MB"
            actionLabel={url ? "Reemplazar PDF" : "Cargar PDF"}
            onUploaded={(next) => {
              setLocalDocs(next);
              onUploaded?.(next);
            }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-red-300">{error}</p>
      ) : null}
    </section>
  );
}
