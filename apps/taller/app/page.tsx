import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">SmartTaller</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Mantenimientos sin fricción
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          Los mecánicos registran servicios desde Telegram. Recepción y clientes consultan todo al
          instante.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Link
          href="/presidencia"
          className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:border-brand-300 hover:shadow-md"
        >
          <span className="text-3xl" aria-hidden>
            🖥️
          </span>
          <h2 className="mt-4 text-xl font-bold text-slate-900 group-hover:text-brand-700">
            Presidencia
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Panel en vivo para recepción: servicios del día, clientes y próximos mantenimientos.
          </p>
        </Link>

        <Link
          href="/cliente"
          className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:border-brand-300 hover:shadow-md"
        >
          <span className="text-3xl" aria-hidden>
            🚗
          </span>
          <h2 className="mt-4 text-xl font-bold text-slate-900 group-hover:text-brand-700">
            Portal cliente
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            El dueño del vehículo consulta su historial de servicios y próxima cita recomendada.
          </p>
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-slate-400">
        Webhook Telegram: <code className="rounded bg-slate-100 px-1">/api/telegram-webhook</code>
      </p>
    </main>
  );
}
