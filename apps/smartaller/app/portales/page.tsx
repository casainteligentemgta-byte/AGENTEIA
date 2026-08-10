import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  Car,
  Landmark,
  LayoutGrid,
  Shield,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import {
  PORTAL_META,
  PORTAL_ROLES,
  resolvePortalAccess,
  type PortalRole,
} from "@/lib/portal/roles";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ICONS: Record<PortalRole, typeof Shield> = {
  master: Shield,
  admin: ShieldCheck,
  aduanera: Landmark,
  taller: Wrench,
  concesionario: Building2,
  usuario: Car,
};

export default async function PortalesHubPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/portales");

  const access = await resolvePortalAccess();
  if (!access) redirect("/login?next=/portales");

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 inline-flex items-center gap-2 text-cyan-400">
          <LayoutGrid className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wide">
            SmartTaller
          </span>
        </div>
        {access.orgNombre ? (
          <p className="mt-2 text-xs text-zinc-500">
            Organización: {access.orgNombre}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-zinc-600">{access.email}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PORTAL_ROLES.map((role) => {
            const meta = PORTAL_META[role];
            const enabled = access.roles.includes(role);
            const Icon = ICONS[role];
            const masterBlocked =
              (role === "master" || role === "admin" || role === "aduanera") &&
              enabled &&
              !access.verTodo &&
              access.tallerIds.length === 0;

            if (!enabled) {
              return (
                <div
                  key={role}
                  className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-5 opacity-45"
                >
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Icon className="h-5 w-5" />
                    <h2 className="font-semibold">{meta.title}</h2>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">{meta.description}</p>
                  <p className="mt-3 text-xs text-zinc-600">Sin acceso asignado</p>
                </div>
              );
            }

            if (masterBlocked) {
              return (
                <div
                  key={role}
                  className={`rounded-2xl border p-5 ${meta.accent}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <h2 className="font-semibold">{meta.title}</h2>
                  </div>
                  <p className="mt-2 text-sm opacity-80">{meta.description}</p>
                  <p className="mt-3 text-xs opacity-70">
                    Pendiente de autorización legal (`ver_todo`) o talleres asignados.
                  </p>
                </div>
              );
            }

            return (
              <Link
                key={role}
                href={meta.href}
                className={`rounded-2xl border p-5 transition hover:brightness-110 ${meta.accent}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <h2 className="font-semibold">{meta.title}</h2>
                </div>
                <p className="mt-2 text-sm opacity-80">{meta.description}</p>
                <p className="mt-4 text-xs font-medium opacity-90">Abrir sección →</p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
