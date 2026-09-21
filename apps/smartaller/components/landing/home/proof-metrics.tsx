/**
 * TODO: reemplazar [N] y [X] con datos reales, o eliminar esta sección.
 * Placeholders intencionales — no inventar métricas.
 */
export function ProofMetrics() {
  return (
    <section className="px-0 py-1 pb-11 lp:pb-[88px]" aria-label="Resultados">
      <div className="mx-auto w-full max-w-landing px-5 lp:px-12">
        <div className="grid max-w-[640px] grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1 rounded-[14px] border border-dashed border-landing-dashed p-4 lp:flex-row lp:items-baseline lp:gap-3 lp:px-6 lp:py-5">
            <strong className="font-landing-display text-[28px] leading-tight lp:text-[34px]">
              [N]
            </strong>
            <span className="text-[13px] text-landing-text-2 lp:text-[15px]">
              talleres ya lo usan
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-[14px] border border-dashed border-landing-dashed p-4 lp:flex-row lp:items-baseline lp:gap-3 lp:px-6 lp:py-5">
            <strong className="font-landing-display text-[28px] leading-tight lp:text-[34px]">
              [X] min
            </strong>
            <span className="text-[13px] text-landing-text-2 lp:text-[15px]">
              ahorrados por vehículo
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
