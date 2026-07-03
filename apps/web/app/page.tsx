/** Página mínima: solo HTML del servidor. Si no ves el texto, el fallo no es del código. */
export default function Page() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0a",
        color: "#fafafa",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Agente IA</h1>
      <p style={{ marginBottom: 8 }}>Si ves este texto, la app responde.</p>
      <p>
        <a href="/test" style={{ color: "#22c55e" }}>
          Ir a /test
        </a>
      </p>
    </div>
  );
}
