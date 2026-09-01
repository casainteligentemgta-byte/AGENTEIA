"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Plus, Search, Trash2, UserRound } from "lucide-react";
import {
  deleteImportadorAction,
  type ImportadorListItem,
} from "@/app/actions/nfc/importadores";
import { ImportadorFicha } from "@/components/nfc/ImportadorFicha";
import { ImportadorForm } from "@/components/nfc/ImportadorForm";
import { formatImportadorDocumentoLine } from "@/lib/schemas/importador";

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
  const [mode, setMode] = useState<"lista" | "nuevo" | "editar" | "ficha">(
    "lista"
  );
  const [editing, setEditing] = useState<ImportadorListItem | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  function borrarCliente(cliente: ImportadorListItem) {
    setError(null);
    setDeletingId(cliente.id);
    startTransition(async () => {
      const result = await deleteImportadorAction({
        importadorId: cliente.id,
      });
      setDeletingId(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setClientes((prev) => prev.filter((c) => c.id !== cliente.id));
      if (editing?.id === cliente.id) {
        setEditing(null);
        setMode("lista");
      }
    });
  }

  if (mode === "ficha" && editing) {
    return (
      <ImportadorFicha
        cliente={editing}
        onBack={() => {
          setEditing(null);
          setMode("lista");
        }}
        onEdit={() => setMode("editar")}
      />
    );
  }

  if (mode === "nuevo" || mode === "editar") {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (mode === "editar" && editing) {
                setMode("ficha");
                return;
              }
              setEditing(null);
              setMode("lista");
            }}
            className="inline-flex rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
            <UserRound className="h-5 w-5 text-cyan-400" />
            {mode === "nuevo" ? "Nuevo cliente" : "Editar cliente"}
          </h2>
        </div>
        <ImportadorForm
          key={editing?.id ?? "nuevo"}
          initial={editing ? toFormInitial(editing) : undefined}
          initialDocumentos={editing?.documentos}
          submitLabel={mode === "nuevo" ? "Guardar cliente" : "Guardar cambios"}
          onSaved={(imp) => {
            const item: ImportadorListItem = {
              ...imp,
              tipoLabel:
                imp.tipo === "natural" ? "Persona natural" : "Persona jurídica",
              documentos: imp.documentos ?? editing?.documentos ?? {},
              activo: editing?.activo ?? true,
              createdAt: editing?.createdAt ?? new Date().toISOString(),
            };
            upsertLocal(item);
            setEditing(item);
            setMode("ficha");
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
          {filtrados.map((c) => {
            const isDeleting = pending && deletingId === c.id;
            return (
              <li
                key={c.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(c);
                      setMode("ficha");
                    }}
                    className="min-w-0 flex-1 rounded-lg text-left transition hover:opacity-90"
                  >
                    <p className="text-sm font-semibold text-zinc-50">
                      {c.nombre}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-zinc-400">
                      {formatImportadorDocumentoLine(c)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {c.tipoLabel}
                      {c.tipo === "juridica" && c.registroPuertoLibre
                        ? ` · PL ${c.registroPuertoLibre}`
                        : ""}
                      {c.telefono ? ` · ${c.telefono}` : ""}
                      {!c.activo ? " · Inactivo" : ""}
                    </p>
                    <span className="mt-2 inline-block text-xs font-medium text-cyan-400">
                      Ver ficha
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => borrarCliente(c)}
                    aria-label={`Borrar ${c.nombre}`}
                    title="Borrar cliente"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 transition hover:border-rose-400/50 hover:bg-rose-500/20 hover:text-rose-100 disabled:opacity-50"
                  >
                    <Trash2
                      className={`h-4 w-4 ${isDeleting ? "animate-pulse" : ""}`}
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
