import { AppHeader } from "@/components/app/app-header";
import { AddVehicleForm } from "@/components/app/add-vehicle-form";
import { BrandLogo } from "@/components/app/brand-logo";

export const dynamic = "force-dynamic";

export default function NuevoVehiculoPage() {
  return (
    <div className="app-bg-dark min-h-screen">
      <header className="px-4 pb-2 pt-6">
        <div className="flex justify-center">
          <BrandLogo theme="dark" />
        </div>
      </header>
      <main className="px-4 pb-10 pt-4">
        <AddVehicleForm />
      </main>
    </div>
  );
}
