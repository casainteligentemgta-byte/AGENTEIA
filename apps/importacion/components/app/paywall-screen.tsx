"use client";

import { useState, useTransition } from "react";
import { Crown, Loader2, Sparkles } from "lucide-react";
import { activarSuscripcionPremiumAction } from "@/app/actions/subscription";

type PaywallScreenProps = {
  onActivated?: () => void;
  stripeEnabled?: boolean;
};

export function PaywallScreen({ onActivated, stripeEnabled = false }: PaywallScreenProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubscribe() {
    setError(null);
    startTransition(async () => {
      const result = await activarSuscripcionPremiumAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      onActivated?.();
      window.location.reload();
    });
  }

  return (
    <main className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mx-auto max-w-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30">
          <Crown className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold text-white">SmartTaller Pro</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Lleva el control de tus vehículos de forma independiente: historial, recordatorios y
          Chat Smartaller, sin depender de un taller vinculado.
        </p>

        <ul className="mt-6 space-y-2 text-left text-sm text-zinc-300">
          <li className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-blue-400" />
            Registra todos tus activos (auto, bici, maquinaria)
          </li>
          <li className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-blue-400" />
            Anota mantenimientos manualmente
          </li>
          <li className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-blue-400" />
            Sincroniza si tu taller te atiende más adelante
          </li>
        </ul>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <p className="text-3xl font-bold text-white">
            $2.99
            <span className="text-base font-normal text-zinc-400">/mes</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">Cancela cuando quieras</p>

          <button
            type="button"
            onClick={handleSubscribe}
            disabled={pending}
            className="app-cta-btn mt-5 flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crown className="h-4 w-4" />
            )}
            Suscribirme ahora
          </button>

          <p className="mt-3 text-[10px] text-zinc-600">
            {stripeEnabled
              ? "Pago seguro con Stripe Checkout."
              : "Modo demo: activación sin pago real (configura Stripe en Vercel)."}
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <p className="mt-6 text-xs text-zinc-500">
          ¿Tu taller ya te registró? Vincula tu vehículo con la misma placa y accede gratis al
          historial del taller.
        </p>
      </div>
    </main>
  );
}
