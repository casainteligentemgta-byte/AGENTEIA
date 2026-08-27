"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, ImageIcon } from "lucide-react";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import {
  DOCUMENTO_LABELS,
  MEMORIA_FOTOGRAFICA_TIPOS,
  type DocumentoTipo,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

type Props = {
  vehiculoId: string;
  initialDocs: VehiculosDocumentos;
  docTipos: DocumentoTipo[];
  canMutate?: boolean;
};

function DocLinkRow({
  tipo,
  url,
}: {
  tipo: DocumentoTipo;
  url: string;
}) {
  const label = DOCUMENTO_LABELS[tipo];
  const isImage =
    /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) || tipo.startsWith("foto_");
  return (
    <li>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5 transition hover:border-cyan-700/50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 text-zinc-500">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
          {label}
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 text-cyan-400" />
      </a>
    </li>
  );
}

function DocMissingReadOnly({ tipo }: { tipo: DocumentoTipo }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5">
      <span className="text-sm text-zinc-400">{DOCUMENTO_LABELS[tipo]}</span>
      <span className="text-xs text-zinc-600">Sin cargar</span>
    </li>
  );
}

export function PuertoLibreExpedienteDocsSection({
  vehiculoId,
  initialDocs,
  docTipos,
  canMutate = false,
}: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState(initialDocs);

  useEffect(() => {
    setDocs(initialDocs);
  }, [initialDocs]);

  const docsCargados = docTipos.filter((t) => Boolean(docs[t]?.url));
  const fotosCargadas = MEMORIA_FOTOGRAFICA_TIPOS.filter((t) =>
    Boolean(docs[t]?.url)
  );

  function handleUploaded(next: VehiculosDocumentos) {
    setDocs(next);
    router.refresh();
  }

  return (
    <>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-200">Documentos</h2>
          <span className="text-xs text-zinc-500">
            {docsCargados.length}/{docTipos.length} cargados
          </span>
        </div>
        {canMutate ? (
          <p className="mt-1 text-xs text-zinc-500">
            Puedes cargar aquí los que falten o sustituir los ya subidos.
          </p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {docTipos.map((tipo) => {
            const url = docs[tipo]?.url;
            if (url && !canMutate) {
              return <DocLinkRow key={tipo} tipo={tipo} url={url} />;
            }
            if (!url && !canMutate) {
              return <DocMissingReadOnly key={tipo} tipo={tipo} />;
            }
            return (
              <li key={tipo}>
                <ImportDocumentoUpload
                  vehiculoId={vehiculoId}
                  tipo={tipo}
                  existingUrl={url}
                  acceptMode={tipo === "manual_vehiculo" ? "pdf" : "both"}
                  actionLabel={
                    url
                      ? "Sustituir"
                      : tipo === "manual_vehiculo"
                        ? "Subir PDF"
                        : "Cargar"
                  }
                  hint={url ? "" : "Foto o PDF · máx. 10 MB"}
                  onUploaded={handleUploaded}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <ImageIcon className="h-4 w-4 text-cyan-400" />
            Memoria descriptiva
          </h2>
          <span className="text-xs text-zinc-500">
            {fotosCargadas.length}/{MEMORIA_FOTOGRAFICA_TIPOS.length}
          </span>
        </div>
        {canMutate ? (
          <p className="mt-1 text-xs text-zinc-500">
            Sube las fotos que falten directamente desde el expediente.
          </p>
        ) : null}
        {canMutate ? (
          <div className="mt-3 grid gap-3">
            {MEMORIA_FOTOGRAFICA_TIPOS.map((tipo) => (
              <ImportDocumentoUpload
                key={tipo}
                vehiculoId={vehiculoId}
                tipo={tipo}
                existingUrl={docs[tipo]?.url}
                actionLabel={docs[tipo]?.url ? "Sustituir" : "Tomar / subir foto"}
                hint={
                  docs[tipo]?.url
                    ? ""
                    : tipo === "foto_impronta"
                      ? "Opcional · máx. 10 MB"
                      : "Foto · máx. 10 MB"
                }
                annotateBeforeUpload
                onUploaded={handleUploaded}
              />
            ))}
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MEMORIA_FOTOGRAFICA_TIPOS.map((tipo) => {
              const url = docs[tipo]?.url;
              return (
                <li key={tipo}>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={DOCUMENTO_LABELS[tipo]}
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <p className="truncate px-2 py-1.5 text-[11px] text-zinc-400">
                        {DOCUMENTO_LABELS[tipo]}
                      </p>
                    </a>
                  ) : (
                    <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 px-2 text-center">
                      <ImageIcon className="h-5 w-5 text-zinc-700" />
                      <p className="mt-1 text-[11px] text-zinc-600">
                        {DOCUMENTO_LABELS[tipo]}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
