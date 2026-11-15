"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { regenerateCodigoReclamoAction } from "@/app/actions/vehiculos";
import { getAppBaseUrl } from "@/lib/app-url";
import { buildReclamoWhatsApp, waMeHref } from "@/lib/whatsapp";

type Props = {
  vehiculoId: string;
  placa: string;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  tallerNombre: string;
  codigoInicial: string | null;
  reclamado: boolean;
};

export function VehiculoClaimShareCard({
  vehiculoId,
  placa,
  nombreCliente,
  telefonoCliente,
  tallerNombre,
  codigoInicial,
  reclamado,
}: Props) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mensaje = useMemo(() => {
    if (!codigo) return "";
    return buildReclamoWhatsApp({
      nombre: nombreCliente?.trim() || "cliente",
      placa,
      tallerNombre,
      codigo,
      appUrl: getAppBaseUrl(),
    });
  }, [codigo, nombreCliente, placa, tallerNombre]);

  const whatsappHref = telefonoCliente && codigo ? waMeHref(telefonoCliente, mensaje) : null;

  function copyCodigo() {
    if (!codigo) return;
    void navigator.clipboard.writeText(codigo).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  function regenerar() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateCodigoReclamoAction(vehiculoId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCodigo(result.codigo);
    });
  }

  if (reclamado) {
    return (
      <section className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-zinc-100">App del dueño</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Este vehículo ya está vinculado a la cuenta del dueño. El código de reclamo quedó anulado.
        </p>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Código para el dueño</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Solo sirve para este vehículo. Entrégaselo en recepción o envíaselo por WhatsApp. No es el
        código de Telegram.
      </p>

      {codigo ? (
        <p className="mt-4 font-mono text-3xl font-bold tracking-[0.3em] text-blue-300">{codigo}</p>
      ) : (
        <p className="mt-4 text-sm text-zinc-400">Aún no hay código. Genera uno para compartirlo.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {codigo && (
          <button
            type="button"
            onClick={copyCodigo}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copiado" : "Copiar código"}
          </button>
        )}
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar por WhatsApp
          </a>
        )}
        <button
          type="button"
          onClick={regenerar}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {codigo ? "Regenerar" : "Generar código"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
}
