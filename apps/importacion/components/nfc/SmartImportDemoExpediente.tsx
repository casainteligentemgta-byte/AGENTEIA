"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, CloudDownload, FileText, Loader2 } from "lucide-react";
import {
  adjuntarPdfDemoAction,
  adjuntarTodosPdfsDemoAction,
  type DemoExpedienteVehiculo,
  type DemoPlantillaItem,
} from "@/app/actions/nfc/demo-expediente";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";
import { DOCUMENTO_LABELS } from "@/lib/schemas/vehiculo-documentos";
import type { DocumentoTipo } from "@/lib/schemas/vehiculo-documentos";

type Props = {
  vehiculo: DemoExpedienteVehiculo;
  created: boolean;
  plantillas: DemoPlantillaItem[];
  listError: string | null;
  bucket: string;
  folder: string;
};

function formatBytes(size: number | null): string {
  if (size == null || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function SmartImportDemoExpediente({
  vehiculo: initial,
  created,
  plantillas,
  listError,
  bucket,
  folder,
}: Props) {
  const [vehiculo, setVehiculo] = useState(initial);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    created ? "Expediente creado en tu espacio. Ya puedes adjuntar los PDF." : null
  );
  const [isPending, startTransition] = useTransition();

  const attached = new Set<DocumentoTipo>(vehiculo.documentosAdjuntos);
  const usable = plantillas.filter((item) => item.tipo);

  function runAdjuntar(filename: string) {
    setError(null);
    setNotice(null);
    setPendingName(filename);
    startTransition(async () => {
      const result = await adjuntarPdfDemoAction({
        vehiculoId: vehiculo.id,
        filename,
      });
      setPendingName(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setVehiculo(result.vehiculo);
      setNotice(`${DOCUMENTO_LABELS[result.tipo]} quedó en el expediente.`);
    });
  }

  function runAdjuntarTodos() {
    setError(null);
    setNotice(null);
    setPendingName("*");
    startTransition(async () => {
      const result = await adjuntarTodosPdfsDemoAction({
        vehiculoId: vehiculo.id,
      });
      setPendingName(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setVehiculo(result.vehiculo);
      const extra =
        result.errores.length > 0 ? ` ${result.errores.join(" ")}` : "";
      setNotice(`Se adjuntaron ${result.adjuntados} PDF de la nube.${extra}`);
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link
            href={`${IMPORTACION_BASE}/demo`}
            className="inline-flex shrink-0 rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver al demo"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-400/90">
              <CloudDownload className="h-3.5 w-3.5" />
              Demo
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              Expediente precargado
            </h1>
          </div>
        </div>

        <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
          <p className="text-sm leading-relaxed text-zinc-400">
            Vehículo de demostración en <strong className="font-medium text-zinc-200">tu
            espacio</strong>. Los PDF no se suben desde el teléfono: se copian
            desde <code className="text-cyan-300">{bucket}/{folder}/</code>.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">Expediente</dt>
              <dd className="font-medium text-zinc-100">
                {vehiculo.codigoExpediente ?? vehiculo.placa || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Cliente</dt>
              <dd className="font-medium text-zinc-100">
                {vehiculo.importadorNombre}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Vehículo</dt>
              <dd className="font-medium text-zinc-100">
                {vehiculo.marca} {vehiculo.modelo} · {vehiculo.color}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Serial</dt>
              <dd className="font-mono text-xs text-zinc-300">
                {vehiculo.serialCarroceria}
              </dd>
            </div>
          </dl>
          <Link
            href={`${IMPORTACION_BASE}/${vehiculo.id}/planilla`}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 sm:w-auto"
          >
            Abrir planilla →
          </Link>
        </section>

        {notice ? (
          <p className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {listError ? (
          <p className="rounded-xl border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
            {listError}
          </p>
        ) : null}

        <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-50">
              PDF en la nube
            </h2>
            {usable.length > 0 ? (
              <button
                type="button"
                onClick={runAdjuntarTodos}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
              >
                {pendingName === "*" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Adjuntar todos
              </button>
            ) : null}
          </div>

          {plantillas.length === 0 && !listError ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              No hay archivos en{" "}
              <code className="text-cyan-300">
                {bucket}/{folder}/
              </code>
              . Súbelos en el dashboard de Supabase Storage:{" "}
              <code className="text-zinc-300">factura_comercial.pdf</code>,{" "}
              <code className="text-zinc-300">certificado_origen.pdf</code>,{" "}
              <code className="text-zinc-300">bl_guia.pdf</code> y{" "}
              <code className="text-zinc-300">lista_empaque.pdf</code>.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {plantillas.map((item) => {
                const ya = item.tipo ? attached.has(item.tipo) : false;
                const busy = isPending && pendingName === item.name;
                return (
                  <li
                    key={item.path}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium text-zinc-100">
                        <FileText className="h-4 w-4 shrink-0 text-cyan-400" />
                        <span className="truncate">
                          {item.tipo
                            ? DOCUMENTO_LABELS[item.tipo]
                            : item.name}
                        </span>
                        {ya ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-emerald-400"
                            aria-label="Ya adjunto"
                          />
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                        {item.name}
                        {formatBytes(item.size) ? ` · ${formatBytes(item.size)}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => runAdjuntar(item.name)}
                      disabled={isPending || !item.tipo}
                      className="inline-flex items-center rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {ya ? "Reemplazar" : "Adjuntar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
