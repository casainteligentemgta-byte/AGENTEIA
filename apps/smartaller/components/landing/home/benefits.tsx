import type { ReactNode } from "react";
import { ChartIcon, ClipboardIcon, UsersIcon } from "./icons";

type Benefit = {
  title: string;
  body: string;
  icon: ReactNode;
};

const BENEFITS: Benefit[] = [
  {
    title: "Operación centralizada",
    body: "Recepción, órdenes, repuestos y facturación en un solo lugar.",
    icon: <ClipboardIcon />,
  },
  {
    title: "Tu equipo, al día",
    body: "Técnicos y administración registran cada avance con orden y exactitud.",
    icon: <UsersIcon />,
  },
  {
    title: "Números que se entienden",
    body: "Ingresos, productividad y pendientes en gráficos claros, no en planillas.",
    icon: <ChartIcon />,
  },
];

export function Benefits() {
  return (
    <section className="border-t border-landing-line py-11 lp:py-[88px]" id="beneficios">
      <div className="mx-auto w-full max-w-landing px-5 lp:px-12">
        <div className="mb-7 flex max-w-[640px] flex-col gap-2.5 lp:mb-[52px]">
          <span className="text-sm font-semibold text-landing-accent">Qué ganas</span>
          <h2 className="font-landing-display text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.08] tracking-[-0.02em]">
            Todo tu taller en una sola pantalla
          </h2>
        </div>

        <div className="grid gap-3 lp:grid-cols-3 lp:gap-5">
          {BENEFITS.map((benefit) => (
            <article
              key={benefit.title}
              className="flex items-start gap-3.5 rounded-2xl border border-landing-demo-border bg-landing-surface p-[18px] lp:flex-col lp:rounded-[18px] lp:p-7"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-landing-accent-soft text-landing-accent-soft-text">
                {benefit.icon}
              </span>
              <div>
                <h3 className="mb-1 text-[17px] font-semibold lp:text-xl">{benefit.title}</h3>
                <p className="text-[15px] text-landing-text-2 lp:text-base">{benefit.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
