"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, UserPlus } from "lucide-react";
import {
  crearPortalAccesoPorEmailAction,
  updatePortalAccesoAction,
  updateTallerEtiquetaAction,
  type MasterPortalUserRow,
  type MasterTallerRow,
} from "@/app/actions/portal-master";
import {
  PORTAL_META,
  PORTAL_ROLES,
  ROLES_CON_ALCANCE,
  type PortalRole,
} from "@/lib/portal/catalog";
import {
  INDUSTRIA_LABELS,
  TIPOS_INDUSTRIA,
  type TipoIndustria,
} from "@/lib/platform/types";

type Props = {
  currentUserId: string;
  usuarios: MasterPortalUserRow[];
  talleres: MasterTallerRow[];
};

const inputClass =
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500";
const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50";

function asPortalRoles(roles: string[]): PortalRole[] {
  return roles.filter((role): role is PortalRole =>
    (PORTAL_ROLES as readonly string[]).includes(role)
  );
}

function needsScope(roles: readonly string[]): boolean {
  return roles.some((role) =>
    (ROLES_CON_ALCANCE as readonly string[]).includes(role)
  );
}

export function MasterRolesPanel({ currentUserId, usuarios, talleres }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function onResult(result: { ok: true } | { ok: false; error: string }, okMsg: string) {
    if (!result.ok) {
      setMessage(null);
      setError(result.error);
      return false;
    }
    setError(null);
    setMessage(okMsg);
    return true;
  }

  return (
    <div className="mb-10 space-y-8">
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200" role="status">
          {message}
        </p>
      ) : null}

      <GrantAccessForm
        talleres={talleres}
        onResult={onResult}
      />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Roles y etiquetas de usuarios ({usuarios.length})
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          El máster asigna roles, visión global, talleres y la etiqueta de organización.
        </p>
        <div className="mt-4 space-y-4">
          {usuarios.length === 0 ? (
            <p className="rounded-2xl border border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
              Nadie tiene fila en portal_accesos todavía. Crea un acceso con el correo.
            </p>
          ) : (
            usuarios.map((user) => (
              <UserAccessEditor
                key={user.userId}
                user={user}
                talleres={talleres}
                isSelf={user.userId === currentUserId}
                onResult={onResult}
              />
            ))
          )}
        </div>
      </section>

      <TallerEtiquetasSection talleres={talleres} onResult={onResult} />
    </div>
  );
}

function GrantAccessForm({
  talleres,
  onResult,
}: {
  talleres: MasterTallerRow[];
  onResult: (
    result: { ok: true } | { ok: false; error: string },
    okMsg: string
  ) => boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [orgNombre, setOrgNombre] = useState("");
  const [roles, setRoles] = useState<PortalRole[]>(["usuario"]);
  const [verTodo, setVerTodo] = useState(false);
  const [tallerIds, setTallerIds] = useState<string[]>([]);

  function submit() {
    startTransition(async () => {
      const result = await crearPortalAccesoPorEmailAction({
        email,
        roles,
        verTodo,
        tallerIds,
        orgNombre: orgNombre.trim() || null,
      });
      if (onResult(result, `Acceso actualizado para ${email.trim()}.`)) {
        setEmail("");
        setOrgNombre("");
        setRoles(["usuario"]);
        setVerTodo(false);
        setTallerIds([]);
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        <UserPlus className="h-4 w-4" />
        Dar o actualizar acceso
      </h2>
      <p className="mt-1 text-xs text-zinc-600">
        El correo debe existir en Auth. Si ya tiene acceso, se actualiza.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block text-xs text-zinc-500">
          Correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Etiqueta de organización
          <input
            value={orgNombre}
            onChange={(e) => setOrgNombre(e.target.value)}
            maxLength={80}
            placeholder="Ej. Aduana Principal"
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      <RoleFields
        roles={roles}
        verTodo={verTodo}
        tallerIds={tallerIds}
        talleres={talleres}
        lockMaster={false}
        onRolesChange={setRoles}
        onVerTodoChange={setVerTodo}
        onTallerIdsChange={setTallerIds}
      />
      <div className="mt-4">
        <button type="button" onClick={submit} disabled={pending} className={buttonClass}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar acceso
        </button>
      </div>
    </section>
  );
}

function UserAccessEditor({
  user,
  talleres,
  isSelf,
  onResult,
}: {
  user: MasterPortalUserRow;
  talleres: MasterTallerRow[];
  isSelf: boolean;
  onResult: (
    result: { ok: true } | { ok: false; error: string },
    okMsg: string
  ) => boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [orgNombre, setOrgNombre] = useState(user.orgNombre ?? "");
  const [roles, setRoles] = useState<PortalRole[]>(asPortalRoles(user.roles));
  const [verTodo, setVerTodo] = useState(user.verTodo);
  const [tallerIds, setTallerIds] = useState<string[]>(user.tallerIds);

  function submit() {
    startTransition(async () => {
      const result = await updatePortalAccesoAction({
        userId: user.userId,
        roles,
        verTodo,
        tallerIds,
        orgNombre: orgNombre.trim() || null,
      });
      if (onResult(result, `Roles actualizados para ${user.email ?? "el usuario"}.`)) {
        router.refresh();
      }
    });
  }

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-zinc-100">{user.email ?? user.userId.slice(0, 8)}</h3>
          {isSelf ? (
            <p className="text-xs text-amber-300/80">Tu cuenta. No puedes quitarte máster ni ver_todo.</p>
          ) : null}
        </div>
      </div>
      <label className="mt-4 block text-xs text-zinc-500">
        Etiqueta de organización
        <input
          value={orgNombre}
          onChange={(e) => setOrgNombre(e.target.value)}
          maxLength={80}
          className={`${inputClass} mt-1 max-w-md`}
        />
      </label>
      <RoleFields
        roles={roles}
        verTodo={verTodo}
        tallerIds={tallerIds}
        talleres={talleres}
        lockMaster={isSelf}
        onRolesChange={setRoles}
        onVerTodoChange={setVerTodo}
        onTallerIdsChange={setTallerIds}
      />
      <div className="mt-4">
        <button type="button" onClick={submit} disabled={pending} className={buttonClass}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
      </div>
    </article>
  );
}

function RoleFields({
  roles,
  verTodo,
  tallerIds,
  talleres,
  lockMaster,
  onRolesChange,
  onVerTodoChange,
  onTallerIdsChange,
}: {
  roles: PortalRole[];
  verTodo: boolean;
  tallerIds: string[];
  talleres: MasterTallerRow[];
  lockMaster: boolean;
  onRolesChange: (roles: PortalRole[]) => void;
  onVerTodoChange: (value: boolean) => void;
  onTallerIdsChange: (ids: string[]) => void;
}) {
  function toggleRole(role: PortalRole) {
    if (lockMaster && role === "master" && roles.includes("master")) return;
    if (roles.includes(role)) {
      onRolesChange(roles.filter((item) => item !== role));
      return;
    }
    onRolesChange([...roles, role]);
  }

  function toggleTaller(id: string) {
    if (tallerIds.includes(id)) {
      onTallerIdsChange(tallerIds.filter((item) => item !== id));
      return;
    }
    onTallerIdsChange([...tallerIds, id]);
  }

  return (
    <div className="mt-4 space-y-4">
      <fieldset>
        <legend className="text-xs font-medium text-zinc-500">Roles</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PORTAL_ROLES.map((role) => (
            <label
              key={role}
              className="flex cursor-pointer items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={roles.includes(role)}
                disabled={lockMaster && role === "master"}
                onChange={() => toggleRole(role)}
              />
              <span>
                <span className="block font-medium">{PORTAL_META[role].title}</span>
                <span className="block text-xs text-zinc-500">{role}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {needsScope(roles) ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={verTodo}
            disabled={lockMaster && verTodo}
            onChange={(e) => onVerTodoChange(e.target.checked)}
          />
          Visión global (ver_todo)
        </label>
      ) : null}

      <fieldset>
        <legend className="text-xs font-medium text-zinc-500">
          Talleres asignados
        </legend>
        {talleres.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-600">No hay talleres activos.</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {talleres.map((taller) => (
              <label
                key={taller.id}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300"
              >
                <input
                  type="checkbox"
                  checked={tallerIds.includes(taller.id)}
                  onChange={() => toggleTaller(taller.id)}
                />
                <span>
                  {taller.nombre}
                  <span className="ml-1 text-xs text-zinc-600">
                    {taller.tipoIndustria
                      ? INDUSTRIA_LABELS[
                          taller.tipoIndustria as TipoIndustria
                        ] ?? taller.tipoIndustria
                      : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}

function TallerEtiquetasSection({
  talleres,
  onResult,
}: {
  talleres: MasterTallerRow[];
  onResult: (
    result: { ok: true } | { ok: false; error: string },
    okMsg: string
  ) => boolean;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Etiquetas de industria ({talleres.length})
      </h2>
      <p className="mt-1 text-xs text-zinc-600">
        Concesionario, tienda de bicicletas o constructora. No es un rol de persona.
      </p>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Taller</th>
              <th className="px-3 py-2 font-medium">Etiqueta</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {talleres.map((taller) => (
              <TallerEtiquetaRow
                key={taller.id}
                taller={taller}
                onResult={onResult}
              />
            ))}
            {talleres.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-zinc-500">
                  Sin talleres activos
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TallerEtiquetaRow({
  taller,
  onResult,
}: {
  taller: MasterTallerRow;
  onResult: (
    result: { ok: true } | { ok: false; error: string },
    okMsg: string
  ) => boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial: TipoIndustria = TIPOS_INDUSTRIA.includes(
    taller.tipoIndustria as TipoIndustria
  )
    ? (taller.tipoIndustria as TipoIndustria)
    : "concesionario";
  const [tipo, setTipo] = useState<TipoIndustria>(initial);

  function submit() {
    startTransition(async () => {
      const result = await updateTallerEtiquetaAction({
        tallerId: taller.id,
        tipoIndustria: tipo,
      });
      if (onResult(result, `Etiqueta de «${taller.nombre}» actualizada.`)) {
        router.refresh();
      }
    });
  }

  return (
    <tr className="border-t border-zinc-800/80">
      <td className="px-3 py-2 text-zinc-100">{taller.nombre}</td>
      <td className="px-3 py-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoIndustria)}
          aria-label={`Etiqueta de industria de ${taller.nombre}`}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
        >
          {TIPOS_INDUSTRIA.map((item) => (
            <option key={item} value={item}>
              {INDUSTRIA_LABELS[item]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <button type="button" onClick={submit} disabled={pending} className={buttonClass}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
        </button>
      </td>
    </tr>
  );
}
