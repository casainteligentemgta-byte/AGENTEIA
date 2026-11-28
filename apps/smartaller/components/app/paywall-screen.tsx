import { Crown, Sparkles } from "lucide-react";
import { getBrand } from "@/lib/brand";
import { getTasaBcvDelDia } from "@/lib/billing/tasa-bcv";
import { getReportePendiente, getUltimoReporteRechazado } from "@/lib/billing/reportes";
import { getUser } from "@/lib/supabase/server";
import { ReportePagoForm } from "@/components/pagos/reporte-pago-form";

type PaywallScreenProps = {
  stripeEnabled?: boolean;
};

export async function PaywallScreen(_props: PaywallScreenProps) {
  const user = await getUser();
  const [tasa, pendiente, rechazado] = await Promise.all([
    getTasaBcvDelDia(),
    user ? getReportePendiente(user.id, "b2c") : Promise.resolve(null),
    user ? getUltimoReporteRechazado(user.id, "b2c") : Promise.resolve(null),
  ]);

  return (
    <main className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mx-auto w-full max-w-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30">
          <Crown className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold text-white">{getBrand().copy.proName}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {getBrand().copy.paywallBody}
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

        <ReportePagoForm
          tipoPlan="b2c"
          tasa={tasa}
          pendiente={pendiente}
          rechazado={pendiente ? null : rechazado}
        />

        <p className="mt-6 text-xs text-zinc-500">
          ¿Tu taller ya te registró? Vincula tu vehículo con la misma placa y accede gratis al
          historial del taller.
        </p>
      </div>
    </main>
  );
}
