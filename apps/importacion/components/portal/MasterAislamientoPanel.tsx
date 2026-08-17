"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Archive, Loader2, RotateCcw, Trash2 } from "lucide-react";
import {
  aislarTallerAction,
  restaurarTallerAction,
  borrarTallerDefinitivoAction,
  aislarPortalUsuarioAction,
  restaurarPortalUsuarioAction,
  borrarPortalUsuarioDefinitivoAction,
  type MasterTallerRow,
  type MasterPortalUserRow,
} from "@/app/actions/portal-master";

type Props = {
  talleresActivos: MasterTallerRow[];
  talleresAislados: MasterTallerRow[];
  usuariosActivos: MasterPortalUserRow[];
  usuariosAislados: MasterPortalUserRow[];
};

function formatRoles(roles: string[]): string {
  if (roles.length === 0) return "—";
  return roles.join(", ");
}

function tipoLabel(tipo: string | null): string {
  if (tipo === "concesionario") return "Concesionario";
  if (tipo === "taller") return "Taller";
  return tipo ?? "Taller";
}

export function MasterAislamientoPanel({
  talleresActivos,
  talleresAislados,
  usuariosActivos,
  usuariosAislados,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, okMsg: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(okMsg);
    });
  }

  return (
    <div className="space-y-10">
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Talleres y concesionarios ({talleresActivos.length})
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          Aislar oculta la entidad al resto. Solo el máster la ve aquí hasta restaurar o borrar.
        </p>
        <EntityTable
          empty="Sin talleres activos"
          headers={["Nombre", "Tipo", "Dueño", "Vehículos", ""]}
          rows={talleresActivos.map((t) => ({
            key: t.id,
            cells: [
              t.nombre,
              tipoLabel(t.tipoIndustria),
              t.ownerEmail ?? t.ownerUserId.slice(0, 8),
              String(t.vehiculosCount),
            ],
            actions: (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (
                    !confirm(
                      `¿Aislar «${t.nombre}»? Dejará de ser visible para el resto del sistema.`
                    )
                  ) {
                    return;
                  }
                  run(() => aislarTallerAction(t.id), `«${t.nombre}» aislado.`);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-800/50 bg-amber-950/40 px-2.5 py-1.5 text-xs text-amber-100 hover:bg-amber-950/70 disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                Aislar
              </button>
            ),
          }))}
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Administradores y usuarios ({usuariosActivos.length})
        </h2>
        <EntityTable
          empty="Sin accesos de portal activos"
          headers={["Correo", "Roles", "Organización", ""]}
          rows={usuariosActivos.map((u) => ({
            key: u.userId,
            cells: [
              u.email ?? u.userId.slice(0, 8),
              formatRoles(u.roles),
              u.orgNombre ?? "—",
            ],
            actions: u.roles.includes("master") ? (
              <span className="text-xs text-zinc-600">Máster</span>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (
                    !confirm(
                      `¿Aislar el acceso de ${u.email ?? "este usuario"}? No podrá usar portales.`
                    )
                  ) {
                    return;
                  }
                  run(
                    () => aislarPortalUsuarioAction(u.userId),
                    `Acceso de ${u.email ?? "usuario"} aislado.`
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-800/50 bg-amber-950/40 px-2.5 py-1.5 text-xs text-amber-100 hover:bg-amber-950/70 disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                Aislar
              </button>
            ),
          }))}
        />
      </section>

      <section className="rounded-2xl border border-dashed border-zinc-700/80 bg-zinc-950/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-300/90">
          Aislamiento ({talleresAislados.length + usuariosAislados.length})
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Solo visible para el administrador máster. Puedes restaurar o borrar de forma definitiva.
        </p>

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Talleres / concesionarios aislados
        </h3>
        <EntityTable
          empty="Ninguno aislado"
          headers={["Nombre", "Tipo", "Dueño", "Aislado", ""]}
          rows={talleresAislados.map((t) => ({
            key: t.id,
            cells: [
              t.nombre,
              tipoLabel(t.tipoIndustria),
              t.ownerEmail ?? "—",
              t.aisladoAt ? new Date(t.aisladoAt).toLocaleString("es-CO") : "—",
            ],
            actions: (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => restaurarTallerAction(t.id), `«${t.nombre}» restaurado.`)
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-1.5 text-xs text-emerald-100 hover:bg-emerald-950/70 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !confirm(
                        `¿Borrar DEFINITIVAMENTE «${t.nombre}» y sus vehículos? Esta acción no se puede deshacer.`
                      )
                    ) {
                      return;
                    }
                    run(
                      () => borrarTallerDefinitivoAction(t.id),
                      `«${t.nombre}» eliminado definitivamente.`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-950/70 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Borrar
                </button>
              </div>
            ),
          }))}
        />

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Administradores / usuarios aislados
        </h3>
        <EntityTable
          empty="Ninguno aislado"
          headers={["Correo", "Roles", "Aislado", ""]}
          rows={usuariosAislados.map((u) => ({
            key: u.userId,
            cells: [
              u.email ?? u.userId.slice(0, 8),
              formatRoles(u.roles),
              u.aisladoAt ? new Date(u.aisladoAt).toLocaleString("es-CO") : "—",
            ],
            actions: (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => restaurarPortalUsuarioAction(u.userId),
                      `Acceso de ${u.email ?? "usuario"} restaurado.`
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-1.5 text-xs text-emerald-100 hover:bg-emerald-950/70 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !confirm(
                        `¿Borrar DEFINITIVAMENTE el acceso de portal de ${u.email ?? "este usuario"}?`
                      )
                    ) {
                      return;
                    }
                    run(
                      () => borrarPortalUsuarioDefinitivoAction(u.userId),
                      `Acceso de ${u.email ?? "usuario"} eliminado.`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-950/70 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Borrar
                </button>
              </div>
            ),
          }))}
        />
      </section>
    </div>
  );
}

function EntityTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  empty: string;
  rows: {
    key: string;
    cells: string[];
    actions: ReactNode;
  }[];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-900 text-zinc-500">
          <tr>
            {headers.map((h) => (
              <th key={h || "actions"} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-zinc-800/80">
              {row.cells.map((cell, i) => (
                <td
                  key={`${row.key}-${i}`}
                  className={`px-3 py-2 ${i === 0 ? "text-zinc-100" : "text-zinc-400"}`}
                >
                  {cell}
                </td>
              ))}
              <td className="px-3 py-2">{row.actions}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-3 py-6 text-center text-zinc-500"
              >
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
