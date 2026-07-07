import { CarnetDigital } from "@/components/smartbike/CarnetDigital";
import { AlertaSustitucion } from "@/components/smartbike/AlertaSustitucion";
import { componentsNeedingAlert } from "@/lib/smartbike/strava";
import type { BikeWithComponents } from "@/lib/smartbike/types";

type SmartBikePanelProps = {
  bike: BikeWithComponents;
};

export function SmartBikePanel({ bike }: SmartBikePanelProps) {
  const alertas = componentsNeedingAlert(bike.components);
  const shop = bike.shop;
  const bookingHref =
    shop?.contact_phone != null
      ? `tel:${shop.contact_phone.replace(/\s/g, "")}`
      : "/app/centros";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-zinc-900">SmartBike</h2>
        <p className="text-xs text-zinc-500">
          Carnet digital, desgaste por Strava y alertas de componentes
        </p>
      </div>

      <CarnetDigital bike={bike} />

      {shop && alertas.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-zinc-900">Alertas de sustitución</h3>
          {alertas.map((component) => (
            <AlertaSustitucion
              key={component.id}
              shop={shop}
              component={component}
              bookingHref={bookingHref}
            />
          ))}
        </div>
      )}
    </section>
  );
}
