import Link from "next/link";
import { BrandLogo } from "@/components/app/brand-logo";

type NavbarProps = {
  active?: "home" | "talleres";
  /** Home: solo registro e inicio de sesión. Talleres: navegación completa. */
  variant?: "minimal" | "full";
};

const authButtonBase =
  "inline-flex h-9 w-[8.75rem] shrink-0 items-center justify-center rounded-xl px-3 text-sm font-medium transition";

export function Navbar({ active = "home", variant = "full" }: NavbarProps) {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-zinc-800/60 glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center">
          <BrandLogo size="sm" theme="dark" showDot={false} />
        </Link>
        <nav className="flex shrink-0 items-center gap-3">
          {variant === "full" && (
            <>
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
            </>
          )}
          <Link
            href="/login?redirectTo=/dashboard&mode=signup"
            className={`${authButtonBase} ${
              variant === "minimal"
                ? "border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:text-white"
                : "hidden border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:text-white sm:inline-flex"
            }`}
          >
            Registro
          </Link>
          <Link
            href="/login?redirectTo=/dashboard"
            className={`${authButtonBase} bg-blue-600 text-white hover:bg-blue-500`}
          >
            Iniciar sesión
          </Link>
        </nav>
      </div>
    </header>
  );
}
