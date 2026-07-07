import { RepuestoCatalogForm } from "@/components/dashboard/repuesto-catalog-form";
import { getRepuestosTaller } from "@/lib/data/repuestos";
import { formatCurrency } from "@/lib/format";

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
        {repuestos.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-zinc-500">
            Sin repuestos en catálogo. Agrega el primero arriba.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-zinc-500">
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Stock</th>
                  <th className="px-5 py-3 font-medium">Mín.</th>
                  <th className="px-5 py-3 font-medium">Precio</th>
                </tr>
              </thead>
              <tbody>
                {repuestos.map((r) => {
                  const bajo = r.stock_actual <= r.stock_minimo && r.stock_minimo > 0;
                  return (
                    <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                      <td className="px-5 py-4 font-medium text-zinc-200">{r.nombre}</td>
                      <td className="px-5 py-4 text-zinc-500">{r.sku ?? "—"}</td>
                      <td
                        className={
                          bajo ? "px-5 py-4 font-semibold text-amber-400" : "px-5 py-4 text-zinc-300"
                        }
                      >
                        {Number(r.stock_actual).toLocaleString("es-CO")} {r.unidad}
                      </td>
                      <td className="px-5 py-4 text-zinc-500">
                        {Number(r.stock_minimo).toLocaleString("es-CO")}
                      </td>
                      <td className="px-5 py-4 text-zinc-200">
                        {formatCurrency(Number(r.precio_venta))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
