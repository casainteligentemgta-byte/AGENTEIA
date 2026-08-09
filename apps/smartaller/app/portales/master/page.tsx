import { redirect } from "next/navigation";
import Link from "next/link";
import {
  listPortalTalleresAction,
  listPortalVehiculosAction,
} from "@/app/actions/portal";
import { PortalShell } from "@/components/portal/PortalShell";
import { resolvePortalAccess, requirePortalRole } from "@/lib/portal/roles";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PortalMasterPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/portales/master");

  const access = await resolvePortalAccess();
  const gate = requirePortalRole(access, "master");
  if (!gate.ok) {
    return (
      <PortalShell title="Master" subtitle={gate.error}>
        <Link href="/portales" className="text-sm text-cyan-400 hover:underline">
          Volver a portales
        </Link>
      </PortalShell>
    );
  }

  const [talleresRes, vehiculosRes] = await Promise.all([
    listPortalTalleresAction("master"),
    listPortalVehiculosAction("master"),
  ]);

  const talleres = talleresRes.success ? talleresRes.talleres : [];
  const vehiculos = vehiculosRes.success ? vehiculosRes.vehiculos : [];
  const verTodo = talleresRes.success ? talleresRes.verTodo : false;

  return (
    <PortalShell
      title="Administrador máster"
      subtitle={
        verTodo
          ? "Visión global autorizada de talleres, flotas y supervisión."
          : "Visión acotada a talleres asignados (sin ver_todo)."
      }
    >
      {verTodo ? (
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href="/importacion"
            className="rounded-xl border border-cyan-800/50 bg-cyan-950/30 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-950/50"
          >
            Abrir Importación
          </Link>
          <Link
            href="/importacion/admin/ingresos"
            className="rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-100 hover:bg-amber-950/50"
          >
            Registro de ingresos
          </Link>
        </div>
      ) : (
        <p className="mb-6 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Principio de minimización: sin `ver_todo` solo ves talleres en tu
          alcance. Actívalo solo si el contrato y la ley lo permiten.
        </p>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Talleres ({talleres.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Industria</th>
                <th className="px-3 py-2 font-medium">Vehículos</th>
              </tr>
            </thead>
            <tbody>
              {talleres.map((t) => (
                <tr key={t.id} className="border-t border-zinc-800/80">
                  <td className="px-3 py-2 text-zinc-100">{t.nombre}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    {t.tipo_industria ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{t.vehiculosCount}</td>
                </tr>
              ))}
              {talleres.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-zinc-500">
                    Sin talleres en alcance
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Vehículos recientes ({vehiculos.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Taller</th>
                <th className="px-3 py-2 font-medium">Vehículo</th>
                <th className="px-3 py-2 font-medium">Placa</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Expediente</th>
              </tr>
            </thead>
            <tbody>
              {vehiculos.map((v) => (
                <tr key={v.id} className="border-t border-zinc-800/80">
                  <td className="px-3 py-2 text-zinc-400">
                    {v.tallerNombre ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-100">
                    {[v.marca, v.modelo, v.color].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-300">
                    {v.placa ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {v.nombreCliente ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-cyan-300/80">
                    {v.codigoExpediente ?? "—"}
                  </td>
                </tr>
              ))}
              {vehiculos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                    Sin vehículos en alcance
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PortalShell>
  );
}
