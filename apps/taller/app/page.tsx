export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 640 }}>
      <h1>Taller — Mantenimientos</h1>
      <p>
        Webhook activo en{" "}
        <code>/api/telegram-webhook</code> (y alias <code>/api/webhook-telegram</code>).
        Envía fotos de facturas al bot de Telegram para registrar mantenimientos automáticamente.
      </p>
    </main>
  );
}
