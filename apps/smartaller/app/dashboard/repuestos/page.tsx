import { RepuestoCatalogForm } from "@/components/dashboard/repuesto-catalog-form";
import { RepuestoCatalogTable } from "@/components/dashboard/repuesto-catalog-table";
import { getRepuestosTaller } from "@/lib/data/repuestos";

export const dynamic = "force-dynamic";

export default async function RepuestosPage() {
  const repuestos = await getRepuestosTaller();

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Repuestos</h1>
        <p className="mt-1 text-zinc-500">
          Catálogo e inventario — se consumen al registrar una orden de servicio
        </p>
      </div>

      <div className="mb-8 max-w-2xl">
        <RepuestoCatalogForm />
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <RepuestoCatalogTable repuestos={repuestos} />
      </div>
    </div>
  );
}
