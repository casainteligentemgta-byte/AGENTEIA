"use client";

import { useState, useTransition } from "react";
import { upsertImportadorAction } from "@/app/actions/nfc/importadores";
import {
  IMPORTADOR_TIPO_LABELS,
  IMPORTADOR_TIPOS,
  type ImportadorTipo,
} from "@/lib/schemas/importador";
import { RIF_FORMAT_HINT, RIF_PLACEHOLDER } from "@/lib/validations/rif";

export type ImportadorFormValues = {
  id?: string;
  tipo: ImportadorTipo;
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
  direccion: string;
};

type Props = {
  initial?: Partial<ImportadorFormValues>;
  submitLabel?: string;
  onSaved: (importador: {
    id: string;
    tipo: ImportadorTipo;
    nombre: string;
    documento: string;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
  }) => void;
};

export function ImportadorForm({
  initial,
  submitLabel = "Guardar cliente",
  onSaved,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<ImportadorTipo>(initial?.tipo ?? "natural");
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [documento, setDocumento] = useState(initial?.documento ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [direccion, setDireccion] = useState(initial?.direccion ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertImportadorAction({
        id: initial?.id,
        tipo,
        nombre,
        documento,
        telefono,
        email,
        direccion,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.importador);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Tipo *</span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as ImportadorTipo)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
        >
          {IMPORTADOR_TIPOS.map((t) => (
            <option key={t} value={t}>
              {IMPORTADOR_TIPO_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">
          {tipo === "juridica" ? "Razón social *" : "Nombre completo *"}
        </span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">RIF *</span>
        <input
          value={documento}
          onChange={(e) => setDocumento(e.target.value.toUpperCase())}
          required
          placeholder={RIF_PLACEHOLDER}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 font-mono text-sm uppercase text-zinc-100 outline-none focus:border-cyan-500/60"
        />
        <span className="text-xs text-zinc-500">{RIF_FORMAT_HINT}</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm text-zinc-400">Teléfono</span>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm text-zinc-400">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Dirección fiscal</span>
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
      >
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
