"use client";

import { ArrowLeft, Pencil, UserRound } from "lucide-react";
import type { ImportadorListItem } from "@/app/actions/nfc/importadores";
import { ImportadorDocShareButtons } from "@/components/nfc/ImportadorDocShareButtons";
import { importadorFichaDatos } from "@/lib/importadores/ficha-datos";

type Props = {
  cliente: ImportadorListItem;
  onBack: () => void;
  onEdit: () => void;
};

export function ImportadorFicha({ cliente, onBack, onEdit }: Props) {
  const datos = importadorFichaDatos(cliente);
  const cedulaLabel =
    cliente.tipo === "juridica" ? "Cédula del representante" : "Cédula";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
          aria-label="Volver a clientes"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-zinc-50">
          <UserRound className="h-5 w-5 shrink-0 text-cyan-400" />
          <span className="truncate">Ficha del cliente</span>
        </h2>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
        <p className="text-xl font-semibold text-zinc-50">{cliente.nombre}</p>
        <p className="mt-1 text-xs text-zinc-500">{cliente.tipoLabel}</p>
        <dl className="mt-4 space-y-2.5">
          {datos.map((d) => (
            <div key={d.label}>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">
                {d.label}
              </dt>
              <dd className="text-sm text-zinc-100">{d.value}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onEdit}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-500"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-200">Documentos</h3>
        <p className="text-xs text-zinc-500">
          Visualiza o comparte la cédula y el RIF desde aquí.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <ImportadorDocShareButtons
            label={cedulaLabel}
            doc={cliente.documentos?.cedula}
            shareTitle={`${cedulaLabel} · ${cliente.nombre}`}
          />
          <ImportadorDocShareButtons
            label="RIF"
            doc={cliente.documentos?.rif}
            shareTitle={`RIF · ${cliente.nombre}`}
          />
        </div>
      </section>
    </div>
  );
}
