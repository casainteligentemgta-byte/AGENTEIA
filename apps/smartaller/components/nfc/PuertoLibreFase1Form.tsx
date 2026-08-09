"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Car, Ship } from "lucide-react";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";
import { PuertoLibreDocScan } from "@/components/nfc/PuertoLibreDocScan";
import { VehiculoCatalogoFields } from "@/components/nfc/VehiculoCatalogoFields";
import type { PuertoLibreRegistroScanFields } from "@/lib/extract-puerto-libre-docs";
import {
  ADUANAS_VENEZUELA,
  resolveAduanaVenezuela,
} from "@/lib/puerto-libre/aduanas-venezuela";
import { PAISES, resolvePais } from "@/lib/puerto-libre/paises";

export type PuertoLibreFase1FormValues = {
  marca: string;
  modelo: string;
  color: string;
  anio: string;
  serialMotor: string;
  serialCarroceria: string;
  kilometraje: string;
  condicion: "nuevo" | "usado" | "";
  esSubasta: "true" | "false" | "";
  fechaLlegadaBuque: string;
  importadorNombre: string;
  importadorDocumento: string;
  importadorTelefono: string;
  importadorEmail: string;
  aduana: string;
  numeroBl: string;
  paisOrigen: string;
  valorCif: string;
  observaciones: string;
};

export const emptyPuertoLibreFase1Values = (): PuertoLibreFase1FormValues => ({
  marca: "",
  modelo: "",
  color: "",
  anio: "",
  serialMotor: "",
  serialCarroceria: "",
  kilometraje: "",
  condicion: "",
  esSubasta: "",
  fechaLlegadaBuque: "",
  importadorNombre: "",
  importadorDocumento: "",
  importadorTelefono: "",
  importadorEmail: "",
  aduana: "",
  numeroBl: "",
  paisOrigen: "",
  valorCif: "",
  observaciones: "",
});

function mergeScanFields(
  current: PuertoLibreFase1FormValues,
  patch: PuertoLibreRegistroScanFields
): PuertoLibreFase1FormValues {
  const next = { ...current };
  const assign = <K extends keyof PuertoLibreFase1FormValues>(
    key: K,
    value: PuertoLibreFase1FormValues[K] | undefined
  ) => {
    if (value == null) return;
    const str = String(value).trim();
    if (!str) return;
    next[key] = value;
  };

  assign("marca", patch.marca);
  assign("modelo", patch.modelo);
  assign("color", patch.color);
  assign("anio", patch.anio);
  assign("serialMotor", patch.serialMotor);
  assign("serialCarroceria", patch.serialCarroceria);
  assign("kilometraje", patch.kilometraje);
  if (patch.condicion) next.condicion = patch.condicion;
  if (patch.esSubasta) next.esSubasta = patch.esSubasta;
  assign("fechaLlegadaBuque", patch.fechaLlegadaBuque);
  assign("importadorNombre", patch.importadorNombre);
  assign("importadorDocumento", patch.importadorDocumento);
  assign("importadorTelefono", patch.importadorTelefono);
  assign("importadorEmail", patch.importadorEmail);
  assign("aduana", resolveAduanaVenezuela(patch.aduana) || undefined);
  assign("numeroBl", patch.numeroBl);
  assign("paisOrigen", resolvePais(patch.paisOrigen) || undefined);
  assign("valorCif", patch.valorCif);
  assign("observaciones", patch.observaciones);
  return next;
}

type Props = {
  initial?: Partial<PuertoLibreFase1FormValues>;
  /** Contenido tras el formulario (botones de acción). */
  actions: ReactNode;
  onSubmit: (values: PuertoLibreFase1FormValues, formData: FormData) => void;
  /** Estilo de sección: alta (sin card) o planilla (con card). */
  variant?: "alta" | "planilla";
};

/**
 * Formulario compartido de Registro (Fase 1) / Nuevo expediente,
 * con escaneo OCR de factura y BL.
 */
export function PuertoLibreFase1Form({
  initial,
  actions,
  onSubmit,
  variant = "alta",
}: Props) {
  const [values, setValues] = useState<PuertoLibreFase1FormValues>(() => {
    const merged = { ...emptyPuertoLibreFase1Values(), ...initial };
    return {
      ...merged,
      aduana: resolveAduanaVenezuela(merged.aduana),
      paisOrigen: resolvePais(merged.paisOrigen),
    };
  });
  const [catalogKey, setCatalogKey] = useState(0);
  const importadorPrellenado = Boolean(initial?.importadorNombre?.trim());

  const sectionClass =
    variant === "planilla"
      ? "rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6"
      : "space-y-4";
  const sectionTitleClass =
    variant === "planilla"
      ? "flex items-center gap-2 text-lg font-semibold text-slate-100"
      : "flex items-center gap-2 text-lg font-semibold text-slate-100";
  const gridClass =
    variant === "planilla" ? "mt-4 grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2";

  function patchFromScan(fields: PuertoLibreRegistroScanFields) {
    setValues((prev) => mergeScanFields(prev, fields));
    setCatalogKey((k) => k + 1);
  }

  function setField<K extends keyof PuertoLibreFase1FormValues>(
    key: K,
    value: PuertoLibreFase1FormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        // Catálogo marca/modelo/color/año vive en inputs propios; priorizar FormData.
        const synced: PuertoLibreFase1FormValues = {
          ...values,
          marca: String(fd.get("marca") ?? values.marca),
          modelo: String(fd.get("modelo") ?? values.modelo),
          color: String(fd.get("color") ?? values.color),
          anio: String(fd.get("anio") ?? values.anio),
          condicion: String(fd.get("condicion") ?? values.condicion) as
            | "nuevo"
            | "usado"
            | "",
          esSubasta: String(fd.get("esSubasta") ?? values.esSubasta) as
            | "true"
            | "false"
            | "",
          fechaLlegadaBuque:
            values.fechaLlegadaBuque ||
            String(fd.get("fechaLlegadaBuque") ?? ""),
        };
        onSubmit(synced, fd);
      }}
    >
      <PuertoLibreDocScan onExtracted={(fields) => patchFromScan(fields)} />

      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <Car className="h-5 w-5 text-cyan-400" />
          Datos del vehículo
        </h2>
        <div className={gridClass}>
          <VehiculoCatalogoFields
            key={catalogKey}
            initialMarca={values.marca}
            initialModelo={values.modelo}
            initialColor={values.color}
            initialAnio={values.anio ? Number(values.anio) : null}
          />
          <ControlledField
            label="Serial motor *"
            name="serialMotor"
            required
            mono
            upper
            value={values.serialMotor}
            onChange={(v) => setField("serialMotor", v)}
          />
          <ControlledField
            label="Serial carrocería *"
            name="serialCarroceria"
            required
            mono
            upper
            value={values.serialCarroceria}
            onChange={(v) => setField("serialCarroceria", v)}
          />
          <ControlledField
            label="Kilometraje *"
            name="kilometraje"
            type="number"
            required
            min={0}
            placeholder="0"
            value={values.kilometraje}
            onChange={(v) => setField("kilometraje", v)}
          />

          <fieldset className="min-w-0 space-y-2 sm:col-span-2">
            <legend className="text-sm text-slate-400">Condición *</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "nuevo", label: "Nuevo" },
                  { value: "usado", label: "Usado" },
                ] as const
              ).map((op) => {
                const selected = values.condicion === op.value;
                return (
                  <label
                    key={op.value}
                    className={`inline-flex cursor-pointer items-center rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                      selected
                        ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-100"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="condicion"
                      value={op.value}
                      required
                      checked={selected}
                      onChange={() => {
                        setField("condicion", op.value);
                        if (op.value === "nuevo") setField("esSubasta", "");
                      }}
                      className="sr-only"
                    />
                    {op.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {values.condicion === "usado" ? (
            <fieldset className="min-w-0 space-y-2 sm:col-span-2">
              <legend className="text-sm text-slate-400">¿Es de subasta? *</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "true", label: "Sí" },
                    { value: "false", label: "No" },
                  ] as const
                ).map((op) => {
                  const selected = values.esSubasta === op.value;
                  return (
                    <label
                      key={op.value}
                      className={`inline-flex cursor-pointer items-center rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                        selected
                          ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-100"
                          : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="esSubasta"
                        value={op.value}
                        required
                        checked={selected}
                        onChange={() => setField("esSubasta", op.value)}
                        className="sr-only"
                      />
                      {op.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
        </div>
      </section>

      <section
        className={
          variant === "planilla"
            ? sectionClass
            : "space-y-4 border-t border-slate-800 pt-8"
        }
      >
        <h2 className={sectionTitleClass}>
          <Ship className="h-5 w-5 text-cyan-400" />
          Datos del importador
        </h2>
        {importadorPrellenado ? (
          <p className="mt-1 text-xs text-slate-500">
            Prellenado con el último importador usado. Puedes editarlo si cambia.
          </p>
        ) : null}
        <div className={gridClass}>
          <ControlledField
            label="Nombre *"
            name="importadorNombre"
            required
            wide
            value={values.importadorNombre}
            onChange={(v) => setField("importadorNombre", v)}
          />
          <ControlledField
            label="RIF"
            name="importadorDocumento"
            value={values.importadorDocumento}
            onChange={(v) => setField("importadorDocumento", v)}
          />
          <ControlledField
            label="Teléfono"
            name="importadorTelefono"
            value={values.importadorTelefono}
            onChange={(v) => setField("importadorTelefono", v)}
          />
          <ControlledField
            label="Email"
            name="importadorEmail"
            type="email"
            wide
            value={values.importadorEmail}
            onChange={(v) => setField("importadorEmail", v)}
          />
        </div>
      </section>

      <section
        className={
          variant === "planilla"
            ? sectionClass
            : "space-y-4 border-t border-slate-800 pt-8"
        }
      >
        <h2 className="text-lg font-semibold text-slate-100">Datos de importación</h2>
        <div className={gridClass}>
          <div className="min-w-0 sm:col-span-2">
            <PlanillaFechaField
              label="Fecha llegada del buque *"
              name="fechaLlegadaBuque"
              value={values.fechaLlegadaBuque}
              onChange={(v) => setField("fechaLlegadaBuque", v)}
              required
            />
          </div>
          <ControlledSelect
            label="Aduana"
            name="aduana"
            placeholder="Selecciona aduana"
            value={values.aduana}
            options={ADUANAS_VENEZUELA}
            onChange={(v) => setField("aduana", v)}
          />
          <ControlledField
            label="Nº BL / Guía"
            name="numeroBl"
            placeholder="Número de conocimiento de embarque"
            mono
            upper
            value={values.numeroBl}
            onChange={(v) => setField("numeroBl", v)}
          />
          <ControlledSelect
            label="País de origen"
            name="paisOrigen"
            placeholder="Selecciona país"
            value={values.paisOrigen}
            options={PAISES}
            onChange={(v) => setField("paisOrigen", v)}
          />
          <ControlledField
            label="Valor CIF (USD)"
            name="valorCif"
            type="number"
            placeholder="0.00"
            min={0}
            value={values.valorCif}
            onChange={(v) => setField("valorCif", v)}
          />
          <label className="block min-w-0 space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Observaciones</span>
            <textarea
              name="observaciones"
              rows={3}
              value={values.observaciones}
              onChange={(e) => setField("observaciones", e.target.value)}
              placeholder="Notas del embarque o aduana…"
              className="box-border w-full max-w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
        </div>
      </section>

      {actions}
    </form>
  );
}

function ControlledField({
  label,
  name,
  value,
  onChange,
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
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  mono?: boolean;
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
        value={value}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={(e) => {
          const next = upper ? e.target.value.toUpperCase() : e.target.value;
          onChange(next);
        }}
        className={`box-border w-full max-w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60 ${
          mono ? "font-mono uppercase" : ""
        }`}
      />
    </label>
  );
}

function ControlledSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required,
  wide,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  required?: boolean;
  wide?: boolean;
}) {
  const items = useMemo(() => {
    const trimmed = value.trim();
    if (trimmed && !options.some((o) => o === trimmed)) {
      return [trimmed, ...options];
    }
    return options;
  }, [options, value]);

  return (
    <label className={`block min-w-0 space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-sm text-slate-400">{label}</span>
      <select
        name={name}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="box-border w-full max-w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
      >
        <option value="">{placeholder ?? "Selecciona…"}</option>
        {items.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
