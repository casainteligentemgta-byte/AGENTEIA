import { getDemoLoginHintAction } from "@/app/actions/portal-master";

/** Muestra usuario/clave fijos en login solo si la demo está abierta y el flag público está activo. */
export async function DemoLoginHint() {
  const hint = await getDemoLoginHintAction();
  if (!hint) return null;

  return (
    <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm leading-relaxed text-cyan-100">
      <p className="font-medium text-cyan-50">Acceso demo</p>
      <p className="mt-1 font-mono text-xs">
        Usuario: {hint.email}
        <br />
        Clave: {hint.password}
      </p>
    </div>
  );
}
