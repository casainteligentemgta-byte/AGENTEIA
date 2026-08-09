import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { canAccessImportacion, canViewLoginLogs } from "@/lib/importacion/access";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";
import { resolvePortalAccess } from "@/lib/portal/roles";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ImportacionLayout({
  children,
}: {
  children: ReactNode;
}) {
  // /importacion/login se sirve sin este gate (ruta hermana con page propia
  // y exclusión en middleware). Aquí solo rutas autenticadas del módulo.
  const user = await getUser();
  if (!user) {
    redirect(`${IMPORTACION_BASE}/login?redirectTo=${IMPORTACION_BASE}`);
  }

  const access = await resolvePortalAccess();
  if (!canAccessImportacion(access)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b12] px-4">
        <div className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-center">
          <h1 className="text-lg font-semibold text-zinc-50">Sin acceso</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Tu cuenta no tiene un rol asignado para el módulo Importación.
          </p>
          <Link
            href="/portales"
            className="mt-4 inline-block text-sm text-cyan-400 hover:underline"
          >
            Ir a portales
          </Link>
        </div>
      </main>
    );
  }

  const showLogs = canViewLoginLogs(access);

  return (
    <div className="min-h-screen">
      <div className="border-b border-zinc-800/80 bg-zinc-950/60 px-4 py-2 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            Módulo Importación ·{" "}
            <span className="text-zinc-300">
              {access?.roles
                .filter((r) => r !== "usuario" || access.roles.length === 1)
                .map((r) =>
                  r === "master"
                    ? "Administrador máster"
                    : r === "admin"
                      ? "Administrador"
                      : r === "concesionario"
                        ? "Concesionario"
                        : r === "taller"
                          ? "Taller"
                          : r === "aduanera"
                            ? "Aduanera"
                            : "Usuario"
                )
                .join(" · ") || "Usuario"}
            </span>
          </p>
          <div className="flex items-center gap-3 text-xs">
            {showLogs ? (
              <Link
                href={`${IMPORTACION_BASE}/admin/ingresos`}
                className="text-amber-300/90 hover:underline"
              >
                Registro de ingresos
              </Link>
            ) : null}
            <Link href="/portales" className="text-zinc-400 hover:text-zinc-200">
              Portales
            </Link>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
