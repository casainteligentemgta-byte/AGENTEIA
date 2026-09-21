import { CheckIcon, ChatIcon } from "./icons";

export function DemoCard() {
  return (
    <div
      className="flex flex-col gap-3 rounded-[20px] border border-landing-demo-border bg-landing-surface p-4 lp:gap-4 lp:rounded-3xl lp:p-6"
      role="img"
      aria-label="Ejemplo: se envía la foto de la placa ABC-123 por Telegram, SmartTaller reconoce un Toyota Hilux 2019, crea la orden 0482 y envía un WhatsApp al cliente."
    >
      <div className="flex justify-between text-xs text-landing-text-3">
        <span>Telegram · SmartTaller Bot</span>
        <span>08:14</span>
      </div>

      <div className="mx-auto flex flex-col items-center gap-1.5 self-center rounded-[14px] bg-landing-bubble p-2.5">
        <div className="grid h-[58px] w-[150px] place-items-center rounded-lg border-[3px] border-landing-bg bg-landing-plate font-landing-display text-[26px] font-bold tracking-[2px] text-landing-bg shadow-[0_0_0_2px_#E9EDF0] lp:h-[76px] lp:w-[200px] lp:border-4 lp:text-[34px] lp:tracking-[3px]">
          ABC·123
        </div>
        <small className="text-xs text-landing-text-2">Foto de la placa</small>
      </div>

      <div className="flex flex-col gap-2.5 rounded-[14px] border border-landing-demo-border bg-landing-inset p-3.5 lp:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-landing-accent">
          <CheckIcon />
          Vehículo reconocido en 3 s
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px] lp:grid-cols-4 lp:text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-landing-text-3">Vehículo</dt>
            <dd className="m-0 font-medium">Toyota Hilux 2019</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-landing-text-3">Orden</dt>
            <dd className="m-0 font-medium">#0482 creada</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-landing-text-3">Cliente</dt>
            <dd className="m-0 font-medium">Carlos R.</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-landing-text-3">Estado</dt>
            <dd className="m-0 self-start rounded-md bg-landing-status-bg px-2 py-0.5 font-medium text-landing-status-text">
              En diagnóstico
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex items-start gap-2.5">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-landing-accent-soft text-landing-accent-soft-text">
          <ChatIcon />
        </span>
        <div>
          <small className="block text-xs text-landing-text-3">
            WhatsApp enviado al cliente
          </small>
          <p className="text-sm leading-[1.45] text-landing-wa-text">
            Hola Carlos, tu Hilux ya está en el taller. Te avisamos apenas esté lista.
          </p>
        </div>
      </div>
    </div>
  );
}
