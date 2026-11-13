import Link from "next/link";
import { ArrowRightIcon } from "./icons";
import { LOGIN_HREF, SIGNUP_HREF } from "./auth-links";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background,border-color] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-landing-accent";

export function Closing() {
  return (
    <section className="px-0 py-3 pb-11 lp:py-4 lp:pb-[88px]">
      <div className="mx-auto grid w-full max-w-landing gap-4 px-5 lp:px-12">
        <div
          className="flex flex-col gap-4 rounded-[22px] border border-landing-cta-border bg-landing-cta-bg px-[22px] py-8 lp:p-10"
          id="registro"
        >
          <h2 className="font-landing-display text-[clamp(30px,3vw,40px)] font-bold leading-[1.08] tracking-[-0.02em]">
            Tu próximo auto puede entrar ya registrado.
          </h2>
          <p className="text-landing-cta-text">
            Conecta Telegram, envía la primera foto y mírala aparecer en tu dashboard.
          </p>
          <div className="flex flex-col gap-2 pt-1 lp:flex-row lp:items-center lp:gap-5">
            <Link
              className={`${btnBase} min-h-[54px] w-full px-[26px] text-[17px] bg-landing-accent font-semibold text-landing-on-accent hover:bg-landing-accent-hover lp:w-auto`}
              href={SIGNUP_HREF}
            >
              Crear cuenta gratis
              <ArrowRightIcon />
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-1.5 text-[15px] text-landing-cta-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-landing-accent focus-visible:rounded-md"
              href={LOGIN_HREF}
            >
              ¿Ya tienes cuenta? <b className="font-semibold text-landing-text">Iniciar sesión</b>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
