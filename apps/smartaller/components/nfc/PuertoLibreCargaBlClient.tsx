"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileUp, Ship } from "lucide-react";
import {
  assignNumeroBlAction,
  saveCargaBlFechaIngresoAction,
  type CargaBlIndexItem,
  type CargaBlLote,
} from "@/app/actions/nfc/importacion-lote";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";
import {
  DOCUMENTO_TIPOS_CARGA_BL,
  cargaBlPath,
} from "@/lib/importacion/expediente-lote";
import {
  DOCUMENTO_LABELS,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

const DOC_HINT: Partial<Record<(typeof DOCUMENTO_TIPOS_CARGA_BL)[number], string>> = {
  bl_guia: "Un PDF o foto · se anexa a todos los expedientes de este BL",
  lista_empaque: "Lista de empaque de toda la carga",
  poliza_transporte: "Póliza de la carga (transporte), no el seguro del auto",
  acta_recepcion_mercancia: "Acta de recepción de la mercancía",
  constancia_edi_reconocimiento: "Reconocimiento / constancia EDI",
};

export function PuertoLibreCargaBlLoteView({ lote }: { lote: CargaBlLote }) {
  const router = useRouter();
  const [docs, setDocs] = useState<VehiculosDocumentos>(
    lote.documentos as VehiculosDocumentos
  );
  const [fecha, setFecha] = useState(lote.fechaIngreso);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const docsCount = useMemo(
    () => DOCUMENTO_TIPOS_CARGA_BL.filter((tipo) => docs[tipo]?.url).length,
    [docs]
  );

  function saveFecha() {
    setError(null);
    startTransition(async () => {
      const result = await saveCargaBlFechaIngresoAction({
        sourceVehiculoId: lote.sourceVehiculoId,
        fechaIngreso: fecha,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const extra =
        result.loteCopiados > 0
          ? ` · ${result.loteCopiados + 1} expedientes`
          : "";
      setMessage(`Fecha de ingreso guardada en el BL${extra}. La fase se confirma aparte.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href="/smartimport"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Expedientes
        </Link>
        <div>
          <p className="text-xs uppercase tracking-wide text-cyan-400/80">
            Documentos de la carga
          </p>
          <h1 className="mt-1 font-mono text-2xl font-semibold text-slate-50">
            BL {lote.numeroBl}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {lote.unidades.length} expediente
            {lote.unidades.length === 1 ? "" : "s"} · se anexan a todos. Las
            fases se confirman en cada planilla.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Papeles del BL
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {docsCount}/{DOCUMENTO_TIPOS_CARGA_BL.length}
          </span>
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Un archivo por tipo. Póliza = seguro de la carga.
        </p>
        <div className="mt-4 grid gap-3">
          {DOCUMENTO_TIPOS_CARGA_BL.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={lote.sourceVehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              acceptMode="both"
              hint={docs[tipo]?.url ? "" : DOC_HINT[tipo]}
              actionLabel={docs[tipo]?.url ? "Sustituir" : "Cargar"}
              onUploaded={(next, meta) => {
                setDocs(next);
                const copiados = meta?.loteCopiados ?? 0;
                setMessage(
                  copiados > 0
                    ? `${DOCUMENTO_LABELS[tipo]} anexado a ${copiados + 1} expedientes.`
                    : `${DOCUMENTO_LABELS[tipo]} guardado.`
                );
                router.refresh();
              }}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Ship className="h-5 w-5 text-cyan-400" />
          Fecha de ingreso al PL
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Un dato para todo el BL. No avanza la fase de llegada.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <PlanillaFechaField
            label="Fecha de ingreso al PL"
            name="fechaIngreso"
            value={fecha}
            onChange={setFecha}
          />
          <button
            type="button"
            onClick={saveFecha}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar en el BL"}
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-200">
          Expedientes de este BL
        </h2>
        <ul className="mt-3 space-y-1.5 font-mono text-sm">
          {lote.unidades.map((u) => (
            <li key={u.id}>
              <Link
                href={`/smartimport/${u.id}`}
                className="text-cyan-300 hover:text-cyan-200"
              >
                {u.codigoExpediente}
                {u.vin ? ` · ${u.vin}` : ""}
                {u.marca || u.modelo
                  ? ` · ${[u.marca, u.modelo].filter(Boolean).join(" ")}`
                  : ""}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function PuertoLibreCargaBlAssign({
  vehiculoId,
  codigoExpediente,
  vin,
}: {
  vehiculoId: string;
  codigoExpediente: string;
  vin: string | null;
}) {
  const router = useRouter();
  const [numeroBl, setNumeroBl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function assign() {
    setError(null);
    startTransition(async () => {
      const result = await assignNumeroBlAction({
        vehiculoId,
        numeroBl,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.replace(cargaBlPath(result.numeroBl));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/smartimport"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Expedientes
      </Link>
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h1 className="text-xl font-semibold text-slate-50">
          Asignar BL a la carga
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {codigoExpediente}
          {vin ? ` · ${vin}` : ""}. Sin nº de BL no se puede anexar a un grupo.
          Si el BL ya tiene papeles, este expediente los hereda.
        </p>
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm text-slate-400">Nº BL / Guía</span>
          <input
            value={numeroBl}
            onChange={(e) => setNumeroBl(e.target.value.toUpperCase())}
            placeholder="COSU1234567"
            className="box-border w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm uppercase text-slate-100 outline-none focus:border-cyan-500/60"
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-red-300">{error}</p>
        ) : null}
        <button
          type="button"
          onClick={assign}
          disabled={pending || !numeroBl.trim()}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {pending ? "Asignando…" : "Continuar"}
        </button>
      </section>
    </div>
  );
}

export function PuertoLibreCargaBlIndex({ lotes }: { lotes: CargaBlIndexItem[] }) {
  return (
    <div className="space-y-6">
      <Link
        href="/smartimport"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Expedientes
      </Link>
      <header>
        <p className="text-xs uppercase tracking-wide text-cyan-400/80">
          Documentos de la carga
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-50">Por BL</h1>
        <p className="mt-1 text-sm text-slate-400">
          Carga una vez. Se anexa a cada expediente de ese BL.
        </p>
      </header>
      {lotes.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-sm text-slate-400">
          Aún no hay expedientes con nº de BL. Regístralos en Extraer o asigna el
          BL desde Embarque.
        </p>
      ) : (
        <ul className="space-y-2">
          {lotes.map((lote) => (
            <li key={lote.blKey}>
              <Link
                href={cargaBlPath(lote.blKey)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 hover:border-cyan-500/40"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-slate-100">
                    BL {lote.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lote.unidades} expediente{lote.unidades === 1 ? "" : "s"}
                    {lote.fechaIngreso ? ` · ingreso ${lote.fechaIngreso}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  {lote.docsCargados}/{DOCUMENTO_TIPOS_CARGA_BL.length}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
