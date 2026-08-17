import { redirect } from "next/navigation";
import Link from "next/link";
import { listPortalVehiculosAction } from "@/app/actions/portal";
import { PortalShell } from "@/components/portal/PortalShell";
import { resolvePortalAccess, requirePortalRole } from "@/lib/portal/roles";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PortalAduaneraPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/portales/aduanera");

  const access = await resolvePortalAccess();
  const gate = requirePortalRole(access, "aduanera");
  if (!gate.ok) {
    return (
      <PortalShell title="Aduanera" subtitle={gate.error}>
        <Link href="/portales" className="text-sm text-cyan-400 hover:underline">
          Volver a portales
        </Link>
      </PortalShell>
    );
  }

  const result = await listPortalVehiculosAction("aduanera");
  const vehiculos = result.success ? result.vehiculos : [];
  const verTodo = result.success ? result.verTodo : false;

  return (
    <PortalShell
      title="Aduanera"
      subtitle={
        verTodo
          ? "Expedientes Puerto Libre e importaciones (alcance global autorizado)."
          : "Expedientes PL de talleres en tu alcance."
      }
    >
      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Expediente</th>
              <th className="px-3 py-2 font-medium">Taller</th>
              <th className="px-3 py-2 font-medium">Vehículo</th>
              <th className="px-3 py-2 font-medium">BL</th>
              <th className="px-3 py-2 font-medium">Llegada buque</th>
              <th className="px-3 py-2 font-medium">Fase</th>
            </tr>
          </thead>
          <tbody>
            {vehiculos.map((v) => (
              <tr key={v.id} className="border-t border-zinc-800/80">
                <td className="px-3 py-2">
                  <Link
                    href={`/smartimport/${v.id}`}
                    className="font-mono text-xs text-cyan-300 hover:underline"
                  >
                    {v.codigoExpediente ?? v.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {v.tallerNombre ?? "—"}
                </td>
                <td className="px-3 py-2 text-zinc-100">
                  {[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-300">
                  {v.numeroBl ?? "—"}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {v.fechaLlegadaBuque ?? "—"}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {v.planillaFase != null ? `Fase ${v.planillaFase}` : "—"}
                </td>
              </tr>
            ))}
            {vehiculos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  No hay expedientes PL en tu alcance
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
