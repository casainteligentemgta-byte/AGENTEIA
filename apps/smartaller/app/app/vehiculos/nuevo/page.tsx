import { AppHeader } from "@/components/app/app-header";
import { AddVehicleForm } from "@/components/app/add-vehicle-form";

export const dynamic = "force-dynamic";

export default function NuevoVehiculoPage() {
  return (
    <div className="app-bg-dark min-h-screen">
      <AppHeader centered />
      <main className="px-4 pb-10 pt-4">
        <AddVehicleForm />
      </main>
    </div>
  );
}
