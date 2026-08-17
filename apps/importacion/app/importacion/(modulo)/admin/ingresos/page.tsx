import Link from "next/link";
import { redirect } from "next/navigation";
import { listPortalLoginLogsAction } from "@/app/actions/portal-login";
import { canViewLoginLogs } from "@/lib/importacion/access";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";
import { resolvePortalAccess } from "@/lib/portal/roles";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const mes = MESES[d.getMonth()] ?? "";
  const y = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mes} ${y} ${hh}:${mm}`;
}

export default async function ImportacionIngresosPage() {
  const user = await getUser();
  if (!user) redirect(`${IMPORTACION_BASE}/login?redirectTo=${IMPORTACION_BASE}/admin/ingresos`);

  const access = await resolvePortalAccess();
  if (!canViewLoginLogs(access)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold text-zinc-50">Registro de ingresos</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Solo el administrador máster puede ver esta pantalla.
        </p>
        <Link
          href={IMPORTACION_BASE}
          className="mt-4 inline-block text-sm text-cyan-400 hover:underline"
        >
          Volver a Importación
        </Link>
      </main>
    );
  }

  const result = await listPortalLoginLogsAction(150);
  const logs = result.success ? result.logs : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-400/80">
            Supervisión · Administrador máster
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            Registro de ingresos
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Inicios de sesión de usuarios registrados en el módulo Importación y
            portales.
          </p>
        </div>
        <Link
          href={IMPORTACION_BASE}
          className="text-sm text-cyan-400 hover:underline"
        >
          ← Importación
        </Link>
      </div>

      {!result.success ? (
        <p className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {result.error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Fecha</th>
              <th className="px-3 py-2.5 font-medium">Correo</th>
              <th className="px-3 py-2.5 font-medium">Roles</th>
              <th className="px-3 py-2.5 font-medium">Ruta</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-zinc-800/80">
                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-300">
                  {formatWhen(log.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-zinc-100">
                  {log.email ?? log.userId.slice(0, 8)}
                </td>
                <td className="px-3 py-2.5 text-zinc-400">
                  {log.roles.length ? log.roles.join(", ") : "—"}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">
                  {log.path ?? "—"}
                </td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                  Aún no hay ingresos registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
