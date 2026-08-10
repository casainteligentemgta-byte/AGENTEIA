"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Car, Ship } from "lucide-react";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";
import {
  PuertoLibreDocScan,
  type PuertoLibreScanTipo,
} from "@/components/nfc/PuertoLibreDocScan";
import { VehiculoCatalogoFields } from "@/components/nfc/VehiculoCatalogoFields";
import type { PuertoLibreRegistroScanFields } from "@/lib/extract-puerto-libre-docs";
import {
  ADUANAS_VENEZUELA,
  resolveAduanaVenezuela,
} from "@/lib/importacion/aduanas-venezuela";
import { PAISES, resolvePais } from "@/lib/importacion/paises";
import {
  TIPOS_COMBUSTIBLE,
  TIPO_COMBUSTIBLE_LABELS,
  type TipoCombustible,
} from "@/lib/schemas/importacion-alta";
import type { VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";
import { RIF_FORMAT_HINT, RIF_PLACEHOLDER } from "@/lib/validations/rif";

export type PuertoLibreScanFiles = Partial<Record<PuertoLibreScanTipo, File>>;

export type PuertoLibreFase1FormValues = {
  marca: string;
  modelo: string;
  color: string;
  anio: string;
  serialMotor: string;
  vin: string;
  serialCarroceria: string;
  kilometraje: string;
  condicion: "nuevo" | "usado" | "";
  esSubasta: "true" | "false" | "";
  partidaArancelaria: string;
  cilindradaCc: string;
  tipoCombustible: TipoCombustible | "";
  fechaLlegadaBuque: string;
  importadorNombre: string;
  importadorDocumento: string;
  importadorTelefono: string;
  importadorEmail: string;
  importadorDireccion: string;
  aduana: string;
  numeroBl: string;
  paisOrigen: string;
  valorCif: string;
  tasaCambioBcv: string;
  numeroExpedienteSeniat: string;
  numeroDav: string;
  numeroCertificadoOrigen: string;
  numeroListaEmpaque: string;
  numeroPolizaTransporte: string;
  observaciones: string;
};

export const emptyPuertoLibreFase1Values = (): PuertoLibreFase1FormValues => ({
  marca: "",
  modelo: "",
  color: "",
  anio: "",
  serialMotor: "",
  vin: "",
  serialCarroceria: "",
  kilometraje: "",
  condicion: "",
  esSubasta: "",
  partidaArancelaria: "",
  cilindradaCc: "",
  tipoCombustible: "",
  fechaLlegadaBuque: "",
  importadorNombre: "",
  importadorDocumento: "",
  importadorTelefono: "",
  importadorEmail: "",
  importadorDireccion: "",
  aduana: "",
  numeroBl: "",
  paisOrigen: "",
  valorCif: "",
  tasaCambioBcv: "",
  numeroExpedienteSeniat: "",
  numeroDav: "",
  numeroCertificadoOrigen: "",
  numeroListaEmpaque: "",
  numeroPolizaTransporte: "",
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
  assign("vin", patch.vin);
  assign("serialCarroceria", patch.serialCarroceria);
  // Si OCR trae VIN pero no serial carrocería, prellenar serial (el usuario puede editar).
  if (patch.vin && !next.serialCarroceria.trim()) {
    next.serialCarroceria = patch.vin;
  }
  if (patch.serialCarroceria && !next.vin.trim()) {
    next.vin = patch.serialCarroceria;
  }
  assign("kilometraje", patch.kilometraje);
  if (patch.condicion) next.condicion = patch.condicion;
  if (patch.esSubasta) next.esSubasta = patch.esSubasta;
  assign("partidaArancelaria", patch.partidaArancelaria);
  assign("cilindradaCc", patch.cilindradaCc);
  if (patch.tipoCombustible) next.tipoCombustible = patch.tipoCombustible;
  assign("fechaLlegadaBuque", patch.fechaLlegadaBuque);
  assign("importadorNombre", patch.importadorNombre);
  assign("importadorDocumento", patch.importadorDocumento);
  assign("importadorTelefono", patch.importadorTelefono);
  assign("importadorEmail", patch.importadorEmail);
  assign("importadorDireccion", patch.importadorDireccion);
  assign("aduana", resolveAduanaVenezuela(patch.aduana) || undefined);
  assign("numeroBl", patch.numeroBl);
  assign("paisOrigen", resolvePais(patch.paisOrigen) || undefined);
  assign("valorCif", patch.valorCif);
  assign("tasaCambioBcv", patch.tasaCambioBcv);
  assign("numeroExpedienteSeniat", patch.numeroExpedienteSeniat);
  assign("numeroDav", patch.numeroDav);
  assign("numeroCertificadoOrigen", patch.numeroCertificadoOrigen);
  assign("numeroListaEmpaque", patch.numeroListaEmpaque);
  assign("numeroPolizaTransporte", patch.numeroPolizaTransporte);
  assign("observaciones", patch.observaciones);
  return next;
}

type Props = {
  initial?: Partial<PuertoLibreFase1FormValues>;
  /** Contenido tras el formulario (botones de acción). */
  actions: ReactNode;
  onSubmit: (
    values: PuertoLibreFase1FormValues,
    formData: FormData,
    scanFiles: PuertoLibreScanFiles
  ) => void;
  /** Estilo de sección: alta (sin card) o planilla (con card). */
  variant?: "alta" | "planilla";
  /** Si existe, Autorellenar guarda factura/BL en vehiculos.documentos al escanear. */
  vehiculoId?: string;
  /** Documentos ya persistidos (mismo JSONB que Embarque). */
  existingDocumentos?: VehiculosDocumentos;
  onDocumentosChange?: (documentos: VehiculosDocumentos) => void;
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
  vehiculoId,
  existingDocumentos,
  onDocumentosChange,
}: Props) {
  const [values, setValues] = useState<PuertoLibreFase1FormValues>(() => {
    const merged = { ...emptyPuertoLibreFase1Values(), ...initial };
    return {
      ...merged,
      aduana: resolveAduanaVenezuela(merged.aduana),
      paisOrigen: resolvePais(merged.paisOrigen),
    };
  });
  const [scanFiles, setScanFiles] = useState<PuertoLibreScanFiles>({});
  const [catalogKey, setCatalogKey] = useState(0);
  const importadorPrellenado = Boolean(initial?.importadorNombre?.trim());
  const kmMin = values.condicion === "usado" ? 1 : 0;
  const kmPlaceholder = values.condicion === "usado" ? "Ej. 45000" : "0";

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

  function patchFromScan(
    fields: PuertoLibreRegistroScanFields,
    tipo: PuertoLibreScanTipo,
    file: File
  ) {
    setValues((prev) => mergeScanFields(prev, fields));
    setScanFiles((prev) => ({ ...prev, [tipo]: file }));
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
          tipoCombustible: String(
            fd.get("tipoCombustible") ?? values.tipoCombustible
          ) as TipoCombustible | "",
          fechaLlegadaBuque:
            values.fechaLlegadaBuque ||
            String(fd.get("fechaLlegadaBuque") ?? ""),
        };
        onSubmit(synced, fd, scanFiles);
      }}
    >
      <PuertoLibreDocScan
        vehiculoId={vehiculoId}
        existingUrls={{
          factura_comercial: existingDocumentos?.factura_comercial?.url,
          certificado_origen: existingDocumentos?.certificado_origen?.url,
        }}
        onExtracted={patchFromScan}
        onDocumentUploaded={(docs) => onDocumentosChange?.(docs)}
      />

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
            label="VIN *"
            name="vin"
            required
            mono
            upper
            placeholder="VIN internacional (17 caracteres)"
            hint="Puede diferir del serial de carrocería en SENIAT."
            value={values.vin}
            onChange={(v) => setField("vin", v)}
          />
          <ControlledField
            label="Serial carrocería *"
            name="serialCarroceria"
            required
            mono
            upper
            placeholder="Serial de carrocería / chasis"
            hint="Dato SENIAT; a veces distinto del VIN."
            value={values.serialCarroceria}
            onChange={(v) => setField("serialCarroceria", v)}
          />
          <ControlledField
            label={
              values.condicion === "usado"
                ? "Kilometraje * (obligatorio > 0)"
                : "Kilometraje *"
            }
            name="kilometraje"
            type="number"
            required
            min={kmMin}
            placeholder={kmPlaceholder}
            hint={
              values.condicion === "usado"
                ? "En usados no puede ser 0."
                : "En nuevos suele ser 0."
            }
            value={values.kilometraje}
            onChange={(v) => setField("kilometraje", v)}
          />
          <ControlledField
            label="Partida arancelaria"
            name="partidaArancelaria"
            placeholder="Ej. 8703.23.91"
            mono
            value={values.partidaArancelaria}
            onChange={(v) => setField("partidaArancelaria", v)}
          />
          <ControlledField
            label="Cilindrada (cc)"
            name="cilindradaCc"
            type="number"
            min={0}
            placeholder="Ej. 2000"
            value={values.cilindradaCc}
            onChange={(v) => setField("cilindradaCc", v)}
          />
          <ControlledSelect
            label="Tipo de combustible"
            name="tipoCombustible"
            placeholder="Selecciona combustible"
            value={values.tipoCombustible}
            options={TIPOS_COMBUSTIBLE.map((t) => ({
              value: t,
              label: TIPO_COMBUSTIBLE_LABELS[t],
            }))}
            onChange={(v) =>
              setField("tipoCombustible", v as TipoCombustible | "")
            }
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
                        if (op.value === "nuevo") {
                          setField("esSubasta", "");
                          if (!values.kilometraje.trim()) setField("kilometraje", "0");
                        } else if (
                          values.kilometraje.trim() === "" ||
                          values.kilometraje.trim() === "0"
                        ) {
                          setField("kilometraje", "");
                        }
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
            placeholder={RIF_PLACEHOLDER}
            hint={RIF_FORMAT_HINT}
            upper
            mono
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
            value={values.importadorEmail}
            onChange={(v) => setField("importadorEmail", v)}
          />
          <label className="block min-w-0 space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Dirección fiscal</span>
            <textarea
              name="importadorDireccion"
              rows={2}
              value={values.importadorDireccion}
              onChange={(e) => setField("importadorDireccion", e.target.value)}
              placeholder="Dirección fiscal del importador (SENIAT)"
              className="box-border w-full max-w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
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
          <ControlledField
            label="Tasa BCV (Bs/USD)"
            name="tasaCambioBcv"
            type="number"
            placeholder="Ej. 36.50"
            min={0}
            hint="Tasa del día de la declaración."
            value={values.tasaCambioBcv}
            onChange={(v) => setField("tasaCambioBcv", v)}
          />
          <ControlledField
            label="Nº expediente SENIAT"
            name="numeroExpedienteSeniat"
            placeholder="Asignado por SENIAT"
            mono
            upper
            hint="Distinto del código interno PL-…"
            value={values.numeroExpedienteSeniat}
            onChange={(v) => setField("numeroExpedienteSeniat", v)}
          />
          <ControlledField
            label="Nº DAV"
            name="numeroDav"
            placeholder="Declaración Andina de Valor"
            mono
            upper
            value={values.numeroDav}
            onChange={(v) => setField("numeroDav", v)}
          />
          <ControlledField
            label="Nº certificado de origen"
            name="numeroCertificadoOrigen"
            mono
            upper
            value={values.numeroCertificadoOrigen}
            onChange={(v) => setField("numeroCertificadoOrigen", v)}
          />
          <ControlledField
            label="Nº lista de empaque"
            name="numeroListaEmpaque"
            mono
            upper
            value={values.numeroListaEmpaque}
            onChange={(v) => setField("numeroListaEmpaque", v)}
          />
          <ControlledField
            label="Nº póliza de transporte"
            name="numeroPolizaTransporte"
            mono
            upper
            value={values.numeroPolizaTransporte}
            onChange={(v) => setField("numeroPolizaTransporte", v)}
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
  hint,
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
  hint?: string;
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
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
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
  options: readonly string[] | readonly { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  wide?: boolean;
}) {
  const normalized = useMemo(
    () =>
      options.map((o) =>
        typeof o === "string" ? { value: o, label: o } : o
      ),
    [options]
  );

  const items = useMemo(() => {
    const trimmed = value.trim();
    if (trimmed && !normalized.some((o) => o.value === trimmed)) {
      return [{ value: trimmed, label: trimmed }, ...normalized];
    }
    return normalized;
  }, [normalized, value]);

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
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
