"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Car, Ship } from "lucide-react";
import { createPuertoLibreVehiculoAction } from "@/app/actions/nfc/puerto-libre-vehiculo";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";

const currentYear = new Date().getFullYear();

/** Fase 1: datos del vehículo + importador. */
export function PlanillaAltaPuertoLibre() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fechaLlegadaBuque, setFechaLlegadaBuque] = useState("");

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
            fechaLlegadaBuque:
              fechaLlegadaBuque || String(fd.get("fechaLlegadaBuque") ?? ""),
            importadorNombre: String(fd.get("importadorNombre") ?? ""),
            importadorDocumento: String(fd.get("importadorDocumento") ?? ""),
            importadorTelefono: String(fd.get("importadorTelefono") ?? ""),
            importadorEmail: String(fd.get("importadorEmail") ?? ""),
            aduana: String(fd.get("aduana") ?? ""),
            numeroBl: String(fd.get("numeroBl") ?? ""),
            paisOrigen: String(fd.get("paisOrigen") ?? ""),
            valorCif: String(fd.get("valorCif") ?? ""),
            observaciones: String(fd.get("observaciones") ?? ""),
          });
          if (!result.success) {
            setError(result.error);
            return;
          }
          router.push(`/puerto-libre/${result.vehiculoId}/planilla?fase=1a`);
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
          <Field label="Marca *" name="marca" required placeholder="Ej. Toyota" />
          <Field label="Modelo *" name="modelo" required placeholder="Ej. Corolla" />
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
          <Field label="Serial motor *" name="serialMotor" required mono upper />
          <Field
            label="Serial carrocería *"
            name="serialCarroceria"
            required
            mono
            upper
          />
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

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Datos de importación</h2>
        <p className="mt-1 text-sm text-slate-500">
          Fecha de llegada del buque obligatoria. El resto es opcional. Tras
          registrar cargarás factura, certificado de origen y BL (fase 1A).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <PlanillaFechaField
              label="Fecha llegada del buque *"
              name="fechaLlegadaBuque"
              value={fechaLlegadaBuque}
              onChange={setFechaLlegadaBuque}
              required
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Llegada del buque al puerto. El ingreso al régimen PL se registra
              después, en la fase Llegada.
            </p>
          </div>
          <Field label="Aduana" name="aduana" placeholder="Ej. Guanta" />
          <Field
            label="Nº BL / Guía"
            name="numeroBl"
            placeholder="Número de conocimiento de embarque"
            mono
            upper
          />
          <Field label="País de origen" name="paisOrigen" placeholder="Ej. China" />
          <Field
            label="Valor CIF (USD)"
            name="valorCif"
            type="number"
            placeholder="0.00"
            min={0}
          />
          <label className="block min-w-0 space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Observaciones</span>
            <textarea
              name="observaciones"
              rows={3}
              placeholder="Notas del embarque o aduana…"
              className="box-border w-full max-w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
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
  upper,
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
  /** Fuerza mayúsculas en el valor enviado (seriales). */
  upper?: boolean;
  wide?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className={`block min-w-0 space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-sm text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        onInput={
          upper
            ? (e) => {
                const el = e.currentTarget;
                const next = el.value.toUpperCase();
                if (el.value !== next) el.value = next;
              }
            : undefined
        }
        className={`box-border w-full max-w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60 ${
          mono ? "font-mono uppercase" : ""
        }`}
      />
    </label>
  );
}
