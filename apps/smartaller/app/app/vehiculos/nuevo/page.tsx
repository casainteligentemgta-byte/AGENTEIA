import { AddVehicleForm } from "@/components/app/add-vehicle-form";
import { BrandLogo } from "@/components/app/brand-logo";
import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default function NuevoVehiculoPage() {
  const jac = getBrand().id === "jac";
  return (
    <div className={jac ? "min-h-screen bg-[#f3f4f8] pb-24" : "app-bg-dark min-h-screen"}>
      <header className="px-4 pb-2 pt-6">
        <div className="flex justify-center">
          <BrandLogo theme={jac ? "light" : "dark"} />
        </div>
      </header>
      <main className="px-4 pb-10 pt-4">
        <AddVehicleForm />
      </main>
    </div>
  );
}
