"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, FileUp, Stamp } from "lucide-react";
import type { PuertoLibreFicha } from "@/app/actions/nfc/importacion-vehiculo";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { PuertoLibreDescargarDesaduanamientoPdf } from "@/components/nfc/PuertoLibreDescargarDesaduanamientoPdf";
import { SeniatRechazoPanel } from "@/components/nfc/SeniatRechazoPanel";
import { AlertaBanner } from "@/components/nfc/AlertaDiasNacionalizacion";
import { clasificarTipoImportadorPorRif } from "@/lib/importacion/cumplimiento-importador";
import { docsDesaduanamientoPorRegimen } from "@/lib/importacion/regimenes";
import { buildAlertaPresentacionSeniat } from "@/lib/importacion/alerta-presentacion-seniat";
import { placaRealVisible } from "@/lib/importacion/expediente";
import {
  DOCUMENTO_LABELS,
  PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
  PL_PRESENTACION_SENIAT_ENTREGA_TIPOS,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

type Props = {
  ficha: PuertoLibreFicha;
  canMutate?: boolean;
};

/** Documentos para presentar el vehículo ante el SENIAT + actas/calcomanías. */
export function PresentacionSeniatClient({ ficha, canMutate = true }: Props) {
  const [docs, setDocs] = useState<VehiculosDocumentos>(ficha.documentos);
  const [message, setMessage] = useState<string | null>(null);
  const imp = ficha.importacion;
  const seniat = buildAlertaPresentacionSeniat(imp);
  const placa = placaRealVisible(ficha.placa, ficha.codigoExpediente);
  const esJuridica =
    clasificarTipoImportadorPorRif(imp.importadorDocumento) === "juridica";

  const presentarTipos = useMemo(
    () =>
      docsDesaduanamientoPorRegimen(
        imp.regimen,
        PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
        { esJuridica }
      ),
    [imp.regimen, esJuridica]
  );
  const presentarListos = presentarTipos.filter((t) => Boolean(docs[t]?.url))
    .length;
  const entregaListos = PL_PRESENTACION_SENIAT_ENTREGA_TIPOS.filter((t) =>
    Boolean(docs[t]?.url)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/smartimport/${ficha.id}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Expediente
          </Link>
          <p className="font-mono text-sm tracking-wide text-cyan-400">
            {ficha.codigoExpediente ?? "—"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            Presentación SENIAT
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {[ficha.marca, ficha.modelo].filter(Boolean).join(" ") || "Vehículo"}
            {placa ? ` · Placa ${placa}` : ""}
          </p>
        </div>
        <Stamp className="h-6 w-6 shrink-0 text-cyan-400" />
      </div>

      {seniat ? <AlertaBanner alerta={seniat} /> : null}

      {message ? (
        <p className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Documentos para presentar
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {presentarListos}/{presentarTipos.length}
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Carpeta que se lleva a la cita SENIAT. Lo que ya está en Registro,
          Embarque o Desaduanamiento sale precargado.
        </p>
        <div className="mt-4">
          <PuertoLibreDescargarDesaduanamientoPdf vehiculoId={ficha.id} />
        </div>
        <ul className="mt-5 space-y-3">
          {presentarTipos.map((tipo) => (
            <li key={tipo}>
              <ImportDocumentoUpload
                vehiculoId={ficha.id}
                tipo={tipo}
                existingUrl={docs[tipo]?.url}
                acceptMode="both"
                hint={
                  docs[tipo]?.url
                    ? "En expediente · puedes reemplazar"
                    : "Foto o PDF · máx. 10 MB"
                }
                actionLabel={docs[tipo]?.url ? "Reemplazar" : "Cargar"}
                onUploaded={(next) => {
                  setDocs(next);
                  setMessage(`${DOCUMENTO_LABELS[tipo]} guardado`);
                }}
              />
            </li>
          ))}
        </ul>
        <Link
          href={`/smartimport/${ficha.id}/planilla?fase=4`}
          className="mt-4 inline-flex text-sm text-cyan-400 hover:underline"
        >
          Abrir Desaduanamiento en la planilla
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-100">
          Actas y calcomanías
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {entregaListos}/{PL_PRESENTACION_SENIAT_ENTREGA_TIPOS.length}
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Carga el acta o la calcomanía que entregue SENIAT al presentar el
          vehículo.
        </p>
        <ul className="mt-5 space-y-3">
          {PL_PRESENTACION_SENIAT_ENTREGA_TIPOS.map((tipo) => (
            <li key={tipo}>
              <ImportDocumentoUpload
                vehiculoId={ficha.id}
                tipo={tipo}
                existingUrl={docs[tipo]?.url}
                acceptMode="both"
                hint="Foto o PDF · máx. 10 MB"
                actionLabel={docs[tipo]?.url ? "Reemplazar" : "Cargar"}
                onUploaded={(next) => {
                  setDocs(next);
                  setMessage(`${DOCUMENTO_LABELS[tipo]} guardada`);
                }}
              />
            </li>
          ))}
        </ul>
      </section>

      <SeniatRechazoPanel
        vehiculoId={ficha.id}
        importacion={imp}
        canMutate={canMutate}
      />
    </div>
  );
}
