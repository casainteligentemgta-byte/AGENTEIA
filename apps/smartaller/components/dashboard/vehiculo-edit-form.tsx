"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { updateVehiculoContactoAction } from "@/app/actions/vehiculos";

type VehiculoEditFormProps = {
  vehiculoId: string;
  nombreCliente: string | null;
  telefonoCliente: string | null;
};

export function VehiculoEditForm({
  vehiculoId,
  nombreCliente,
  telefonoCliente,
}: VehiculoEditFormProps) {
  const [nombre, setNombre] = useState(nombreCliente ?? "");
  const [telefono, setTelefono] = useState(telefonoCliente ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await updateVehiculoContactoAction({
        vehiculoId,
        nombreCliente: nombre,
        telefonoCliente: telefono,
      });
      setMessage(result.ok ? "Datos guardados" : result.error ?? "Error al guardar");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-6">
      <h2 className="font-semibold text-zinc-100">Datos del cliente</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Necesarios para WhatsApp y recordatorios automáticos
      </p>

      {message && (
        <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
          {message}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nombreCliente" className="block text-sm font-medium text-zinc-300">
            Nombre
          </label>
          <input
            id="nombreCliente"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label htmlFor="telefonoCliente" className="block text-sm font-medium text-zinc-300">
            Teléfono (WhatsApp)
          </label>
          <input
            id="telefonoCliente"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
            placeholder="3001234567"
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar contacto
      </button>
    </form>
  );
}
