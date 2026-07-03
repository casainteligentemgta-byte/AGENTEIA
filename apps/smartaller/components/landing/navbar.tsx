import Link from "next/link";
import { Wrench, LayoutDashboard, ArrowRight } from "lucide-react";

export function Navbar() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-zinc-800/60 glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
            <Wrench className="h-5 w-5" />
          </span>
          SmartTaller
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            <LayoutDashboard className="h-4 w-4" />
            Iniciar sesión
          </Link>
          <Link
            href="/login"
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
