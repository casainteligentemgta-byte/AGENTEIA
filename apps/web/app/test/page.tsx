/** Ruta de diagnóstico: solo servidor, sin JavaScript. Si ves este texto, Next.js responde bien. */
export default function TestPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fafafa",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Prueba OK</h1>
      <p>Si ves esta página, Next.js está funcionando. El servidor responde.</p>
      <p style={{ marginTop: 16 }}>
        <a href="/" style={{ color: "#22c55e" }}>
          Volver al inicio →
        </a>
      </p>
    </div>
  );
}
