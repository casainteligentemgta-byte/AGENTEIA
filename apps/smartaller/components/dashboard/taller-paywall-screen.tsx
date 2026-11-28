import { Building2, Sparkles } from "lucide-react";
import { getTasaBcvDelDia } from "@/lib/billing/tasa-bcv";
import { getReportePendiente, getUltimoReporteRechazado } from "@/lib/billing/reportes";
import { getUser } from "@/lib/supabase/server";
import { PLANES_PAGO } from "@/lib/billing/plans";
import { ReportePagoForm } from "@/components/pagos/reporte-pago-form";

export async function TallerPaywallScreen() {
  const user = await getUser();
  const [tasa, pendiente, rechazado] = await Promise.all([
    getTasaBcvDelDia(),
    user ? getReportePendiente(user.id, "taller") : Promise.resolve(null),
    user ? getUltimoReporteRechazado(user.id, "taller") : Promise.resolve(null),
  ]);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg shadow-teal-600/30">
          <Building2 className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-white">{PLANES_PAGO.taller.nombre}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          El dashboard del taller cuesta USD 100 al mes. Paga con Pago Móvil y reporta la
          transferencia para activar órdenes, flota y avisos a clientes.
        </p>
        <ul className="mt-6 space-y-2 text-left text-sm text-zinc-300">
          <li className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-teal-400" />
            Órdenes, recepción e historial de la flota
          </li>
          <li className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-teal-400" />
            Tus clientes vinculados usan la app sin pagar
          </li>
          <li className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-teal-400" />
            Confirmación manual en cuanto se reciba el pago
          </li>
        </ul>
        <ReportePagoForm
          tipoPlan="taller"
          tasa={tasa}
          pendiente={pendiente}
          rechazado={pendiente ? null : rechazado}
        />
      </div>
    </div>
  );
}
