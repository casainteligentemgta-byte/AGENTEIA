import type { ReactNode } from "react";
import { BellIcon, CameraIcon, CloudIcon, ScanIcon } from "./icons";

type Step = {
  who: string;
  title: string;
  body: string;
  icon: ReactNode;
};

const STEPS: Step[] = [
  {
    who: "01 · Tú",
    title: "Foto y listo",
    body: "Llega el vehículo, el mecánico le toma una foto a la placa desde Telegram. Nada más.",
    icon: <CameraIcon />,
  },
  {
    who: "02 · SmartTaller",
    title: "Reconocimiento al instante",
    body: "La IA lee la placa, identifica el vehículo y precarga la recepción. Adiós a los errores de dedo.",
    icon: <ScanIcon />,
  },
  {
    who: "03 · SmartTaller",
    title: "Todo queda en la nube",
    body: "Historial, mantenimientos y costos, seguros y a la vista de tu equipo en tiempo real.",
    icon: <CloudIcon />,
  },
  {
    who: "04 · SmartTaller",
    title: "El cliente vuelve solo",
    body: "A los 6 meses o por kilometraje, le llega un recordatorio por WhatsApp para su próximo mantenimiento.",
    icon: <BellIcon />,
  },
];

export function Steps() {
  return (
    <section className="border-t border-landing-line py-11 lp:py-[88px]" id="como">
      <div className="mx-auto w-full max-w-landing px-5 lp:px-12">
        <div className="mb-7 flex max-w-[640px] flex-col gap-2.5 lp:mb-[52px]">
          <span className="text-sm font-semibold text-landing-accent">Cómo funciona</span>
          <h2 className="font-landing-display text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.08] tracking-[-0.02em]">
            De la placa al cliente que vuelve
          </h2>
          <p className="text-base text-landing-text-2">Cuatro pasos. Tres los hace el sistema.</p>
        </div>

        <ol className="m-0 flex list-none flex-col p-0 lp:grid lp:grid-cols-4 lp:gap-8">
          {STEPS.map((step, index) => {
            const isFirst = index === 0;
            const isLast = index === STEPS.length - 1;
            return (
              <li
                key={step.who}
                className="flex gap-4 lp:flex-col lp:gap-4"
              >
                <div className="flex flex-col items-center self-stretch lp:flex-row lp:gap-3">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border lp:h-12 lp:w-12 ${
                      isFirst
                        ? "border-landing-accent bg-landing-accent text-landing-on-accent"
                        : "border-landing-border bg-landing-surface-2"
                    }`}
                  >
                    {step.icon}
                  </span>
                  <span
                    className={`w-0.5 grow bg-landing-step-line lp:h-0.5 lp:min-w-0 lp:flex-1 ${
                      isLast ? "lp:hidden" : ""
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <div
                  className={`flex flex-col gap-1.5 ${isLast ? "pb-0" : "pb-7"} lp:pb-0`}
                >
                  <span className="text-xs text-landing-text-3">{step.who}</span>
                  <h3 className="text-[19px] font-semibold lp:text-[21px]">{step.title}</h3>
                  <p className="text-[15px] text-landing-text-2 lp:text-base">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
