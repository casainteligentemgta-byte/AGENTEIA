"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  asignarExpedientePropietarioAction,
  type ExpedienteAsignable,
} from "@/app/actions/nfc/propietarios";

type Props = {
  propietarioId: string;
  expedientes: ExpedienteAsignable[];
  /** Preselecciona este expediente (viene de la cola). */
  preselectVehiculoId?: string | null;
};

export function PropietarioAsignarExpediente({
  propietarioId,
  expedientes,
  preselectVehiculoId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [vehiculoId, setVehiculoId] = useState(preselectVehiculoId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const asignados = useMemo(
    () => expedientes.filter((e) => e.propietarioId === propietarioId),
    [expedientes, propietarioId]
  );
  const disponibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expedientes
      .filter((e) => e.propietarioId !== propietarioId)
      .filter((e) => {
        if (!q) return true;
        const hay = `${e.codigoExpediente} ${e.marca ?? ""} ${e.modelo ?? ""} ${e.nombreCliente ?? ""}`;
        return hay.toLowerCase().includes(q);
      });
  }, [expedientes, propietarioId, query]);

  function asignar(id: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await asignarExpedientePropietarioAction({
        propietarioId,
        vehiculoId: id,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage("Expediente asignado a esta ficha");
      setVehiculoId("");
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">
          Expedientes de este propietario
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Al asignar se copian nombre, cédula y contacto al expediente.
        </p>
      </div>

      {asignados.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aún no hay expedientes enlazados.
        </p>
      ) : (
        <ul className="space-y-2">
          {asignados.map((e) => (
            <li key={e.id}>
              <Link
                href={`/smartimport/${e.id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 hover:border-cyan-700/40"
              >
                <span className="font-mono text-sm text-zinc-100">
                  {e.codigoExpediente}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-400">
                  {[e.marca, e.modelo].filter(Boolean).join(" ") || "Vehículo"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
        <p className="text-sm font-medium text-zinc-200">Asignar expediente</p>
        <label className="mt-3 block">
          <span className="sr-only">Filtrar expedientes</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por expediente, marca…"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-700/50 focus:outline-none"
          />
        </label>
        <label className="mt-2 block">
          <span className="sr-only">Expediente</span>
          <select
            value={vehiculoId}
            onChange={(e) => setVehiculoId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
          >
            <option value="">Elegir expediente…</option>
            {disponibles.map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigoExpediente}
                {e.marca ? ` · ${e.marca}` : ""}
                {e.modelo ? ` ${e.modelo}` : ""}
                {e.propietarioId ? " · ya tiene ficha" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !vehiculoId}
          onClick={() => asignar(vehiculoId)}
          className="mt-3 inline-flex rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {pending ? "Asignando…" : "Asignar a esta ficha"}
        </button>
      </div>
    </section>
  );
}
