export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-10 sm:pt-40 sm:pb-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-zinc-950 to-zinc-950" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center animate-fade-in">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Tu taller, ahora{" "}
            <span className="gradient-text">inteligente</span>.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-zinc-400 sm:text-xl">
            Desde que el vehículo ingresa y es escaneado, SmartTaller automatiza todo: registra la
            orden, actualiza el inventario de la flota y notifica al cliente en tiempo real. Controla
            autos, motos, bicis o maquinaria desde un solo dashboard centralizado.
          </p>
        </div>
      </div>
    </section>
  );
}
