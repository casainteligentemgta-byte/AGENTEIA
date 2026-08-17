import { redirect } from "next/navigation";
import Link from "next/link";
import { listPortalVehiculosAction } from "@/app/actions/portal";
import { PortalShell } from "@/components/portal/PortalShell";
import { resolvePortalAccess, requirePortalRole } from "@/lib/portal/roles";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PortalConcesionarioPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/portales/concesionario");

  const access = await resolvePortalAccess();
  const gate = requirePortalRole(access, "concesionario");
  if (!gate.ok) {
    return (
      <PortalShell title="Concesionarios" subtitle={gate.error}>
        <Link href="/portales" className="text-sm text-cyan-400 hover:underline">
          Volver a portales
        </Link>
      </PortalShell>
    );
  }

  const result = await listPortalVehiculosAction("concesionario");
  const vehiculos = result.success ? result.vehiculos : [];

  return (
    <PortalShell
      title="Concesionarios"
      subtitle="Monitorea la flota y los clientes vinculados a tu concesión."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/dashboard/vehiculos"
          className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500"
        >
          Panel de vehículos
        </Link>
        <Link
          href="/smartimport"
          className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-3 py-2 text-sm text-cyan-100"
        >
          Puerto Libre
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Vehículo</th>
              <th className="px-3 py-2 font-medium">Placa</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Teléfono</th>
              <th className="px-3 py-2 font-medium">Serial</th>
              <th className="px-3 py-2 font-medium">Expediente PL</th>
            </tr>
          </thead>
          <tbody>
            {vehiculos.map((v) => (
              <tr key={v.id} className="border-t border-zinc-800/80">
                <td className="px-3 py-2 text-zinc-100">
                  {[v.marca, v.modelo, v.color].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-300">
                  {v.placa ?? "—"}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {v.nombreCliente ?? "—"}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {v.telefonoCliente ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">
                  {v.serialCarroceria ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {v.codigoExpediente ? (
                    <Link
                      href={`/smartimport/${v.id}`}
                      className="font-mono text-xs text-cyan-300 hover:underline"
                    >
                      {v.codigoExpediente}
                    </Link>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
            {vehiculos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  Aún no hay vehículos en tu flota
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
