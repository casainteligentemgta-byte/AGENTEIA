"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  crearExoneracionAction,
  revocarExoneracionAction,
} from "@/app/actions/pagos-admin";
import type { MasterTallerRow } from "@/app/actions/portal-master";

export type ExoneracionRow = {
  id: string;
  createdAt: string;
  tipo: string;
  perfilId: string | null;
  tallerId: string | null;
  tallerNombre: string | null;
  vigenteHasta: string | null;
  notas: string | null;
  activa: boolean;
};

const inputClass =
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500";

function tipoLabel(tipo: string): string {
  if (tipo === "perfil") return "Cliente (B2C)";
  if (tipo === "taller_clientes") return "Clientes del taller";
  return "Taller (USD 100)";
}

export function MasterExoneracionesPanel({
  talleres,
  rows,
}: {
  talleres: MasterTallerRow[];
  rows: ExoneracionRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<"perfil" | "taller_clientes" | "taller">("perfil");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function onCreate(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await crearExoneracionAction({
        tipo: formData.get("tipo"),
        email: String(formData.get("email") ?? ""),
        tallerId: String(formData.get("tallerId") ?? "") || undefined,
        vigenteHasta: String(formData.get("vigenteHasta") ?? ""),
        notas: String(formData.get("notas") ?? ""),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Exoneración guardada.");
    });
  }

  function onRevoke(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await revocarExoneracionAction(id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="mb-10 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Exoneraciones
      </h2>
      <p className="text-sm text-zinc-500">
        Exonera a un cliente del plan de USD 2.99, a todos los clientes de un taller, o al taller
        del plan de USD 100. Fecha de fin opcional.
      </p>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(new FormData(e.currentTarget));
        }}
        className="grid gap-3 rounded-2xl border border-zinc-800 p-4 sm:grid-cols-2"
      >
        <label className="text-xs text-zinc-400">
          Tipo
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            className={`${inputClass} mt-1`}
          >
            <option value="perfil">Cliente individual (B2C)</option>
            <option value="taller_clientes">Todos los clientes de un taller</option>
            <option value="taller">El taller (plan USD 100)</option>
          </select>
        </label>
        {tipo === "perfil" ? (
          <label className="text-xs text-zinc-400">
            Correo del cliente
            <input name="email" type="email" required className={`${inputClass} mt-1`} />
          </label>
        ) : (
          <label className="text-xs text-zinc-400">
            Taller
            <select name="tallerId" required className={`${inputClass} mt-1`}>
              <option value="">Selecciona…</option>
              {talleres.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs text-zinc-400">
          Vigente hasta (opcional)
          <input name="vigenteHasta" type="date" className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs text-zinc-400 sm:col-span-2">
          Notas
          <input name="notas" maxLength={1000} className={`${inputClass} mt-1`} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50 sm:col-span-2"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar exoneración
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Destino</th>
              <th className="px-3 py-2 font-medium">Hasta</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-zinc-800/80">
                <td className="px-3 py-2 text-zinc-200">{tipoLabel(row.tipo)}</td>
                <td className="px-3 py-2 text-zinc-400">
                  {row.tallerNombre ?? row.perfilId ?? "—"}
                  {row.notas ? <p className="text-xs text-zinc-600">{row.notas}</p> : null}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {row.vigenteHasta
                    ? new Date(row.vigenteHasta).toLocaleDateString("es-VE")
                    : "Sin vencimiento"}
                </td>
                <td className="px-3 py-2 text-zinc-300">{row.activa ? "Activa" : "Revocada"}</td>
                <td className="px-3 py-2">
                  {row.activa ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onRevoke(row.id)}
                      className="text-xs text-red-300 underline disabled:opacity-50"
                    >
                      Revocar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  Sin exoneraciones
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
