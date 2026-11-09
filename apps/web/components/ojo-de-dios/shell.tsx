"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CloudSun,
  Eye,
  Film,
  HeartPulse,
  Mail,
  Newspaper,
  TrendingUp,
} from "lucide-react";
import { OJO_MODULES, type OjoModuleId } from "@/lib/ojo-de-dios/nav";

const ICONS: Record<OjoModuleId, typeof CloudSun> = {
  clima: CloudSun,
  agenda: CalendarDays,
  salud: HeartPulse,
  correo: Mail,
  titulares: Newspaper,
  tendencias: TrendingUp,
  cine: Film,
};

export function OjoShell({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<OjoModuleId>("clima");

  useEffect(() => {
    const nodes = OJO_MODULES.map((mod) => document.getElementById(mod.id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.id as OjoModuleId | undefined;
        if (id) setActive(id);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0.15, 0.4] }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="ojo-shell relative min-h-dvh bg-[#05080d] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(52,211,153,0.07),transparent_28%)]"
      />
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-cyan-400 focus:px-3 focus:py-2 focus:text-black"
      >
        Saltar al contenido
      </a>

      <div className="relative flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center border-r border-white/10 bg-black/50 py-5 backdrop-blur-md md:flex">
          <Link
            href="/agente"
            className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            aria-label="Volver al panel del agente"
          >
            <Eye className="h-5 w-5" />
          </Link>
          <nav aria-label="Módulos de Ojo de Dios">
            <NavList active={active} orientation="vertical" />
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">{children}</div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/80 px-2 py-2 backdrop-blur-md md:hidden"
        aria-label="Módulos de Ojo de Dios"
      >
        <NavList active={active} orientation="horizontal" />
      </nav>
    </div>
  );
}

function NavList({
  active,
  orientation,
}: {
  active: OjoModuleId;
  orientation: "vertical" | "horizontal";
}) {
  const vertical = orientation === "vertical";
  return (
    <ul
      className={
        vertical
          ? "flex flex-col items-center gap-2"
          : "flex items-stretch justify-between gap-1 overflow-x-auto"
      }
    >
      {OJO_MODULES.map((mod) => {
        const Icon = ICONS[mod.id];
        const isActive = active === mod.id;
        return (
          <li key={mod.id}>
            <a
              href={`#${mod.id}`}
              aria-label={mod.label}
              aria-current={isActive ? "true" : undefined}
              className={`flex items-center justify-center rounded-2xl transition ${
                vertical ? "h-11 w-11" : "h-11 min-w-[2.75rem] px-2"
              } ${
                isActive
                  ? "bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/30"
                  : "text-white/45 hover:bg-white/5 hover:text-white"
              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400`}
            >
              <Icon className="h-5 w-5" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
