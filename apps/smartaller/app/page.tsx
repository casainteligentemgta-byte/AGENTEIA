export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 640 }}>
      <h1>SmartTaller</h1>
      <p style={{ color: "#555", marginTop: "0.5rem" }}>
        Gestión inteligente de mantenimientos para talleres mecánicos.
      </p>
      <p style={{ marginTop: "1.5rem" }}>
        Webhook activo en <code>/api/telegram-webhook</code> (alias{" "}
        <code>/api/webhook-telegram</code>). Envía fotos de facturas al bot de Telegram
        para registrar mantenimientos automáticamente.
      </p>
    </main>
  );
}
