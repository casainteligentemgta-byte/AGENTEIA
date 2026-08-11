"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, UserRound } from "lucide-react";
import {
  setImportadorActivoAction,
  type ImportadorListItem,
} from "@/app/actions/nfc/importadores";
import { ImportadorForm } from "@/components/nfc/ImportadorForm";

type Props = {
  initialImportadores: ImportadorListItem[];
};

function toFormInitial(c: ImportadorListItem) {
  if (c.tipo === "natural") {
    return {
      id: c.id,
      tipo: "natural" as const,
      nombresApellidos: c.nombre,
      rif: c.documento,
      cedula: c.cedula ?? "",
      email: c.email ?? "",
      telefono: c.telefono ?? "",
      direccion: c.direccion ?? "",
      instagram: c.instagram ?? "",
    };
  }
  return {
    id: c.id,
    tipo: "juridica" as const,
    denominacionComercial: c.denominacionComercial ?? "",
    razonSocial: c.razonSocial ?? c.nombre,
    rif: c.documento,
    repLegalNombre: c.repLegalNombre ?? "",
    repLegalCedula: c.repLegalCedula ?? c.cedula ?? "",
    repLegalEmail: c.repLegalEmail ?? "",
    repLegalTelefono: c.repLegalTelefono ?? "",
    empresaTelefono: c.empresaTelefono ?? c.telefono ?? "",
    empresaEmail: c.empresaEmail ?? c.email ?? "",
    empresaDomicilio: c.empresaDomicilio ?? c.direccion ?? "",
    registroPuertoLibre: c.registroPuertoLibre ?? "",
    registroPlVence: c.registroPlVence ?? "",
  };
}

/**
 * Listado + alta/edición de clientes importadores del taller.
 */
export function ImportadoresClientesPanel({ initialImportadores }: Props) {
  const [clientes, setClientes] = useState(initialImportadores);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"lista" | "nuevo" | "editar">("lista");
  const [editing, setEditing] = useState<ImportadorListItem | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.documento.toLowerCase().includes(q) ||
        (c.cedula ?? "").toLowerCase().includes(q) ||
        (c.telefono ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.denominacionComercial ?? "").toLowerCase().includes(q) ||
        (c.razonSocial ?? "").toLowerCase().includes(q) ||
        (c.registroPuertoLibre ?? "").toLowerCase().includes(q)
    );
  }, [clientes, query]);

  function upsertLocal(item: ImportadorListItem) {
    setClientes((prev) => {
      const idx = prev.findIndex((c) => c.id === item.id);
      if (idx === -1) return [item, ...prev];
      const next = [...prev];
      next[idx] = item;
      return next.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    });
  }

  function toggleActivo(cliente: ImportadorListItem) {
    setError(null);
    startTransition(async () => {
      const result = await setImportadorActivoAction({
        importadorId: cliente.id,
        activo: !cliente.activo,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      upsertLocal(result.importador);
    });
  }

  if (mode === "nuevo" || mode === "editar") {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
            <UserRound className="h-5 w-5 text-cyan-400" />
            {mode === "nuevo" ? "Nuevo cliente" : "Editar cliente"}
          </h2>
          <button
            type="button"
            onClick={() => {
              setMode("lista");
              setEditing(null);
              setError(null);
            }}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Volver al listado
          </button>
        </div>
        <ImportadorForm
          key={editing?.id ?? "nuevo"}
          initial={editing ? toFormInitial(editing) : undefined}
          submitLabel={mode === "nuevo" ? "Guardar cliente" : "Guardar cambios"}
          onSaved={(imp) => {
            upsertLocal({
              ...imp,
              tipoLabel:
                imp.tipo === "natural" ? "Persona natural" : "Persona jurídica",
              activo: editing?.activo ?? true,
              createdAt: editing?.createdAt ?? new Date().toISOString(),
            });
            setMode("lista");
            setEditing(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, RIF, cédula, registro PL…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-3 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setMode("nuevo");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-12 text-center">
          <UserRound className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-zinc-300">No hay clientes</p>
          <p className="mt-1 text-sm text-zinc-500">
            Registra importadores naturales o jurídicos antes de crear una
            importación.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-50">{c.nombre}</p>
                  <p className="mt-0.5 font-mono text-xs text-zinc-400">
                    RIF {c.documento}
                    {c.cedula ? ` · CI ${c.cedula}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {c.tipoLabel}
                    {c.tipo === "juridica" && c.registroPuertoLibre
                      ? ` · PL ${c.registroPuertoLibre}`
                      : ""}
                    {c.telefono ? ` · ${c.telefono}` : ""}
                    {!c.activo ? " · Inactivo" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(c);
                      setMode("editar");
                    }}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggleActivo(c)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
                  >
                    {c.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
