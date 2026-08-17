type SubscriptionNoticeProps = {
  subscribed?: string;
};

export function SubscriptionNotice({ subscribed }: SubscriptionNoticeProps) {
  if (subscribed === "1") {
    return (
      <div className="mx-4 mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
        ¡Suscripción activada! Ya puedes registrar vehículos y usar SmartTaller Pro.
      </div>
    );
  }

  if (subscribed === "0") {
    return (
      <div className="mx-4 mb-4 rounded-xl border border-zinc-600/50 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
        Pago cancelado. Puedes suscribirte cuando quieras desde esta pantalla.
      </div>
    );
  }

  return null;
}
