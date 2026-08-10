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
  hasPortalRole,
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

  const items = HUB_BUTTONS.map((btn) => {
    const enabled =
      btn.roles.some((r) => hasPortalRole(access, r)) ||
      (access.roles.includes("master") &&
        (btn.key === "admin" || btn.key === "aduanera"));
    const blocked =
      enabled &&
      !(
        access.roles.includes("master") &&
        (btn.key === "admin" || btn.key === "aduanera")
      ) &&
      isBlocked(btn.roles, access);

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

    return { ...btn, enabled, blocked, href };
  });

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.14),_transparent_55%),linear-gradient(180deg,#070b12_0%,#0a1628_50%,#070b12_100%)] md:h-dvh md:overflow-hidden">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 md:h-full md:max-h-dvh md:py-5 lg:px-8 lg:py-6">
        <header className="shrink-0 pb-4 md:pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-cyan-400">
                <LayoutGrid className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] md:text-xs">
                  SmartTaller
                </span>
              </div>
              {access.orgNombre ? (
                <p className="mt-1.5 text-xs text-zinc-500 md:mt-2 md:text-sm">
                  {access.orgNombre}
                </p>
              ) : null}
            </div>
            <p className="max-w-[50%] truncate text-right text-[11px] text-zinc-600 md:text-xs">
              {access.email}
            </p>
          </div>
        </header>

        {/* Móvil: columna con scroll. Tablet/laptop: rejilla que llena el viewport. */}
        <div className="flex flex-1 flex-col gap-3 pb-6 md:grid md:min-h-0 md:grid-cols-6 md:grid-rows-3 md:gap-3 md:pb-0 lg:gap-4">
          {items.map((btn, index) => {
            const Icon = btn.Icon;
            const spanClass =
              index === 0
                ? "md:col-span-3 md:row-span-1"
                : index === 1
                  ? "md:col-span-3 md:row-span-1"
                  : index === 2
                    ? "md:col-span-2 md:row-span-1"
                    : index === 3
                      ? "md:col-span-2 md:row-span-1"
                      : "md:col-span-2 md:row-span-1";

            const sharedClass = `flex items-center gap-3 rounded-2xl border px-5 py-4 transition md:h-full md:min-h-0 md:flex-col md:items-start md:justify-between md:gap-4 md:px-5 md:py-5 lg:px-6 lg:py-6 ${spanClass}`;

            if (!btn.enabled || btn.blocked) {
              return (
                <div
                  key={btn.key}
                  className={`${sharedClass} border-zinc-800/80 bg-zinc-950/40 opacity-40`}
                >
                  <Icon className="h-5 w-5 shrink-0 text-zinc-500 md:h-7 md:w-7" />
                  <span className="font-semibold text-zinc-500 md:text-lg">
                    {btn.title}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={btn.key}
                href={btn.href}
                className={`${sharedClass} hover:brightness-110 active:scale-[0.99] ${btn.accent}`}
              >
                <Icon className="h-5 w-5 shrink-0 md:h-7 md:w-7" />
                <span className="font-semibold leading-snug md:text-lg">
                  {btn.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
