import { AppHeader } from "@/components/app/app-header";
import { AddVehicleForm } from "@/components/app/add-vehicle-form";

export const dynamic = "force-dynamic";

export default function NuevoVehiculoPage() {
  return (
    <>
      <AppHeader showBack backHref="/app" title="Nuevo vehículo" />
      <main className="px-4 pb-10 pt-4">
        <AddVehicleForm />
      </main>
    </>
  );
}
