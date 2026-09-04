"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Banknote, FileUp } from "lucide-react";
import {
  ensureTasaOficialHoyAction,
  registrarPagoArancelesAction,
} from "@/app/actions/nfc/importacion-vehiculo";
import { getTasaOficialHoyAction } from "@/app/actions/nfc/tasa-bcv";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import {
  DOCUMENTO_LABELS,
  PL_PAGO_SENIAT_DOCUMENTO_TIPOS,
  pagoSeniatPdfsListos,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import {
  formatBs,
  formatUsd,
  inputFromImportacion,
  parseMoneyInput,
  precalcularAranceles,
} from "@/lib/importacion/precalculo-aranceles";
import {
  snapshotPagoAranceles,
  sumarPagosBs,
  usdABsOficial,
  type ImportacionPagoFields,
} from "@/lib/importacion/pago-aranceles";

type Props = {
  vehiculoId?: string;
  valorCif?: number | null;
  arancelPct?: number | null;
  impuestoLujoPct?: number | null;
  tasaCambioBcv?: number | null;
  tasaOficialFecha?: string | null;
  pagoArancelesEstado?: string | null;
  pagoArancelesUsd?: number | null;
  pagoArancelesBs?: number | null;
  unidades?: ImportacionPagoFields[];
  docs?: VehiculosDocumentos;
  setDocs?: (next: VehiculosDocumentos) => void;
  canEdit?: boolean;
  onUpdated?: () => void;
  onUploadedMessage?: (msg: string) => void;
};

export function PagoArancelesCard({
  vehiculoId,
  valorCif,
  arancelPct,
  impuestoLujoPct,
  tasaCambioBcv,
  tasaOficialFecha,
  pagoArancelesEstado,
  pagoArancelesUsd,
  pagoArancelesBs,
  unidades,
  docs,
  setDocs,
  canEdit = Boolean(vehiculoId),
  onUpdated,
  onUploadedMessage,
}: Props) {
  const initial = snapshotPagoAranceles({
    valorCif,
    arancelPct,
    impuestoLujoPct,
    tasaCambioBcv,
    tasaOficialFecha,
    pagoArancelesEstado,
    pagoArancelesUsd,
    pagoArancelesBs,
  });
  const [tasa, setTasa] = useState<number | null>(initial.tasaBs);
  const [fecha, setFecha] = useState<string | null>(initial.tasaFecha);
  const [estado, setEstado] = useState(initial.estado);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [localDocs, setLocalDocs] = useState<VehiculosDocumentos>(docs ?? {});

  useEffect(() => {
    if (docs) setLocalDocs(docs);
  }, [docs]);

  const lote = useMemo(
    () => (unidades && unidades.length > 1 ? sumarPagosBs(unidades) : null),
    [unidades]
  );

  const totalUsd = useMemo(() => {
    if (lote) return lote.totalUsd;
    if (initial.totalUsd != null) return initial.totalUsd;
    return (
      precalcularAranceles(
        inputFromImportacion({ valorCif, arancelPct, impuestoLujoPct })
      )?.totalUsd ?? null
    );
  }, [lote, initial.totalUsd, valorCif, arancelPct, impuestoLujoPct]);

  const totalBs =
    estado === "pagado" && initial.totalBs != null
      ? initial.totalBs
      : usdABsOficial(totalUsd, tasa) ?? lote?.totalBs ?? null;

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      if (vehiculoId && estado !== "pagado") {
        const result = await ensureTasaOficialHoyAction({ vehiculoId });
        if (cancelled) return;
        if (!result.success) {
          setError(result.error);
          return;
        }
        setTasa(result.tasa);
        setFecha(result.fecha);
        setEstado(result.estado);
        setHint(result.hint ?? null);
        if (result.fecha !== initial.tasaFecha) onUpdated?.();
        return;
      }
      const hoy = await getTasaOficialHoyAction();
      if (cancelled) return;
      if (!hoy.success) {
        setError(hoy.error);
        return;
      }
      const parsed = parseMoneyInput(hoy.tasa);
      setTasa(parsed);
      setFecha(hoy.fechaVigente);
      setHint(hoy.hint);
    });
    return () => {
      cancelled = true;
    };
    // Solo al montar: la tasa del día.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculoId]);

  function pagar() {
    if (!vehiculoId) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await registrarPagoArancelesAction({ vehiculoId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEstado("pagado");
      setTasa(result.tasa);
      setFecha(result.fecha);
      setMessage(`Pago registrado · ${formatBs(result.totalBs)}`);
      onUpdated?.();
    });
  }

  if (totalUsd == null) return null;

  const pagado = estado === "pagado";

  return (
    <section className="rounded-2xl border border-emerald-900/40 bg-emerald-950/10 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
        <Banknote className="h-5 w-5 text-emerald-400" />
        Pago de aranceles
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-normal ${
            pagado
              ? "bg-emerald-950/70 text-emerald-300"
              : "bg-amber-950/70 text-amber-200"
          }`}
        >
          {pagado ? "Pagado" : "Pendiente · en bolívares"}
        </span>
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        SENIAT cobra en bolívares. El total USD se convierte cada día con la
        tasa oficial BCV (la que usa SENIAT). Si ya pagaste, el monto queda
        congelado.
      </p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Total USD
          </dt>
          <dd className="mt-1 font-mono text-lg text-slate-100">
            {formatUsd(totalUsd)}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Tasa oficial
          </dt>
          <dd className="mt-1 font-mono text-lg text-slate-100">
            {tasa != null ? `${tasa} Bs/USD` : "—"}
          </dd>
          <dd className="mt-0.5 text-xs text-slate-500">
            {fecha ? `Vigente ${fecha}` : pending ? "Consultando…" : "Sin tasa"}
          </dd>
        </div>
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-3 py-3">
          <dt className="text-xs uppercase tracking-wide text-emerald-400/80">
            A pagar hoy
          </dt>
          <dd className="mt-1 font-mono text-xl font-semibold text-emerald-100">
            {formatBs(totalBs)}
          </dd>
        </div>
      </dl>

      {hint ? <p className="mt-3 text-xs text-slate-500">{hint}</p> : null}
      {lote && lote.pendientes > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          {lote.pendientes} expediente{lote.pendientes === 1 ? "" : "s"} del BL
          aún sin pagar.
        </p>
      ) : null}

      {canEdit && vehiculoId && !pagado ? (
        <button
          type="button"
          onClick={pagar}
          disabled={pending || totalBs == null}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {pending ? "Actualizando…" : "Registrar pago en bolívares"}
        </button>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-emerald-300">{message}</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      {pagado && vehiculoId ? (
        <div className="mt-6 border-t border-emerald-900/40 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <FileUp className="h-4 w-4 text-emerald-400" />
            SENIAT emitió — cargar en PDF
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-normal ${
                pagoSeniatPdfsListos(localDocs)
                  ? "bg-emerald-950/70 text-emerald-300"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {PL_PAGO_SENIAT_DOCUMENTO_TIPOS.filter((t) => localDocs[t]?.url).length}
              /{PL_PAGO_SENIAT_DOCUMENTO_TIPOS.length}
            </span>
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Liquidación de tributos (comprobante de pago) y constancia de
            nacionalización, que autoriza retirar el vehículo del puerto.
          </p>
          <ul className="mt-4 space-y-3">
            {PL_PAGO_SENIAT_DOCUMENTO_TIPOS.map((tipo, index) => {
              const loaded = Boolean(localDocs[tipo]?.url);
              return (
                <li
                  key={tipo}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100">
                      {index + 1}. {DOCUMENTO_LABELS[tipo]}
                    </p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        loaded
                          ? "bg-emerald-950/60 text-emerald-300"
                          : "bg-amber-950/60 text-amber-200"
                      }`}
                    >
                      {loaded ? "Listo" : "PDF pendiente"}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-slate-500">
                    {tipo === "constancia_nacionalizacion"
                      ? "Autoriza retirar el vehículo del puerto. Solo PDF."
                      : "Comprobante de pago de tributos. Solo PDF."}
                  </p>
                  {loaded && localDocs[tipo]?.url ? (
                    <a
                      href={localDocs[tipo]!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 inline-flex text-xs text-cyan-400 hover:underline"
                    >
                      Ver PDF
                    </a>
                  ) : null}
                  {canEdit ? (
                    <ImportDocumentoUpload
                      vehiculoId={vehiculoId}
                      tipo={tipo}
                      existingUrl={localDocs[tipo]?.url}
                      acceptMode="pdf"
                      hint="PDF · máx. 10 MB"
                      actionLabel={loaded ? "Reemplazar PDF" : "Cargar PDF"}
                      onUploaded={(next) => {
                        setLocalDocs(next);
                        setDocs?.(next);
                        onUploadedMessage?.(
                          `${DOCUMENTO_LABELS[tipo]} cargado`
                        );
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : !pagado ? (
        <p className="mt-4 text-xs text-slate-500">
          Tras registrar el pago, SENIAT emite la liquidación de tributos y la
          constancia de nacionalización. Cárgalas aquí en PDF.
        </p>
      ) : null}
    </section>
  );
}
