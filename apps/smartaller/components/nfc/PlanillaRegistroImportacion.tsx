"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Camera, ClipboardList, FileUp } from "lucide-react";
import { updatePuertoLibreImportacionAction } from "@/app/actions/nfc/puerto-libre-vehiculo";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import {
  ESTADOS_NACIONALIZACION,
  ESTADOS_SENIAT,
  ESTADO_NACIONALIZACION_LABELS,
  ESTADO_SENIAT_LABELS,
  IMPORT_DOCUMENTO_TIPOS,
  MEMORIA_FOTOGRAFICA_TIPOS,
  type ImportacionData,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

type Props = {
  vehiculoId: string;
  placa: string;
  initialImportacion: ImportacionData;
  initialDocumentos: VehiculosDocumentos;
};

export function PlanillaRegistroImportacion({
  vehiculoId,
  placa,
  initialImportacion,
  initialDocumentos,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [docs, setDocs] = useState(initialDocumentos);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fotosCount = MEMORIA_FOTOGRAFICA_TIPOS.filter((t) => Boolean(docs[t])).length;
  const docsCount = IMPORT_DOCUMENTO_TIPOS.filter((t) => Boolean(docs[t])).length;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
        Planilla de registro de importación para{" "}
        <span className="font-mono text-cyan-300">{placa}</span>. Completa datos SENIAT,
        memoria fotográfica y expediente documental.
      </div>

      {(message || error) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-900/50 bg-red-950/30 text-red-200"
              : "border-emerald-900/40 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          {error ?? message}
        </div>
      )}

      {/* 1. Datos de importación */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <ClipboardList className="h-5 w-5 text-cyan-400" />
          1. Datos de importación
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Régimen Puerto Libre, BL, aduana y seguimiento SENIAT / nacionalización.
        </p>

        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const valorRaw = String(fd.get("valorCif") ?? "").trim();
              const result = await updatePuertoLibreImportacionAction({
                vehiculoId,
                regimen: String(fd.get("regimen") ?? "") || null,
                aduana: String(fd.get("aduana") ?? "") || null,
                fechaIngreso: String(fd.get("fechaIngreso") ?? "") || null,
                numeroBl: String(fd.get("numeroBl") ?? "") || null,
                paisOrigen: String(fd.get("paisOrigen") ?? "") || null,
                valorCif: valorRaw ? Number(valorRaw) : null,
                agenteAduanal: String(fd.get("agenteAduanal") ?? "") || null,
                observaciones: String(fd.get("observaciones") ?? "") || null,
                estadoNacionalizacion:
                  String(fd.get("estadoNacionalizacion") ?? "") || null,
                fechaLimiteNacionalizacion:
                  String(fd.get("fechaLimiteNacionalizacion") ?? "") || null,
                estadoSeniat: String(fd.get("estadoSeniat") ?? "") || null,
                fechaPresentacionSeniat:
                  String(fd.get("fechaPresentacionSeniat") ?? "") || null,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Datos de importación guardados");
              router.refresh();
            });
          }}
        >
          <Field
            label="Régimen"
            name="regimen"
            defaultValue={initialImportacion.regimen ?? "Puerto Libre"}
            placeholder="Puerto Libre"
          />
          <Field
            label="Aduana"
            name="aduana"
            defaultValue={initialImportacion.aduana ?? ""}
          />
          <Field
            label="Fecha de ingreso al país"
            name="fechaIngreso"
            type="date"
            defaultValue={initialImportacion.fechaIngreso ?? ""}
          />
          <Field
            label="Nº BL / guía"
            name="numeroBl"
            defaultValue={initialImportacion.numeroBl ?? ""}
          />
          <Field
            label="País de origen"
            name="paisOrigen"
            defaultValue={initialImportacion.paisOrigen ?? ""}
          />
          <Field
            label="Valor CIF"
            name="valorCif"
            type="number"
            defaultValue={
              initialImportacion.valorCif != null &&
              !Number.isNaN(initialImportacion.valorCif)
                ? String(initialImportacion.valorCif)
                : ""
            }
          />
          <Field
            label="Agente aduanal"
            name="agenteAduanal"
            defaultValue={initialImportacion.agenteAduanal ?? ""}
            className="sm:col-span-2"
          />

          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Estado nacionalización</span>
            <select
              name="estadoNacionalizacion"
              defaultValue={initialImportacion.estadoNacionalizacion ?? "pendiente"}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            >
              {ESTADOS_NACIONALIZACION.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_NACIONALIZACION_LABELS[e]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Fecha límite nacionalización"
            name="fechaLimiteNacionalizacion"
            type="date"
            defaultValue={initialImportacion.fechaLimiteNacionalizacion ?? ""}
          />

          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Estado SENIAT</span>
            <select
              name="estadoSeniat"
              defaultValue={initialImportacion.estadoSeniat ?? "pendiente"}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            >
              {ESTADOS_SENIAT.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_SENIAT_LABELS[e]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Fecha presentación SENIAT"
            name="fechaPresentacionSeniat"
            type="date"
            defaultValue={initialImportacion.fechaPresentacionSeniat ?? ""}
          />

          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Observaciones</span>
            <textarea
              name="observaciones"
              rows={3}
              defaultValue={initialImportacion.observaciones ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar datos de importación"}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Memoria fotográfica */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Camera className="h-5 w-5 text-cyan-400" />
          2. Memoria fotográfica
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {fotosCount}/{MEMORIA_FOTOGRAFICA_TIPOS.length}
          </span>
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Captura el estado del vehículo al registrar. Las fotos se guardan como PDF en el
          expediente.
        </p>
        <div className="mt-4 grid gap-3">
          {MEMORIA_FOTOGRAFICA_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              hint="Toma foto con la cámara o elige una imagen · se convierte a PDF"
              actionLabel="Tomar / subir foto"
              onUploaded={(next) => {
                setDocs(next);
                setMessage("Foto guardada en el expediente");
                setError(null);
                router.refresh();
              }}
            />
          ))}
        </div>
      </section>

      {/* 3. Documentos */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          3. Carga de documentos
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {docsCount}/{IMPORT_DOCUMENTO_TIPOS.length}
          </span>
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Factura, BL, certificados y demás piezas del expediente de importación.
        </p>
        <div className="mt-4 grid gap-3">
          {IMPORT_DOCUMENTO_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              onUploaded={(next) => {
                setDocs(next);
                setMessage("Documento guardado en el expediente");
                setError(null);
                router.refresh();
              }}
            />
          ))}
          <ImportDocumentoUpload
            vehiculoId={vehiculoId}
            tipo="cedula"
            existingUrl={docs.cedula?.url}
            onUploaded={(next) => {
              setDocs(next);
              setMessage("Cédula guardada");
              setError(null);
              router.refresh();
            }}
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-between">
        <Link
          href={`/puerto-libre/${vehiculoId}`}
          className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-500"
        >
          Ir a la ficha
        </Link>
        <Link
          href={`/puerto-libre/${vehiculoId}/inspeccion`}
          className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Continuar a inspección transportista
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  className = "",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-sm text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
      />
    </label>
  );
}
