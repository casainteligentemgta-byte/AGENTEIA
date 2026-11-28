"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Upload } from "lucide-react";
import { cancelarReportePagoAction, reportarPagoAction } from "@/app/actions/pagos";
import { PAGO_MOVIL } from "@/lib/billing/pago-movil";
import {
  formatUsd,
  formatVes,
  PLANES_PAGO,
  usdDelPlan,
  vesDelPlan,
  type TipoPlanPago,
} from "@/lib/billing/plans";
import type { TasaBcvDelDia } from "@/lib/billing/tasa-bcv";
import type { ReportePago } from "@/lib/billing/reportes";

type ReportePagoFormProps = {
  tipoPlan: TipoPlanPago;
  tasa: TasaBcvDelDia | null;
  pendiente: ReportePago | null;
  rechazado: ReportePago | null;
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="min-w-0 text-left">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="truncate font-mono text-sm text-zinc-100">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-300 hover:bg-white/10"
        aria-label={`Copiar ${label}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function ReportePagoForm({
  tipoPlan,
  tasa,
  pendiente,
  rechazado,
}: ReportePagoFormProps) {
  const plan = PLANES_PAGO[tipoPlan];
  const usd = usdDelPlan(tipoPlan);
  const ves = tasa ? vesDelPlan(usd, tasa.tasa) : null;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<"USD" | "VES">("VES");

  const montoSugerido = moneda === "VES" && ves != null ? ves.toFixed(2) : usd.toFixed(2);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("tipoPlan", tipoPlan);
    startTransition(async () => {
      const result = await reportarPagoAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  function handleCancel() {
    if (!pendiente) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelarReportePagoAction(pendiente.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="mt-8 space-y-5 text-left">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-3xl font-bold text-white">
          {formatUsd(usd)}
          <span className="text-base font-normal text-zinc-400">/mes</span>
        </p>
        {ves != null ? (
          <p className="mt-1 text-sm text-zinc-300">
            {formatVes(ves)} <span className="text-zinc-500">al mes</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">Tasa BCV no disponible en este momento.</p>
        )}
        {tasa ? (
          <p className="mt-2 text-[11px] text-zinc-500">
            {tasa.etiqueta}
            {tasa.fuente === "fallback" ? " · última publicada" : null}
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-200">Pago Móvil</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Transfiere a esta cuenta y reporta el pago. Un administrador lo confirma.
        </p>
        <div className="mt-3 space-y-2">
          <CopyRow label="Banco" value={PAGO_MOVIL.banco} />
          <CopyRow label="Teléfono" value={PAGO_MOVIL.telefono} />
          <CopyRow label="Cédula" value={PAGO_MOVIL.cedula} />
        </div>
      </div>

      {pendiente ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/40 px-4 py-4 text-sm text-amber-100">
          <p className="font-semibold">Reporte en revisión</p>
          <p className="mt-1 text-amber-100/80">
            Ref. {pendiente.referencia} · {pendiente.monto} {pendiente.moneda} ·{" "}
            {pendiente.fecha_pago}. Te avisamos cuando se confirme.
          </p>
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="mt-3 text-xs text-amber-200 underline disabled:opacity-60"
          >
            Cancelar reporte y enviar otro
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(new FormData(e.currentTarget));
          }}
          className="space-y-3"
        >
          {rechazado ? (
            <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">
              <p className="font-semibold">Pago no confirmado</p>
              <p className="mt-1 text-red-100/80">{rechazado.notas ?? "Revisa los datos y vuelve a reportar."}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-zinc-400">
              Moneda
              <select
                name="moneda"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as "USD" | "VES")}
                className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="VES">Bolívares (VES)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              Monto
              <input
                name="monto"
                type="number"
                step="0.01"
                min="0.01"
                required
                key={moneda}
                defaultValue={montoSugerido}
                className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
          </div>

          <label className="block text-xs text-zinc-400">
            Referencia
            <input
              name="referencia"
              required
              minLength={4}
              maxLength={24}
              placeholder="Ej. 00123456"
              className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>

          <label className="block text-xs text-zinc-400">
            Fecha del pago
            <input
              name="fechaPago"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>

          <label className="block text-xs text-zinc-400">
            Captura (opcional, imagen o PDF ≤ 10 MB)
            <span className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">
              <Upload className="h-4 w-4" />
              <input
                name="comprobante"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.pdf"
                className="w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-zinc-200"
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={pending}
            className="app-cta-btn mt-2 flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Ya pagué, reportar transferencia
          </button>
          <p className="text-center text-[11px] text-zinc-500">
            Plan {plan.nombre}. La activación no es inmediata: Luis confirma el pago.
          </p>
        </form>
      )}

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
