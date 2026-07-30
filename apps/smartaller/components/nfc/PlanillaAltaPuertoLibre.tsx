"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Car, Ship } from "lucide-react";
import { createPuertoLibreVehiculoAction } from "@/app/actions/nfc/puerto-libre-vehiculo";

const currentYear = new Date().getFullYear();

/** Fase 1: datos del vehículo + importador. */
export function PlanillaAltaPuertoLibre() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-8"
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const anioRaw = String(fd.get("anio") ?? "").trim();
          const result = await createPuertoLibreVehiculoAction({
            marca: String(fd.get("marca") ?? ""),
            modelo: String(fd.get("modelo") ?? ""),
            color: String(fd.get("color") ?? ""),
            anio: anioRaw ? Number(anioRaw) : undefined,
            serialMotor: String(fd.get("serialMotor") ?? ""),
            serialCarroceria: String(fd.get("serialCarroceria") ?? ""),
            importadorNombre: String(fd.get("importadorNombre") ?? ""),
            importadorDocumento: String(fd.get("importadorDocumento") ?? ""),
            importadorTelefono: String(fd.get("importadorTelefono") ?? ""),
            importadorEmail: String(fd.get("importadorEmail") ?? ""),
          });
          if (!result.success) {
            setError(result.error);
            return;
          }
          router.push(`/puerto-libre/${result.vehiculoId}/planilla?fase=2`);
          router.refresh();
        });
      }}
    >
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Car className="h-5 w-5 text-cyan-400" />
          Datos del vehículo
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Marca *" name="marca" required placeholder="Ej. JAC" />
          <Field label="Modelo *" name="modelo" required placeholder="Ej. Sunray" />
          <Field label="Color *" name="color" required />
          <Field
            label="Año *"
            name="anio"
            type="number"
            required
            defaultValue={String(currentYear)}
            min={1950}
            max={currentYear + 1}
          />
          <Field label="Serial motor *" name="serialMotor" required mono />
          <Field label="Serial carrocería *" name="serialCarroceria" required mono />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Ship className="h-5 w-5 text-cyan-400" />
          Datos del importador
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *" name="importadorNombre" required wide />
          <Field label="RIF" name="importadorDocumento" />
          <Field label="Teléfono" name="importadorTelefono" />
          <Field label="Email" name="importadorEmail" type="email" wide />
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-cyan-600 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Registrando…" : "Registrar vehículo"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  mono,
  wide,
  min,
  max,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  mono?: boolean;
  wide?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className={`block space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-sm text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60 ${
          mono ? "font-mono uppercase" : ""
        }`}
      />
    </label>
  );
}
