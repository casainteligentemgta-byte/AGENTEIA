import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { canAccessImportacion } from "@/lib/importacion/access";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";
import { resolvePortalAccess } from "@/lib/portal/roles";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ImportacionLayout({
  children,
}: {
  children: ReactNode;
}) {
  // /smartimport/login se sirve sin este gate (ruta hermana con page propia
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

  return <>{children}</>;
}
