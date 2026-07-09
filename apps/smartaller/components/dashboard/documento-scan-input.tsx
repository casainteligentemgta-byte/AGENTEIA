"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { scanDocumentoVehiculoAction } from "@/app/actions/vehiculo-documentos";
import type { VehiculoDocumentoRef } from "@/lib/schemas/vehiculo-documentos";

type DocumentoScanInputProps = {
  tipo: "cedula" | "titulo";
  label: string;
  hint: string;
  onScanned: (result: {
    documento: VehiculoDocumentoRef;
    fields: Record<string, string>;
  }) => void;
};

export function DocumentoScanInput({ tipo, label, hint, onScanned }: DocumentoScanInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setDone(false);

    const formData = new FormData();
    formData.set("tipo", tipo);
    formData.set("file", file);

    startTransition(async () => {
      const result = await scanDocumentoVehiculoAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const fields: Record<string, string> = {};

      if (result.tipo === "cedula") {
        if (result.extraction.nombre_completo) {
          fields.nombreCliente = result.extraction.nombre_completo;
        }
        if (result.extraction.numero_cedula) {
          fields.cedulaPropietario = result.extraction.numero_cedula;
        }
        if (result.extraction.fecha_nacimiento) {
          fields.fechaNacimientoPropietario = result.extraction.fecha_nacimiento;
        }
      } else {
        const t = result.extraction;
        if (t.placa) fields.placa = t.placa;
        if (t.marca) fields.marca = t.marca;
        if (t.modelo) fields.modelo = t.modelo;
        if (t.color) fields.color = t.color;
        if (t.serial_motor) fields.serialMotor = t.serial_motor;
        if (t.serial_carroceria) fields.serialCarroceria = t.serial_carroceria;
        if (t.nombre_propietario) fields.nombreCliente = t.nombre_propietario;
        if (t.cedula_propietario) fields.cedulaPropietario = t.cedula_propietario;
      }

      onScanned({ documento: result.documento, fields });
      setDone(true);
    });
  }

  return (
    <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-200">{label}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : done ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {pending ? "Leyendo…" : done ? "Documento leído" : "Escanear"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
