import Link from "next/link";
import { BrandMarkIcon } from "./icons";
import { LOGIN_HREF, SIGNUP_HREF } from "./auth-links";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-landing-accent focus-visible:rounded-md";

const wrap =
  "mx-auto flex h-[68px] w-full max-w-landing items-center justify-between px-5 lp:h-20 lp:px-12";

const btnBase =
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-[18px] text-[15px] font-medium transition-[background,border-color] duration-150 ${focusRing}`;

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-landing-line bg-landing-bg/92 pt-[env(safe-area-inset-top,0px)] backdrop-blur-[8px]">
      <div className={wrap}>
        <a
          className={`flex items-center gap-2.5 ${focusRing}`}
          href="#inicio"
          aria-label="SmartTaller, inicio"
        >
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-landing-accent text-landing-on-accent">
            <BrandMarkIcon />
          </span>
          <span className="font-landing-display text-xl font-bold tracking-[-0.3px]">
            Smart<span className="text-landing-accent">Taller</span>
          </span>
        </a>
        <nav className="flex items-center gap-7" aria-label="Principal">
          <a
            className={`hidden text-[15px] text-landing-text-2 hover:text-landing-text lp:inline-flex ${focusRing}`}
            href="#como"
          >
            Cómo funciona
          </a>
          <a
            className={`hidden text-[15px] text-landing-text-2 hover:text-landing-text lp:inline-flex ${focusRing}`}
            href="#beneficios"
          >
            Beneficios
          </a>
          <Link
            className={`${btnBase} border border-landing-border hover:border-landing-ghost-hover hover:bg-landing-surface`}
            href={LOGIN_HREF}
          >
            Iniciar sesión
          </Link>
          <Link
            className={`${btnBase} hidden bg-landing-accent font-semibold text-landing-on-accent hover:bg-landing-accent-hover lp:inline-flex`}
            href={SIGNUP_HREF}
          >
            Crear cuenta gratis
          </Link>
        </nav>
      </div>
    </header>
  );
}
