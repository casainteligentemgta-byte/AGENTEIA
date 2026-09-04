"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { ClipboardCheck, FileUp } from "lucide-react";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { LlegadaRevisionSections } from "@/components/nfc/LlegadaRevisionSections";
import { isLlegadaChecklistCompleto } from "@/lib/importacion/llegada-catalog";
import {
  DOCUMENTO_LABELS,
  MEMORIA_FOTOGRAFICA_TIPOS,
  MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS,
  constanciaInspeccionLista,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

type RevisionProps = Omit<
  ComponentProps<typeof LlegadaRevisionSections>,
  "vehiculoId" | "docs" | "setDocs" | "onUploadedMessage"
>;

type Props = {
  vehiculoId?: string;
  pagado: boolean;
  docs?: VehiculosDocumentos;
  setDocs?: (next: VehiculosDocumentos) => void;
  canEdit?: boolean;
  onUploadedMessage?: (msg: string) => void;
  revision?: RevisionProps | null;
  checklistCompleto?: boolean;
};

export function PostPagoInspeccionCard({
  vehiculoId,
  pagado,
  docs,
  setDocs,
  canEdit = Boolean(vehiculoId),
  onUploadedMessage,
  revision,
  checklistCompleto,
}: Props) {
  const [localDocs, setLocalDocs] = useState<VehiculosDocumentos>(docs ?? {});

  useEffect(() => {
    if (docs) setLocalDocs(docs);
  }, [docs]);

  if (!pagado) {
    return (
      <p className="text-xs text-slate-500">
        Tras el pago, el puerto emite la constancia de inspección. Después sigue
        la inspección fotográfica y el cuestionario de revisión.
      </p>
    );
  }

  const loaded = constanciaInspeccionLista(localDocs);
  const fotosListas =
    MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS.filter((t) => localDocs[t]?.url)
      .length === MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS.length;
  const fotosCount = MEMORIA_FOTOGRAFICA_TIPOS.filter((t) =>
    Boolean(localDocs[t]?.url)
  ).length;
  const revisionOk =
    checklistCompleto ??
    (revision ? isLlegadaChecklistCompleto(revision.checklist) : false);

  function applyDocs(next: VehiculosDocumentos) {
    setLocalDocs(next);
    setDocs?.(next);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-900/40 bg-sky-950/10 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <ClipboardCheck className="h-5 w-5 text-sky-400" />
          Constancia de inspección
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-normal ${
              loaded
                ? "bg-emerald-950/70 text-emerald-300"
                : "bg-amber-950/70 text-amber-200"
            }`}
          >
            {loaded ? "Lista" : "PDF pendiente"}
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          La emite el puerto después del pago. Autoriza continuar a la
          inspección fotográfica y al cuestionario de revisión.
        </p>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-100">
              <FileUp className="h-4 w-4 text-sky-400" />
              {DOCUMENTO_LABELS.constancia_inspeccion}
            </p>
          </div>
          <p className="mb-3 text-xs text-slate-500">Solo PDF · máx. 10 MB</p>
          {loaded && localDocs.constancia_inspeccion?.url ? (
            <a
              href={localDocs.constancia_inspeccion.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 inline-flex text-xs text-cyan-400 hover:underline"
            >
              Ver PDF
            </a>
          ) : null}
          {canEdit && vehiculoId ? (
            <ImportDocumentoUpload
              vehiculoId={vehiculoId}
              tipo="constancia_inspeccion"
              existingUrl={localDocs.constancia_inspeccion?.url}
              acceptMode="pdf"
              hint="PDF · máx. 10 MB"
              actionLabel={loaded ? "Reemplazar PDF" : "Cargar PDF"}
              onUploaded={(next) => {
                applyDocs(next);
                onUploadedMessage?.(
                  `${DOCUMENTO_LABELS.constancia_inspeccion} cargada`
                );
              }}
            />
          ) : null}
        </div>
      </section>

      {loaded && revision && vehiculoId ? (
        <LlegadaRevisionSections
          vehiculoId={vehiculoId}
          docs={localDocs}
          setDocs={applyDocs}
          onUploadedMessage={onUploadedMessage ?? (() => undefined)}
          {...revision}
          fotosCount={revision.fotosCount || fotosCount}
        />
      ) : loaded ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-100">
            Siguiente: inspección fotográfica y cuestionario
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            La memoria descriptiva y el cuestionario de revisión ya están en
            Llegada.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            <li>
              Fotos: {fotosListas ? "Listas" : "Pendientes"} ({fotosCount}/
              {MEMORIA_FOTOGRAFICA_TIPOS.length})
            </li>
            <li>Cuestionario: {revisionOk ? "Completo" : "Pendiente"}</li>
          </ul>
        </section>
      ) : (
        <p className="text-xs text-slate-500">
          Carga la constancia para continuar con la inspección fotográfica y el
          cuestionario.
        </p>
      )}
    </div>
  );
}
