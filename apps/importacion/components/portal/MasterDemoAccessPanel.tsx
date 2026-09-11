"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Copy,
  KeyRound,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";
import {
  activarDemoGenericoAction,
  cerrarAccesoDemoAction,
  type DemoGenericoEstado,
  type MasterPortalUserRow,
} from "@/app/actions/portal-master";
import {
  DEMO_DURACION_HORAS,
  DEMO_DURACION_LABELS,
  formatDemoExpiry,
  type DemoDuracionHoras,
} from "@/lib/portal/demo-access";

type Props = {
  demos: MasterPortalUserRow[];
  generico: DemoGenericoEstado;
};

const inputClass =
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500";
const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50";

export function MasterDemoAccessPanel({ demos, generico }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [duracionHoras, setDuracionHoras] = useState<DemoDuracionHoras>(24);

  const genericoEnLista = demos.find(
    (d) =>
      generico.email &&
      d.email?.toLowerCase() === generico.email.toLowerCase()
  );

  async function copyCreds() {
    if (!generico.email || !generico.password) return;
    const text = [
      `Usuario: ${generico.email}`,
      `Clave: ${generico.password}`,
      `Login: ${generico.loginPath}`,
      generico.expiresAt
        ? `Válido hasta: ${formatDemoExpiry(generico.expiresAt)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  }

  function activar() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await activarDemoGenericoAction({ duracionHoras });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `Demo abierta hasta ${formatDemoExpiry(result.expiresAt)}. Usuario y clave son siempre los mismos.`
      );
      router.refresh();
    });
  }

  function cerrar() {
    const userId = generico.userId ?? genericoEnLista?.userId;
    if (!userId) {
      setError("La cuenta demo aún no existe. Actívala primero.");
      return;
    }
    if (
      !confirm(
        "¿Cerrar la demo? Quienes estén dentro saldrán. El usuario y la clave siguen siendo los mismos para la próxima vez."
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await cerrarAccesoDemoAction(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Demo cerrada. Puedes reabrirla cuando quieras con las mismas credenciales.");
      router.refresh();
    });
  }

  return (
    <section className="mb-10 space-y-6">
      <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-cyan-200/90">
          <KeyRound className="h-4 w-4" />
          Acceso demo (usuario y clave fijos)
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Siempre el mismo correo y contraseña. Activas un tiempo de revisión y
          luego cierras la sesión. Al reabrir, las credenciales no cambian.
        </p>

        {error ? (
          <p
            className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {message ? (
          <p
            className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200"
            role="status"
          >
            {message}
          </p>
        ) : null}

        {!generico.configured ? (
          <div className="mt-4 rounded-xl border border-amber-700/40 bg-amber-950/30 p-4 text-sm text-amber-100">
            <p className="font-medium">Falta configurar el entorno</p>
            <p className="mt-1 text-xs text-amber-200/80">
              En Vercel (o `.env.local`) define{" "}
              <code className="font-mono text-amber-50">DEMO_EMAIL</code> y{" "}
              <code className="font-mono text-amber-50">DEMO_PASSWORD</code>{" "}
              (mín. 8 caracteres). Opcional:{" "}
              <code className="font-mono text-amber-50">
                NEXT_PUBLIC_DEMO_SHOW_ON_LOGIN=1
              </code>{" "}
              para mostrarlas en el login mientras la demo esté abierta.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 rounded-xl border border-zinc-700/60 bg-zinc-950/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Credenciales permanentes
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <dt className="text-zinc-500">Usuario</dt>
                  <dd className="font-mono text-zinc-100">{generico.email}</dd>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <dt className="text-zinc-500">Clave</dt>
                  <dd className="font-mono text-zinc-100">{generico.password}</dd>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <dt className="text-zinc-500">Login</dt>
                  <dd className="font-mono text-xs text-cyan-200">
                    {generico.loginPath}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <dt className="text-zinc-500">Estado</dt>
                  <dd
                    className={`inline-flex items-center gap-1 text-xs ${
                      generico.activo ? "text-emerald-300" : "text-zinc-400"
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {generico.activo
                      ? `Abierta hasta ${formatDemoExpiry(generico.expiresAt)}`
                      : generico.closedAt
                        ? "Cerrada — misma clave lista para reabrir"
                        : "Inactiva — actívala para permitir el acceso"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => void copyCreds()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copiado" : "Copiar usuario y clave"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block text-xs text-zinc-500">
                Tiempo de acceso
                <select
                  value={duracionHoras}
                  onChange={(e) =>
                    setDuracionHoras(Number(e.target.value) as DemoDuracionHoras)
                  }
                  className={`${inputClass} mt-1 w-40`}
                >
                  {DEMO_DURACION_HORAS.map((h) => (
                    <option key={h} value={h}>
                      {DEMO_DURACION_LABELS[h]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={activar}
                disabled={pending}
                className={buttonClass}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {generico.activo ? "Renovar acceso" : "Abrir demo"}
              </button>
              <button
                type="button"
                onClick={cerrar}
                disabled={pending || (!generico.userId && !genericoEnLista)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-800/50 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-950/70 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Cerrar sesión demo
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
