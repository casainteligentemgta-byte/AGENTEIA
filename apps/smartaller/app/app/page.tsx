import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { AppActionButtons } from "@/components/app/app-action-buttons";
import { AppTabs } from "@/components/app/app-tabs";
import { VehicleCard } from "@/components/app/vehicle-card";
import { PaywallScreen } from "@/components/app/paywall-screen";
import { SubscriptionNotice } from "@/components/app/subscription-notice";
import { ManageSubscriptionButton } from "@/components/app/manage-subscription-button";
import { getUserVehiculos } from "@/lib/data/user-vehicles";
import { countRecordatoriosPendientesPorPlaca } from "@/lib/data/vehicle-history";
import {
  getOrEnsurePerfil,
  perfilSuscripcionVigente,
  usuarioTieneVehiculoTaller,
} from "@/lib/data/perfil";
import { isStripeConfigured } from "@/lib/stripe/config";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: { subscribed?: string };
};

export default async function AppHomePage({ searchParams }: PageProps) {
  const [vehiculos, perfil, tieneVinculoTaller] = await Promise.all([
    getUserVehiculos(),
    getOrEnsurePerfil(),
    usuarioTieneVehiculoTaller(),
  ]);

  const suscripcionOk = perfil ? perfilSuscripcionVigente(perfil) : false;
  const mostrarPaywall = !tieneVinculoTaller && !suscripcionOk;

  if (mostrarPaywall) {
    return (
      <>
        <AppHeader centered />
        <SubscriptionNotice subscribed={searchParams.subscribed} />
        <PaywallScreen stripeEnabled={isStripeConfigured()} />
      </>
    );
  }

  const vehiculosConRecordatorios = await Promise.all(
    vehiculos.map(async (v) => ({
      vehiculo: v,
      pendientes: await countRecordatoriosPendientesPorPlaca(v.id, v.placa),
    }))
  );

  return (
    <>
      <AppHeader centered />
      <SubscriptionNotice subscribed={searchParams.subscribed} />

      <main className="px-4 pb-10 pt-2">
        <div className="mb-3 flex justify-end">
          <ManageSubscriptionButton tieneStripe={Boolean(perfil?.stripe_customer_id)} />
        </div>
        <AppActionButtons />

        <div className="my-5">
          <AppTabs active="vehiculos" />
        </div>

        <div className="space-y-4 rounded-3xl bg-[#0f1f38]/90 p-4 ring-1 ring-white/5">
          {vehiculosConRecordatorios.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-600/60 px-6 py-12 text-center">
              <p className="text-zinc-200">Aún no tienes vehículos registrados</p>
              <p className="mt-2 text-sm text-zinc-500">
                Agrega un auto, moto, bici, tractor o maquinaria
              </p>
              <Link
                href="/app/vehiculos/nuevo"
                className="app-cta-btn mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
              >
                <Plus className="h-4 w-4" />
                Agregar vehículo
              </Link>
            </div>
          ) : (
            vehiculosConRecordatorios.map(({ vehiculo, pendientes }) => (
              <VehicleCard
                key={vehiculo.id}
                vehiculo={vehiculo}
                recordatoriosPendientes={pendientes}
              />
            ))
          )}
        </div>
      </main>
    </>
  );
}
