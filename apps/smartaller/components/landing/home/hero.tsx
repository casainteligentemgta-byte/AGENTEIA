import Link from "next/link";
import { ArrowRightIcon } from "./icons";
import { DemoCard } from "./demo-card";
import { SIGNUP_HREF } from "./auth-links";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background,border-color] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-landing-accent";

const btnLg = "min-h-[54px] px-[26px] text-[17px] w-full lp:w-auto";

export function Hero() {
  return (
    <section className="px-0 pt-9 pb-7 lp:pt-[88px] lp:pb-[72px]">
      <div className="mx-auto grid w-full max-w-landing gap-8 px-5 lp:grid-cols-2 lp:items-center lp:gap-[72px] lp:px-12">
        <div className="flex flex-col gap-5 lp:gap-[26px]">
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-landing-pill-border px-3 py-[7px] text-[13px] text-landing-text-2">
            <span
              className="h-[7px] w-[7px] rounded-full bg-landing-signal"
              aria-hidden="true"
            />
            Para autos, motos, bicis y maquinaria
          </span>
          <h1 className="font-landing-display text-[clamp(40px,6vw,68px)] font-bold leading-[1.02] tracking-[-0.03em]">
            Una foto a la placa.{" "}
            <span className="text-landing-accent">El resto lo hace SmartTaller.</span>
          </h1>
          <p className="max-w-[520px] text-[clamp(17px,1.6vw,20px)] text-landing-text-2">
            La IA reconoce el vehículo, abre la orden y le avisa al cliente por WhatsApp. Tú
            te dedicas a reparar.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 lp:flex-row">
            <Link
              className={`${btnBase} ${btnLg} bg-landing-accent font-semibold text-landing-on-accent hover:bg-landing-accent-hover`}
              href={SIGNUP_HREF}
            >
              Crear cuenta gratis
              <ArrowRightIcon />
            </Link>
            <a
              className={`${btnBase} ${btnLg} border border-landing-border hover:border-landing-ghost-hover hover:bg-landing-surface`}
              href="#como"
            >
              Ver cómo funciona
            </a>
          </div>
        </div>

        <DemoCard />
      </div>
    </section>
  );
}
