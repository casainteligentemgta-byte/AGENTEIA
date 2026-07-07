"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Car,
  ClipboardList,
  Bell,
  Home,
  Settings,
  Menu,
  X,
  Package,
} from "lucide-react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { BrandLogo } from "@/components/app/brand-logo";

const links = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/dashboard/mantenimientos", label: "Mantenimientos", icon: ClipboardList },
  { href: "/dashboard/vehiculos", label: "Vehículos", icon: Car },
  { href: "/dashboard/repuestos", label: "Repuestos", icon: Package },
  { href: "/dashboard/recordatorios", label: "Recordatorios", icon: Bell },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
];

type SidebarProps = {
  userEmail?: string | null;
  tallerNombre?: string | null;
};

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              active
                ? "bg-blue-600/15 text-blue-400"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar({ userEmail, tallerNombre }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Barra superior móvil */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <BrandLogo size="sm" theme="dark" markOnly showDot={false} />
          <span className="truncate font-semibold text-sm">{tallerNombre ?? "SmartTaller"}</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Overlay móvil */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={closeMobile}
          aria-label="Cerrar menú"
        />
      )}

      {/* Drawer móvil */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-zinc-800 bg-zinc-950 transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo size="sm" theme="dark" markOnly showDot={false} />
            <span className="truncate font-semibold text-sm">{tallerNombre ?? "SmartTaller"}</span>
          </div>
          <button
            type="button"
            onClick={closeMobile}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <NavLinks pathname={pathname} onNavigate={closeMobile} />
        </nav>
        <div className="border-t border-zinc-800 p-3">
          {userEmail && (
            <p className="mb-2 truncate px-3 text-xs text-zinc-600" title={userEmail}>
              {userEmail}
            </p>
          )}
          <SignOutButton />
          <Link
            href="/"
            onClick={closeMobile}
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            <Home className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </aside>

      {/* Sidebar escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:sticky md:top-0 md:flex md:h-screen">
        <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-5">
          <BrandLogo size="sm" theme="dark" markOnly showDot={false} />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-none">{tallerNombre ?? "SmartTaller"}</p>
            <p className="text-xs text-zinc-500">Panel del taller</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t border-zinc-800 p-3">
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
    </>
  );
}
