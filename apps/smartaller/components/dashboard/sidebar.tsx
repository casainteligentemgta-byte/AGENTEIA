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
  Bike,
  ShieldCheck,
  LayoutGrid,
} from "lucide-react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { BrandLogo } from "@/components/app/brand-logo";
import { getBrand } from "@/lib/brand";

function sidebarLinks() {
  const brand = getBrand();
  const links = [
    { href: "/portales", label: brand.copy.portalesNavLabel, icon: LayoutGrid },
    { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
    { href: "/dashboard/mantenimientos", label: "Mantenimientos", icon: ClipboardList },
    { href: "/dashboard/vehiculos", label: "Vehículos", icon: Car },
    { href: "/dashboard/repuestos", label: "Repuestos", icon: Package },
    { href: "/dashboard/smartbike", label: "SmartBike", icon: Bike },
    { href: "/dashboard/recordatorios", label: "Recordatorios", icon: Bell },
    { href: "/smartimport", label: "SmartImport", icon: ShieldCheck },
    { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
  ];
  if (brand.id === "jac") {
    return links.filter((link) => link.href !== "/smartimport");
  }
  return links;
}

type SidebarProps = {
  userEmail?: string | null;
  tallerNombre?: string | null;
  defaultOpen?: boolean;
};

function NavLinks({
  pathname,
  onNavigate,
  jac,
}: {
  pathname: string;
  onNavigate?: () => void;
  jac?: boolean;
}) {
  return (
    <>
      {sidebarLinks().map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href ||
          (pathname.startsWith("/preview-marca") && href === "/dashboard") ||
          (href !== "/dashboard" && pathname.startsWith(href));
        const isPuertoLibre = href === "/smartimport";
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={
              jac
                ? `flex items-center gap-2 rounded-xl p-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-[#f3f4f8] text-[#1c1c22]"
                      : "text-[#5b5b66] hover:bg-[#f3f4f8]"
                  }`
                : `flex items-center gap-2 rounded-lg p-2 text-sm transition ${
                    active
                      ? "bg-blue-600/15 text-blue-400"
                      : "text-slate-300 hover:bg-zinc-900 hover:text-white"
                  }`
            }
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${isPuertoLibre && !active ? "text-blue-400" : ""}`}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </>
  );
}

function SidebarPanel({
  pathname,
  tallerNombre,
  userEmail,
  onClose,
  jac,
}: {
  pathname: string;
  tallerNombre?: string | null;
  userEmail?: string | null;
  onClose: () => void;
  jac: boolean;
}) {
  return (
    <>
      <div
        className={
          jac
            ? "flex h-14 items-center justify-between border-b border-[#eceef3] px-4 md:h-[72px] md:px-5"
            : "flex h-14 items-center justify-between border-b border-zinc-800 px-4 md:h-16 md:px-5"
        }
      >
        <div className="min-w-0">
          <BrandLogo size="sm" theme={jac ? "light" : "dark"} showDot={false} />
          {tallerNombre ? (
            <p className={`mt-1 truncate text-xs ${jac ? "text-[#6a6a74]" : "text-zinc-500"}`}>
              {tallerNombre}
            </p>
          ) : (
            <p className={`mt-1 text-xs ${jac ? "text-[#6a6a74]" : "text-zinc-500"}`}>
              Panel del taller
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={
            jac
              ? "rounded-lg p-2 text-[#6a6a74] hover:bg-[#f3f4f8] md:hidden"
              : "rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          }
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <NavLinks pathname={pathname} onNavigate={onClose} jac={jac} />
      </nav>
      <div className={jac ? "border-t border-[#eceef3] p-3" : "border-t border-zinc-800 p-3"}>
        {userEmail && (
          <p className="mb-2 truncate px-3 text-xs text-[#6a6a74]" title={userEmail}>
            {userEmail}
          </p>
        )}
        <SignOutButton />
        <Link
          href="/"
          onClick={onClose}
          className={
            jac
              ? "mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#5b5b66] transition hover:bg-[#f3f4f8]"
              : "mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-300"
          }
        >
          <Home className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>
    </>
  );
}

export function Sidebar({ userEmail, tallerNombre, defaultOpen = false }: SidebarProps) {
  const pathname = usePathname();
  const jac = getBrand().id === "jac";
  const [open, setOpen] = useState(defaultOpen);

  const close = () => setOpen(false);

  return (
    <>
      {/* Barra superior móvil */}
      <header
        className={
          jac
            ? "sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#eceef3] bg-white px-4 md:hidden"
            : "sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 md:hidden"
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          <BrandLogo size="sm" theme={jac ? "light" : "dark"} markOnly showDot={false} />
          <span className={`truncate text-sm font-semibold ${jac ? "text-[#1c1c22]" : ""}`}>
            {tallerNombre ?? getBrand().copy.fallbackTallerNombre}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            jac
              ? "rounded-lg p-2 text-[#5b5b66] hover:bg-[#f3f4f8]"
              : "rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          }
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {!jac && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed left-4 top-4 z-40 hidden rounded-xl border border-zinc-700 bg-zinc-950 p-2.5 text-zinc-300 shadow-lg transition hover:border-zinc-500 hover:text-white md:inline-flex"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {open && (
        <button
          type="button"
          className={`fixed inset-0 z-40 bg-black/60 ${jac ? "md:hidden" : ""}`}
          onClick={close}
          aria-label="Cerrar menú"
        />
      )}

      <aside
        className={
          jac
            ? `fixed inset-y-0 left-0 z-50 flex w-[250px] max-w-[85vw] flex-col border-r border-[#eceef3] bg-white transition-transform duration-200 md:static md:z-0 md:translate-x-0 ${
                open ? "translate-x-0" : "-translate-x-full"
              }`
            : `fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-zinc-800 bg-zinc-950 transition-transform duration-200 md:w-64 ${
                open ? "translate-x-0" : "-translate-x-full"
              }`
        }
      >
        <SidebarPanel
          pathname={pathname}
          tallerNombre={tallerNombre}
          userEmail={userEmail}
          onClose={close}
          jac={jac}
        />
      </aside>
    </>
  );
}
