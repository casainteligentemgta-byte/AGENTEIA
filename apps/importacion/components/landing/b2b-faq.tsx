const faqs = [
  {
    q: "¿Necesito instalar algo en el taller?",
    a: "No. Tu equipo usa Telegram como siempre. Solo vinculas el bot con un código desde la configuración del panel.",
  },
  {
    q: "¿Mis clientes tienen que pagar?",
    a: "Pueden usar la app gratis si están vinculados a tu taller. La suscripción Pro es opcional para dueños independientes.",
  },
  {
    q: "¿Funciona para bicicleterías?",
    a: "Sí. Elige industria «Tienda de bicicletas» y activas SmartBike: desgaste por kilómetros, carnet digital y protocolo de cierre.",
  },
  {
    q: "¿Cuánto tarda el setup?",
    a: "Menos de 10 minutos: creas cuenta, nombras el taller, copias el código de Telegram y envías la primera factura.",
  },
];

export function B2bFaq() {
  return (
    <section id="faq" className="border-t border-zinc-800/60 py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Preguntas frecuentes
        </h2>
        <dl className="space-y-6">
          {faqs.map(({ q, a }) => (
            <div key={q} className="glass rounded-2xl p-6">
              <dt className="font-semibold text-zinc-100">{q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-zinc-400">{a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
