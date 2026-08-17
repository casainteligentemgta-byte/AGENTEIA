"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Flag,
  FileUp,
  Scale,
} from "lucide-react";
import {
  avanzarPasoNacionalizacionAction,
  completarNacionalizacionAction,
  elegirViaNacionalizacionAction,
  type PuertoLibreFicha,
} from "@/app/actions/nfc/importacion-vehiculo";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { AlertaDiasNacionalizacion } from "@/components/nfc/AlertaDiasNacionalizacion";
import {
  DOCUMENTO_LABELS,
  PL_NACIONALIZACION_BASE_TIPOS,
  VIA_NACIONALIZACION_LABELS,
  type ViaNacionalizacion,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import {
  aniosDesdeFecha,
  descripcionVia,
  docsTiposPorVia,
  sugerirViaNacionalizacion,
  viaLabel,
} from "@/lib/importacion/nacionalizacion";
import { placaRealVisible } from "@/lib/importacion/expediente";

type Props = {
  ficha: PuertoLibreFicha;
};

export function PuertoLibreNacionalizarWizard({ ficha }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [docs, setDocs] = useState<VehiculosDocumentos>(ficha.documentos);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imp = ficha.importacion;
  const sugerida = sugerirViaNacionalizacion(imp);
  const [viaDraft, setViaDraft] = useState<ViaNacionalizacion>(
    imp.viaNacionalizacion ?? sugerida
  );

  const via = imp.viaNacionalizacion;
  const paso = imp.nacionalizacionPaso ?? 1;
  const anios = aniosDesdeFecha(imp.fechaIngreso);
  const yaNacionalizado = imp.estadoNacionalizacion === "nacionalizado";
  const placa = placaRealVisible(ficha.placa, ficha.codigoExpediente);

  const tiposVia = useMemo(
    () => (via ? docsTiposPorVia(via) : docsTiposPorVia(viaDraft)),
    [via, viaDraft]
  );
  const docsCount = tiposVia.filter((t) => Boolean(docs[t]?.url)).length;
  const docsCompletos = docsCount === tiposVia.length;

  const uiPaso: 1 | 2 | 3 = yaNacionalizado
    ? 3
    : !via || paso <= 1
      ? 1
      : paso >= 3
        ? 3
        : 2;

  function flash(ok: string | null, err: string | null) {
    setMessage(ok);
    setError(err);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/importacion/${ficha.id}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Expediente
          </Link>
          <p className="font-mono text-sm tracking-wide text-cyan-400">
            {ficha.codigoExpediente ?? "—"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            Nacionalizar
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {[ficha.marca, ficha.modelo].filter(Boolean).join(" ") || "Vehículo"}
            {placa ? ` · Placa ${placa}` : ""}
            {anios != null ? ` · ${anios} año${anios === 1 ? "" : "s"} en PL` : ""}
          </p>
        </div>
        <Flag className="h-6 w-6 shrink-0 text-amber-400" />
      </div>

      <div className="grid w-full grid-cols-3 gap-1.5">
        <PasoChip n={1} label="Vía" current={uiPaso === 1} completo={Boolean(via)} />
        <PasoChip
          n={2}
          label="Documentos"
          current={uiPaso === 2}
          completo={Boolean(via) && docsCompletos}
        />
        <PasoChip
          n={3}
          label="Cierre"
          current={uiPaso === 3}
          completo={yaNacionalizado}
        />
      </div>

      {!yaNacionalizado ? (
        <AlertaDiasNacionalizacion importacion={imp} />
      ) : null}

      {(message || error) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-900/50 bg-red-950/30 text-red-200"
              : "border-emerald-900/40 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          {error ?? message}
        </div>
      )}

      {yaNacionalizado ? (
        <section className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-100">
            <CheckCircle2 className="h-5 w-5" />
            Nacionalización completa
          </h2>
          <p className="mt-2 text-sm text-emerald-200/80">
            Vía: {via ? viaLabel(via) : "—"}. Título de libre circulación cargado.
          </p>
          <Link
            href={`/importacion/${ficha.id}`}
            className="mt-4 inline-flex rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Volver al expediente
          </Link>
        </section>
      ) : uiPaso === 1 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Scale className="h-5 w-5 text-cyan-400" />
            Elige la vía de nacionalización
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Según años en Puerto Libre desde el ingreso
            {imp.fechaIngreso ? ` (${imp.fechaIngreso})` : ""}. Sugerida:{" "}
            <span className="text-cyan-300">{VIA_NACIONALIZACION_LABELS[sugerida]}</span>.
          </p>

          <div className="mt-5 grid gap-3">
            {(Object.keys(VIA_NACIONALIZACION_LABELS) as ViaNacionalizacion[]).map(
              (opcion) => {
                const selected = viaDraft === opcion;
                const esSugerida = opcion === sugerida;
                return (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => setViaDraft(opcion)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      selected
                        ? "border-cyan-500/60 bg-cyan-950/30"
                        : "border-slate-800 bg-slate-900/40 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">
                        {VIA_NACIONALIZACION_LABELS[opcion]}
                      </span>
                      {esSugerida ? (
                        <span className="rounded-md bg-cyan-950/80 px-2 py-0.5 text-[11px] text-cyan-300">
                          Sugerida
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{descripcionVia(opcion)}</p>
                  </button>
                );
              }
            )}
          </div>

          {viaDraft !== sugerida ? (
            <p className="mt-4 flex items-start gap-2 text-xs text-amber-200/90">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Estás eligiendo una vía distinta a la sugerida por antigüedad. Verifica
              con el agente aduanal / SENIAT antes de consignar.
            </p>
          ) : null}

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              flash(null, null);
              startTransition(async () => {
                const result = await elegirViaNacionalizacionAction({
                  vehiculoId: ficha.id,
                  via: viaDraft,
                });
                if (!result.success) {
                  flash(null, result.error);
                  return;
                }
                flash("Vía guardada", null);
                router.refresh();
              });
            }}
            className="mt-6 w-full rounded-xl bg-cyan-600 px-5 py-3.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Guardando…" : "Continuar a documentos"}
          </button>
        </section>
      ) : uiPaso === 2 ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-100">
              Expediente base (PL)
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Recaudos del ingreso a Puerto Libre. Si falta alguno, cárgalo aquí.
            </p>
            <ul className="mt-4 space-y-3">
              {PL_NACIONALIZACION_BASE_TIPOS.map((tipo) => (
                <li key={tipo}>
                  <ImportDocumentoUpload
                    vehiculoId={ficha.id}
                    tipo={tipo}
                    existingUrl={docs[tipo]?.url}
                    acceptMode="both"
                    hint={
                      docs[tipo]?.url
                        ? "Ya en expediente · puedes reemplazar"
                        : "Falta en expediente · foto o PDF"
                    }
                    actionLabel={docs[tipo]?.url ? "Reemplazar" : "Cargar"}
                    onUploaded={(next) => {
                      setDocs(next);
                      flash("Documento guardado", null);
                      router.refresh();
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
              <FileUp className="h-5 w-5 text-cyan-400" />
              Recaudos de nacionalización
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
                {docsCount}/{tiposVia.length}
              </span>
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>Vía: {via ? viaLabel(via) : "—"}. Foto o PDF · máx. 10 MB.</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  flash(null, null);
                  startTransition(async () => {
                    const result = await avanzarPasoNacionalizacionAction({
                      vehiculoId: ficha.id,
                      pasoDestino: 1,
                    });
                    if (!result.success) {
                      flash(null, result.error);
                      return;
                    }
                    router.refresh();
                  });
                }}
                className="text-xs text-cyan-400 hover:underline"
              >
                Cambiar vía
              </button>
            </div>
            <ul className="mt-4 space-y-3">
              {tiposVia.map((tipo) => (
                <li key={tipo}>
                  <ImportDocumentoUpload
                    vehiculoId={ficha.id}
                    tipo={tipo}
                    existingUrl={docs[tipo]?.url}
                    acceptMode="both"
                    hint="Obligatorio · foto o PDF"
                    onUploaded={(next) => {
                      setDocs(next);
                      flash("Documento guardado", null);
                      router.refresh();
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Link
              href={`/importacion/${ficha.id}`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-500"
            >
              Ir a la ficha
            </Link>
            <button
              type="button"
              disabled={pending || !docsCompletos}
              onClick={() => {
                flash(null, null);
                startTransition(async () => {
                  const result = await avanzarPasoNacionalizacionAction({
                    vehiculoId: ficha.id,
                    pasoDestino: 3,
                  });
                  if (!result.success) {
                    flash(null, result.error);
                    return;
                  }
                  flash("Documentos listos", null);
                  router.refresh();
                });
              }}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Revisar y cerrar"}
            </button>
          </div>
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-100">Cierre de nacionalización</h2>
          <p className="mt-1 text-sm text-slate-500">
            Confirma que la resolución SENIAT y el título de libre circulación están
            cargados. Al finalizar, el expediente queda como nacionalizado.
          </p>

          <ul className="mt-5 space-y-2">
            {tiposVia.map((tipo) => {
              const ok = Boolean(docs[tipo]?.url);
              return (
                <li
                  key={tipo}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 px-3 py-2.5"
                >
                  <span className="text-sm text-slate-300">{DOCUMENTO_LABELS[tipo]}</span>
                  <span
                    className={`text-xs font-medium ${
                      ok ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {ok ? "Listo" : "Falta"}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                flash(null, null);
                startTransition(async () => {
                  const result = await avanzarPasoNacionalizacionAction({
                    vehiculoId: ficha.id,
                    pasoDestino: 2,
                  });
                  if (!result.success) {
                    flash(null, result.error);
                    return;
                  }
                  router.refresh();
                });
              }}
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-500"
            >
              Volver a documentos
            </button>
            <button
              type="button"
              disabled={pending || !docsCompletos}
              onClick={() => {
                flash(null, null);
                startTransition(async () => {
                  const result = await completarNacionalizacionAction(ficha.id);
                  if (!result.success) {
                    flash(null, result.error);
                    return;
                  }
                  flash("Nacionalización completada", null);
                  router.push(`/importacion/${ficha.id}`);
                  router.refresh();
                });
              }}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Marcar nacionalizado"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function PasoChip({
  n,
  label,
  completo,
  current,
}: {
  n: number;
  label: string;
  completo: boolean;
  current?: boolean;
}) {
  const base =
    "inline-flex min-w-0 w-full items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[11px] font-medium sm:text-xs";
  const styles = completo
    ? `bg-emerald-600 text-white ${current ? "ring-2 ring-emerald-300/70 ring-offset-2 ring-offset-slate-950" : ""}`
    : `bg-red-600 text-white ${current ? "ring-2 ring-red-300/70 ring-offset-2 ring-offset-slate-950" : ""}`;
  return (
    <span className={`${base} ${styles}`}>
      {completo ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="opacity-80">{n}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}
