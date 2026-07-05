"use client";

import { useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { abrirPortalFacturacionAction } from "@/app/actions/subscription";

type ManageSubscriptionButtonProps = {
  tieneStripe: boolean;
};

export function ManageSubscriptionButton({ tieneStripe }: ManageSubscriptionButtonProps) {
  const [pending, startTransition] = useTransition();

  if (!tieneStripe) return null;

  function handleClick() {
    startTransition(async () => {
      const result = await abrirPortalFacturacionAction();
      if (result.success && result.portalUrl) {
        window.location.href = result.portalUrl;
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs text-zinc-500 underline-offset-2 transition hover:text-zinc-300 hover:underline disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
      Gestionar suscripción
    </button>
  );
}
