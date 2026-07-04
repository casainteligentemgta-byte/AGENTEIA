"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wrench,
  LayoutDashboard,
  Car,
  ClipboardList,
  Bell,
  Home,
  Settings,
} from "lucide-react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

const links = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/dashboard/mantenimientos", label: "Mantenimientos", icon: ClipboardList },
  { href: "/dashboard/vehiculos", label: "Vehículos", icon: Car },
  { href: "/dashboard/recordatorios", label: "Recordatorios", icon: Bell },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
];

type SidebarProps = {
  userEmail?: string | null;
  tallerNombre?: string | null;
};

export function Sidebar({ userEmail, tallerNombre }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col border-b border-zinc-800 bg-zinc-950 md:fixed md:inset-y-0 md:w-64 md:border-b-0 md:border-r">
      <div className="flex h-16 items-center gap-2 border-b border-zinc-800 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
          <Wrench className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold leading-none">{tallerNombre ?? "SmartTaller"}</p>
          <p className="text-xs text-zinc-500">Panel del taller</p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:overflow-visible">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden border-t border-zinc-800 p-3 md:block">
        {userEmail && (
          <p className="mb-2 truncate px-3 text-xs text-zinc-600" title={userEmail}>
            {userEmail}
          </p>
        )}
        <SignOutButton />
        <Link
          href="/"
          className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <Home className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>
    </aside>
  );
}
