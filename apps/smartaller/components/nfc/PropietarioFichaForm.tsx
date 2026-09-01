"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertPropietarioAction } from "@/app/actions/nfc/propietarios";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";

const FIELD =
  "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60";

export type PropietarioFormValues = {
  id?: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  direccion: string;
};

type Props = {
  initial?: PropietarioFormValues;
  /** Tras crear, ir a la ficha (o asignar expediente). */
  afterCreateHref?: (id: string) => string;
  submitLabel?: string;
};

export function PropietarioFichaForm({
  initial,
  afterCreateHref,
  submitLabel = "Guardar ficha",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fechaNacimiento, setFechaNacimiento] = useState(
    initial?.fechaNacimiento ?? ""
  );

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      action={(fd) => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await upsertPropietarioAction({
            id: initial?.id,
            nombre: String(fd.get("nombre") ?? ""),
            cedula: String(fd.get("cedula") ?? ""),
            telefono: String(fd.get("telefono") ?? ""),
            email: String(fd.get("email") ?? ""),
            fechaNacimiento: String(fd.get("fechaNacimiento") ?? ""),
            direccion: String(fd.get("direccion") ?? ""),
          });
          if (!result.success) {
            setError(result.error);
            return;
          }
          setMessage("Ficha guardada");
          const href = afterCreateHref?.(result.propietario.id);
          if (href) {
            router.push(href);
            return;
          }
          router.refresh();
        });
      }}
    >
      {error ? (
        <p className="sm:col-span-2 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="sm:col-span-2 rounded-xl border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm text-slate-400">Nombre *</span>
        <input
          name="nombre"
          required
          defaultValue={initial?.nombre ?? ""}
          className={FIELD}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-400">Cédula</span>
        <input
          name="cedula"
          defaultValue={initial?.cedula ?? ""}
          placeholder="V-12.345.678"
          className={FIELD}
        />
      </label>
      <PlanillaFechaField
        label="Fecha de nacimiento"
        name="fechaNacimiento"
        value={fechaNacimiento}
        onChange={setFechaNacimiento}
      />
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-400">Teléfono</span>
        <input
          name="telefono"
          defaultValue={initial?.telefono ?? ""}
          className={FIELD}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-slate-400">Email</span>
        <input
          name="email"
          type="email"
          defaultValue={initial?.email ?? ""}
          className={FIELD}
        />
      </label>
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm text-slate-400">Dirección</span>
        <input
          name="direccion"
          defaultValue={initial?.direccion ?? ""}
          className={FIELD}
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
