import Link from "next/link";
import { LayoutDashboard, ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";

type NavbarProps = {
  active?: "home" | "talleres";
};

export function Navbar({ active = "home" }: NavbarProps) {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-zinc-800/60 glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <BrandLogo size="sm" theme="dark" showDot={false} />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/para-talleres"
            className={`hidden sm:inline-flex rounded-lg px-3 py-2 text-sm transition ${
              active === "talleres"
                ? "font-medium text-blue-300"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            Para talleres
          </Link>
          <Link
            href="/cliente"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            Portal cliente
          </Link>
          <Link
            href="/login?redirectTo=/app"
            className="hidden md:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            Mi vehículo
          </Link>
          <Link
            href="/login?redirectTo=/dashboard"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            <LayoutDashboard className="h-4 w-4" />
            Iniciar sesión
          </Link>
          <Link
            href="/login?redirectTo=/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Entrar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
