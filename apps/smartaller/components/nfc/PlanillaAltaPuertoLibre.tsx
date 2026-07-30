"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Car, Loader2, Ship, User } from "lucide-react";
import { createPuertoLibreVehiculoAction } from "@/app/actions/nfc/puerto-libre-vehiculo";

const currentYear = new Date().getFullYear();

export function PlanillaAltaPuertoLibre() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(fd: FormData) {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const anioRaw = String(fd.get("anio") ?? "").trim();
      const result = await createPuertoLibreVehiculoAction({
        marca: String(fd.get("marca") ?? ""),
        modelo: String(fd.get("modelo") ?? ""),
        serialCarroceria: String(fd.get("serialCarroceria") ?? ""),
        serialMotor: String(fd.get("serialMotor") ?? ""),
        color: String(fd.get("color") ?? ""),
        anio: anioRaw ? Number(anioRaw) : undefined,
        fechaIngresoPl: String(fd.get("fechaIngresoPl") ?? ""),
        placa: String(fd.get("placa") ?? ""),
        importadorNombre: String(fd.get("importadorNombre") ?? ""),
        importadorDocumento: String(fd.get("importadorDocumento") ?? ""),
        importadorTelefono: String(fd.get("importadorTelefono") ?? ""),
        importadorEmail: String(fd.get("importadorEmail") ?? ""),
        compradorNombre: String(fd.get("compradorNombre") ?? ""),
        compradorCedula: String(fd.get("compradorCedula") ?? ""),
        compradorTelefono: String(fd.get("compradorTelefono") ?? ""),
        compradorEmail: String(fd.get("compradorEmail") ?? ""),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/puerto-libre/${result.vehiculoId}/planilla`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-8" action={handleSubmit}>
      <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
        Planilla de ingreso a Puerto Libre. Tras guardar continuarás con memoria fotográfica y
        documentos.
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Car className="h-5 w-5 text-cyan-400" />
          Datos del vehículo
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Marca *" name="marca" required placeholder="Ej. JAC" />
          <Field label="Modelo *" name="modelo" required placeholder="Ej. Sunray" />
          <Field label="Serial carrocería / VIN *" name="serialCarroceria" required mono />
          <Field label="Serial motor *" name="serialMotor" required mono />
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
          <Field
            label="Fecha de ingreso a Puerto Libre *"
            name="fechaIngresoPl"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
          <Field
            label="Placa (texto) *"
            name="placa"
            required
            placeholder="Ej. AA110N10"
            mono
          />
          <p className="sm:col-span-2 text-xs text-slate-500">
            Escribe la placa aquí. En el siguiente paso subirás la{" "}
            <strong className="font-medium text-slate-300">foto de la placa</strong>.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Ship className="h-5 w-5 text-cyan-400" />
          Datos del importador
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre / razón social *" name="importadorNombre" required wide />
          <Field label="RIF / cédula" name="importadorDocumento" />
          <Field label="Teléfono" name="importadorTelefono" />
          <Field label="Email" name="importadorEmail" type="email" wide />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <User className="h-5 w-5 text-cyan-400" />
          Datos del comprador
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo *" name="compradorNombre" required wide />
          <Field label="Cédula" name="compradorCedula" />
          <Field label="Teléfono *" name="compradorTelefono" required />
          <Field label="Email" name="compradorEmail" type="email" wide />
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? "Registrando…" : "Continuar a fotos y documentos"}
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
