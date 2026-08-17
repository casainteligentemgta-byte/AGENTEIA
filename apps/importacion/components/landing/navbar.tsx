import Link from "next/link";
import { BrandLogo } from "@/components/app/brand-logo";

type NavbarProps = {
  active?: "home" | "talleres";
  /** Home: solo registro e inicio de sesión. Talleres: navegación completa. */
  variant?: "minimal" | "full";
};

const authButtonBase =
  "inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-xl px-2 text-xs font-medium transition sm:h-10 sm:px-3 sm:text-sm";

export function Navbar({ active = "home", variant = "full" }: NavbarProps) {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-zinc-800/60 glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center">
          <BrandLogo size="sm" theme="dark" showDot={false} />
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-2.5 sm:gap-3">
          {variant === "full" && (
            <nav className="hidden items-center gap-1 sm:flex">
              <Link
                href="/para-talleres"
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active === "talleres"
                    ? "font-medium text-blue-300"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                Para talleres
              </Link>
              <Link
                href="/cliente"
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-100"
              >
                Portal cliente
              </Link>
              <Link
                href="/login?redirectTo=/app"
                className="hidden rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-100 md:inline-flex"
              >
                Mi vehículo
              </Link>
            </nav>
          )}
          <nav
            className={`grid min-w-0 grid-cols-2 gap-2.5 sm:gap-3 ${
              variant === "minimal"
                ? "w-[14.5rem] sm:w-[18rem]"
                : "w-[7rem] sm:w-[18rem]"
            }`}
            aria-label="Acceso"
          >
            <Link
              href="/login?redirectTo=/dashboard&mode=signup"
              className={`${authButtonBase} ${
                variant === "minimal"
                  ? "border border-zinc-500 text-zinc-100 hover:border-zinc-300 hover:text-white"
                  : "hidden border border-zinc-500 text-zinc-100 hover:border-zinc-300 hover:text-white sm:inline-flex"
              }`}
            >
              Registro
            </Link>
            <Link
              href="/login?redirectTo=/dashboard"
              className={`${authButtonBase} ${
                variant === "minimal" ? "" : "col-span-2 sm:col-span-1"
              } bg-blue-600 text-white hover:bg-blue-500`}
            >
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
