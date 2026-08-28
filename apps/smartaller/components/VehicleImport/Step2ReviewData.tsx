"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { VinCrossCheck } from "@/components/VehicleImport/VinCrossCheck";
import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { vehicleSemaforo } from "@/lib/importacion/carga-masiva-ui";
import type { VinDocSources } from "@/lib/importacion/vehicle-import-vin";

type Props = {
  rows: CargaMasivaRow[];
  currentIndex: number;
  extractedFieldKeys: Record<string, string[]>;
  vinSources: Record<string, VinDocSources>;
  onIndexChange: (index: number) => void;
  onChange: (rowId: string, field: keyof CargaMasivaRow, value: string) => void;
  onNext: () => void;
  onBack: () => void;
};

const REVIEW_FIELDS: {
  key: keyof CargaMasivaRow;
  label: string;
  hint?: string;
}[] = [
  { key: "marca", label: "Marca" },
  { key: "modelo", label: "Modelo" },
  { key: "color", label: "Color" },
  { key: "anio", label: "Año" },
  { key: "vin", label: "VIN", hint: "17 caracteres. Identificador internacional." },
  {
    key: "serialCarroceria",
    label: "Serial carrocería (SENIAT)",
    hint: "Si es igual al VIN, déjalo igual. Solo cámbialo si el certificado trae otro serial.",
  },
  { key: "serialMotor", label: "Serial motor" },
  { key: "kilometraje", label: "Kilometraje" },
  { key: "condicion", label: "Condición (nuevo / usado)" },
  { key: "numeroCertificadoOrigen", label: "Nº certificado de origen" },
];

function inputClass(extracted: boolean, invalid: boolean): string {
  if (invalid) {
    return "w-full rounded-xl border border-red-500/70 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none";
  }
  if (extracted) {
    return "w-full rounded-xl border border-cyan-700/70 bg-cyan-950/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400";
  }
  return "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500";
}

export function Step2ReviewData({
  rows,
  currentIndex,
  extractedFieldKeys,
  vinSources,
  onIndexChange,
  onChange,
  onNext,
  onBack,
}: Props) {
  const row = rows[currentIndex];
  if (!row) {
    return (
      <p className="text-sm text-zinc-500">No hay vehículos para revisar.</p>
    );
  }
  const sem = vehicleSemaforo(row);
  const extracted = new Set(extractedFieldKeys[row.id] ?? []);
  const vinOk = (row.vin || row.serialCarroceria).replace(/\s/g, "").length >= 11;
  const sameSerial =
    row.vin.trim() !== "" &&
    row.serialCarroceria.trim() !== "" &&
    row.vin.trim().toUpperCase() === row.serialCarroceria.trim().toUpperCase();

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-50">Revisar datos extraídos</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Los campos en cyan salieron del OCR. Corrígelos ahora, no al final.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            sem.nivel === "verde"
              ? "bg-emerald-950 text-emerald-200"
              : sem.nivel === "ambar"
                ? "bg-amber-950 text-amber-200"
                : "bg-red-950 text-red-200"
          }`}
        >
          {sem.label}
        </span>
      </div>

      {rows.length > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => onIndexChange(currentIndex - 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <p className="text-xs text-zinc-500">
            {currentIndex + 1} de {rows.length}
          </p>
          <button
            type="button"
            disabled={currentIndex >= rows.length - 1}
            onClick={() => onIndexChange(currentIndex + 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        {REVIEW_FIELDS.map((field) => {
          if (field.key === "serialCarroceria" && sameSerial) {
            return (
              <p key={field.key} className="text-xs text-zinc-500">
                Serial carrocería = VIN (SENIAT). Se mantiene igual.
              </p>
            );
          }
          const value = String(row[field.key] ?? "");
          const invalid =
            (field.key === "vin" && !vinOk) ||
            ((field.key === "marca" || field.key === "modelo") && !value.trim());
          return (
            <label key={field.key} className="block text-xs text-zinc-500">
              <span className="flex items-center gap-2">
                {field.label}
                {extracted.has(field.key) ? (
                  <span className="rounded bg-cyan-900/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cyan-200">
                    Extraído
                  </span>
                ) : null}
              </span>
              <input
                value={value}
                onChange={(event) =>
                  onChange(row.id, field.key, event.target.value)
                }
                className={`mt-1 ${inputClass(extracted.has(field.key), invalid)}`}
              />
              {field.hint ? (
                <span className="mt-1 block text-[11px] text-zinc-600">{field.hint}</span>
              ) : null}
              {invalid && field.key === "vin" ? (
                <span className="mt-1 block text-[11px] text-red-300">
                  VIN demasiado corto. Completa 17 caracteres.
                </span>
              ) : null}
              {field.key === "vin" ? (
                <VinCrossCheck vin={value} sources={vinSources[row.id]} />
              ) : null}
            </label>
          );
        })}
      </div>

      {sem.detail ? (
        <p className="text-xs text-zinc-500">{sem.detail}</p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-200 hover:border-zinc-500"
        >
          Volver a documentos
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Continuar a confirmar
        </button>
      </div>
    </div>
  );
}
