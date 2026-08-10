import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  Car,
  Landmark,
  LayoutGrid,
  Shield,
  ShieldCheck,
} from "lucide-react";
import {
  PORTAL_META,
  resolvePortalAccess,
  type PortalRole,
} from "@/lib/portal/roles";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HubButton = {
  key: string;
  title: string;
  href: string;
  accent: string;
  Icon: typeof Shield;
  roles: PortalRole[];
};

const HUB_BUTTONS: HubButton[] = [
  {
    key: "master",
    title: "Administrador máster",
    href: PORTAL_META.master.href,
    accent: PORTAL_META.master.accent,
    Icon: Shield,
    roles: ["master"],
  },
  {
    key: "admin",
    title: "Administrador",
    href: PORTAL_META.admin.href,
    accent: PORTAL_META.admin.accent,
    Icon: ShieldCheck,
    roles: ["admin"],
  },
  {
    key: "aduanera",
    title: "Aduanera",
    href: PORTAL_META.aduanera.href,
    accent: PORTAL_META.aduanera.accent,
    Icon: Landmark,
    roles: ["aduanera"],
  },
  {
    key: "taller-concesionario",
    title: "Taller o concesionario",
    href: PORTAL_META.taller.href,
    accent: PORTAL_META.taller.accent,
    Icon: Building2,
    roles: ["taller", "concesionario"],
  },
  {
    key: "usuario",
    title: "Usuario",
    href: PORTAL_META.usuario.href,
    accent: PORTAL_META.usuario.accent,
    Icon: Car,
    roles: ["usuario"],
  },
];

function isBlocked(
  roles: PortalRole[],
  access: Awaited<ReturnType<typeof resolvePortalAccess>>
): boolean {
  if (!access) return true;
  const needsScope = roles.some(
    (r) => r === "master" || r === "admin" || r === "aduanera"
  );
  if (!needsScope) return false;
  return !access.verTodo && access.tallerIds.length === 0;
}

export default async function PortalesHubPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/portales");

  const access = await resolvePortalAccess();
  if (!access) redirect("/login?next=/portales");

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg">
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

        <div className="mt-8 flex flex-col gap-3">
          {HUB_BUTTONS.map((btn) => {
            const enabled = btn.roles.some((r) => access.roles.includes(r));
            const blocked = enabled && isBlocked(btn.roles, access);
            const Icon = btn.Icon;

            let href = btn.href;
            if (btn.key === "taller-concesionario") {
              if (
                access.roles.includes("concesionario") &&
                !access.roles.includes("taller")
              ) {
                href = PORTAL_META.concesionario.href;
              } else if (access.roles.includes("taller")) {
                href = PORTAL_META.taller.href;
              } else {
                href = PORTAL_META.concesionario.href;
              }
            }

            if (!enabled || blocked) {
              return (
                <div
                  key={btn.key}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 px-5 py-4 opacity-40"
                >
                  <Icon className="h-5 w-5 shrink-0 text-zinc-500" />
                  <span className="font-semibold text-zinc-500">{btn.title}</span>
                </div>
              );
            }

            return (
              <Link
                key={btn.key}
                href={href}
                className={`flex items-center gap-3 rounded-2xl border px-5 py-4 transition hover:brightness-110 ${btn.accent}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="font-semibold">{btn.title}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
