"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import {
  updateNombreTallerAction,
  updateTipoIndustriaAction,
  regenerarCodigoAction,
} from "@/app/actions/taller";
import type { Taller } from "@/lib/taller";
import { INDUSTRIA_LABELS, TIPOS_INDUSTRIA, type TipoIndustria } from "@/lib/platform/types";

type ConfigFormProps = {
  taller: Taller;
  kioskUrl: string;
};

export function ConfigForm({ taller, kioskUrl }: ConfigFormProps) {
  const [nombre, setNombre] = useState(taller.nombre);
  const [tipoIndustria, setTipoIndustria] = useState<TipoIndustria>(
    taller.tipo_industria ?? "concesionario"
  );
  const [codigo, setCodigo] = useState(taller.codigo_vinculo);
  const [copied, setCopied] = useState(false);
  const [kioskCopied, setKioskCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const vinculado = taller.telegram_chat_id != null;
  const comando = `/vincular ${codigo}`;

  const handleSaveNombre = () => {
    startTransition(async () => {
      const result = await updateNombreTallerAction(nombre);
      setMessage(result.ok ? "Nombre actualizado" : result.error ?? "Error");
    });
  };

  const handleSaveIndustria = () => {
    startTransition(async () => {
      const result = await updateTipoIndustriaAction(tipoIndustria);
      setMessage(result.ok ? "Industria actualizada" : result.error ?? "Error");
    });
  };

  const handleRegenerar = () => {
    startTransition(async () => {
      const result = await regenerarCodigoAction();
      if (result.codigo) {
        setCodigo(result.codigo);
        setMessage("Código regenerado");
      } else {
        setMessage(result.error ?? "Error");
      }
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(comando);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyKiosk = async () => {
    await navigator.clipboard.writeText(kioskUrl);
    setKioskCopied(true);
    setTimeout(() => setKioskCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {message && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
          {message}
        </p>
      )}

      <section className="glass rounded-2xl p-6">
        <h2 className="font-semibold text-zinc-100">Datos del taller</h2>
        <p className="mt-1 text-sm text-zinc-500">Nombre visible en tu panel</p>
        <div className="mt-4 flex gap-3">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-brand-500"
          />
          <button
            type="button"
            onClick={handleSaveNombre}
            disabled={pending}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </button>
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-semibold text-zinc-100">Tipo de industria</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Define el protocolo de revisión en Mantenimientos
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <select
            value={tipoIndustria}
            onChange={(e) => setTipoIndustria(e.target.value as TipoIndustria)}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            {TIPOS_INDUSTRIA.map((t) => (
              <option key={t} value={t}>
                {INDUSTRIA_LABELS[t]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSaveIndustria}
            disabled={pending}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </button>
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-zinc-100">Vincular Telegram</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {vinculado
                ? "✅ Bot vinculado. Chat ID: " + taller.telegram_chat_id
                : "Conecta tu bot para registrar facturas"}
            </p>
          </div>
          {!vinculado && (
            <button
              type="button"
              onClick={handleRegenerar}
              disabled={pending}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Nuevo código
            </button>
          )}
        </div>

        {!vinculado && (
          <div className="mt-4 space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-400">
              <li>Abre tu bot de SmartTaller en Telegram</li>
              <li>Copia y envía exactamente este mensaje (no hace falta escribirlo a mano):</li>
            </ol>
            <div className="flex items-center gap-2 rounded-xl bg-zinc-900 p-4">
              <code className="flex-1 break-all text-sm text-brand-400">
                {codigo ? comando : "Generando código…"}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!codigo}
                className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {!codigo && (
              <button
                type="button"
                onClick={handleRegenerar}
                disabled={pending}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
              >
                Generar código ahora
              </button>
            )}
            <p className="text-xs text-zinc-600">
              Cada taller tiene su propio código. Solo tú verás los datos de tu taller en el dashboard.
            </p>
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-semibold text-zinc-100">Panel presidencia (recepción)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Abre esta URL en una pantalla o tablet en recepción. Se actualiza sola cada 30 s.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-900 p-4">
          <code className="flex-1 break-all text-xs text-brand-400 sm:text-sm">{kioskUrl}</code>
          <button
            type="button"
            onClick={handleCopyKiosk}
            className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:text-zinc-200"
          >
            {kioskCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-600">
          Opcional: define <code className="text-zinc-400">PRESIDENCIA_PIN</code> en Vercel para proteger el acceso.
        </p>
      </section>
    </div>
  );
}
