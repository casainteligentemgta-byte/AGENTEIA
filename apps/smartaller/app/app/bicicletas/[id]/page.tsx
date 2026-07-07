import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { CarnetDigital } from "@/components/smartbike/CarnetDigital";
import { AlertaSustitucion } from "@/components/smartbike/AlertaSustitucion";
import { getBikeWithComponents } from "@/lib/data/smartbike";
import { componentsNeedingAlert } from "@/lib/smartbike/strava";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

export default async function BicicletaDetallePage({ params }: PageProps) {
  const bike = await getBikeWithComponents(params.id);
  if (!bike) notFound();

  const alertas = componentsNeedingAlert(bike.components);
  const shop = bike.shop;
  const bookingHref =
    shop?.contact_phone != null
      ? `tel:${shop.contact_phone.replace(/\s/g, "")}`
      : "/app/centros";

  return (
    <div className="app-bg-light min-h-screen text-zinc-900">
      <AppHeader variant="light" centered />

      <main className="space-y-4 px-4 pb-12 pt-2">
        <Link
          href="/app/bicicletas"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Mis bicicletas
        </Link>

        <CarnetDigital bike={bike} />

        {shop && alertas.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-zinc-900">Alertas de sustitución</h2>
            {alertas.map((component) => (
              <AlertaSustitucion
                key={component.id}
                shop={shop}
                component={component}
                bookingHref={bookingHref}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
