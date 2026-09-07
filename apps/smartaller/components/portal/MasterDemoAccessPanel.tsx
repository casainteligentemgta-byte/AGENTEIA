"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Copy, KeyRound, Loader2, XCircle } from "lucide-react";
import {
  cerrarAccesoDemoAction,
  crearAccesoDemoAction,
  renovarAccesoDemoAction,
  type MasterPortalUserRow,
} from "@/app/actions/portal-master";
import {
  DEMO_DURACION_HORAS,
  DEMO_DURACION_LABELS,
  DEMO_ROLES_PERMITIDOS,
  formatDemoExpiry,
  isDemoExpired,
  type DemoDuracionHoras,
  type DemoRolePermitido,
} from "@/lib/portal/demo-access";
import { PORTAL_META } from "@/lib/portal/catalog";

type Props = {
  demos: MasterPortalUserRow[];
};

const inputClass =
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500";
const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50";

type Credenciales = {
  email: string;
  password: string;
  expiresAt: string;
  loginPath: string;
};

export function MasterDemoAccessPanel({ demos }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);
  const [copied, setCopied] = useState(false);

  const [email, setEmail] = useState("");
  const [orgNombre, setOrgNombre] = useState("");
  const [duracionHoras, setDuracionHoras] = useState<DemoDuracionHoras>(24);
  const [roles, setRoles] = useState<DemoRolePermitido[]>(["concesionario"]);
  const [passwordCustom, setPasswordCustom] = useState("");

  const activas = demos.filter((d) => !d.aisladoAt && !d.demoClosedAt);
  const cerradas = demos.filter((d) => d.aisladoAt || d.demoClosedAt);

  function toggleRole(role: DemoRolePermitido) {
    if (roles.includes(role)) {
      if (roles.length === 1) return;
      setRoles(roles.filter((r) => r !== role));
      return;
    }
    setRoles([...roles, role]);
  }

  function crear() {
    setError(null);
    setMessage(null);
    setCredenciales(null);
    startTransition(async () => {
      const result = await crearAccesoDemoAction({
        email,
        duracionHoras,
        roles,
        orgNombre: orgNombre.trim() || null,
        password: passwordCustom.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCredenciales({
        email: result.email,
        password: result.password,
        expiresAt: result.expiresAt,
        loginPath: result.loginPath,
      });
      setMessage(
        "Cuenta demo creada. Copia usuario y clave ahora: la clave no se vuelve a mostrar."
      );
      setEmail("");
      setOrgNombre("");
      setPasswordCustom("");
      router.refresh();
    });
  }

  async function copyCreds() {
    if (!credenciales) return;
    const text = [
      `Usuario: ${credenciales.email}`,
      `Clave: ${credenciales.password}`,
      `Válido hasta: ${formatDemoExpiry(credenciales.expiresAt)}`,
      `Login: ${credenciales.loginPath}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  }

  function cerrar(userId: string, label: string) {
    if (
      !confirm(
        `¿Cerrar la demo de ${label}? Se invalidará la sesión y no podrá volver a entrar.`
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
      setMessage(`Demo de ${label} cerrada.`);
      router.refresh();
    });
  }

  function renovar(userId: string, horas: DemoDuracionHoras, label: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await renovarAccesoDemoAction({
        userId,
        duracionHoras: horas,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Demo de ${label} renovada por ${DEMO_DURACION_LABELS[horas]}.`);
      router.refresh();
    });
  }

  return (
    <section className="mb-10 space-y-6">
      <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-cyan-200/90">
          <KeyRound className="h-4 w-4" />
          Acceso demo temporal
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Crea usuario y clave para que alguien revise la app un tiempo. Al
          cerrar, se corta la sesión y se bloquea el login. El espacio es propio
          (no ve expedientes de otros).
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

        {credenciales ? (
          <div className="mt-4 rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90">
              Credenciales (cópialas ahora)
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <dt className="text-zinc-500">Usuario</dt>
                <dd className="font-mono text-zinc-100">{credenciales.email}</dd>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <dt className="text-zinc-500">Clave</dt>
                <dd className="font-mono text-zinc-100">{credenciales.password}</dd>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <dt className="text-zinc-500">Válido hasta</dt>
                <dd className="text-zinc-200">
                  {formatDemoExpiry(credenciales.expiresAt)}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <dt className="text-zinc-500">Login</dt>
                <dd className="font-mono text-xs text-cyan-200">
                  {credenciales.loginPath}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => void copyCreds()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-700/50 bg-amber-950/50 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-950/80"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copiado" : "Copiar todo"}
            </button>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="block text-xs text-zinc-500">
            Correo demo
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente.demo@ejemplo.com"
              autoComplete="off"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Etiqueta (organización)
            <input
              value={orgNombre}
              onChange={(e) => setOrgNombre(e.target.value)}
              maxLength={80}
              placeholder="Piloto Cliente X"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Tiempo de acceso
            <select
              value={duracionHoras}
              onChange={(e) =>
                setDuracionHoras(Number(e.target.value) as DemoDuracionHoras)
              }
              className={`${inputClass} mt-1`}
            >
              {DEMO_DURACION_HORAS.map((h) => (
                <option key={h} value={h}>
                  {DEMO_DURACION_LABELS[h]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-500">
            Clave (opcional; si vacío se genera)
            <input
              type="text"
              value={passwordCustom}
              onChange={(e) => setPasswordCustom(e.target.value)}
              minLength={8}
              autoComplete="off"
              placeholder="Dejar vacío para generar"
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-zinc-500">Roles demo</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DEMO_ROLES_PERMITIDOS.map((role) => (
              <label
                key={role}
                className="flex cursor-pointer items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={roles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                <span>
                  <span className="block font-medium">
                    {PORTAL_META[role].title}
                  </span>
                  <span className="block text-xs text-zinc-500">{role}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <button
            type="button"
            onClick={crear}
            disabled={pending || !email.trim()}
            className={buttonClass}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Crear usuario demo
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Demos activas ({activas.length})
        </h3>
        {activas.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Ninguna demo activa.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {activas.map((demo) => {
              const expired = isDemoExpired(demo.demoExpiresAt);
              return (
                <li
                  key={demo.userId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-zinc-100">
                      {demo.email ?? demo.userId.slice(0, 8)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {demo.orgNombre ?? "—"} · roles: {demo.roles.join(", ")}
                    </p>
                    <p
                      className={`mt-1 inline-flex items-center gap-1 text-xs ${
                        expired ? "text-red-300" : "text-zinc-400"
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {expired
                        ? "Caducada — cierra o renueva"
                        : `Hasta ${formatDemoExpiry(demo.demoExpiresAt)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      aria-label="Renovar duración"
                      defaultValue=""
                      disabled={pending}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (
                          (DEMO_DURACION_HORAS as readonly number[]).includes(v)
                        ) {
                          renovar(
                            demo.userId,
                            v as DemoDuracionHoras,
                            demo.email ?? "demo"
                          );
                        }
                        e.target.value = "";
                      }}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                    >
                      <option value="" disabled>
                        Renovar…
                      </option>
                      {DEMO_DURACION_HORAS.map((h) => (
                        <option key={h} value={h}>
                          + {DEMO_DURACION_LABELS[h]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        cerrar(demo.userId, demo.email ?? "esta demo")
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-100 hover:bg-red-950/70 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cerrar sesión
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {cerradas.length > 0 ? (
        <p className="text-xs text-zinc-600">
          {cerradas.length} demo(s) cerrada(s) o aislada(s). Puedes borrarlas
          desde Aislamiento si ya no las necesitas.
        </p>
      ) : null}
    </section>
  );
}
