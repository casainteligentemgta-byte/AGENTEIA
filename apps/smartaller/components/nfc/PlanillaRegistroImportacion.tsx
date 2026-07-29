"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Camera, ClipboardList, FileUp, Ship, User } from "lucide-react";
import { updatePuertoLibreImportacionAction } from "@/app/actions/nfc/puerto-libre-vehiculo";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import {
  MEMORIA_FOTOGRAFICA_TIPOS,
  PL_REGISTRO_DOCUMENTO_TIPOS,
  type ImportacionData,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

type Props = {
  vehiculoId: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serialMotor: string | null;
  serialCarroceria: string | null;
  compradorNombre: string | null;
  compradorTelefono: string | null;
  compradorCedula: string | null;
  initialImportacion: ImportacionData;
  initialDocumentos: VehiculosDocumentos;
};

export function PlanillaRegistroImportacion({
  vehiculoId,
  placa,
  marca,
  modelo,
  color,
  serialMotor,
  serialCarroceria,
  compradorNombre,
  compradorTelefono,
  compradorCedula,
  initialImportacion,
  initialDocumentos,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [docs, setDocs] = useState(initialDocumentos);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fotosCount = MEMORIA_FOTOGRAFICA_TIPOS.filter((t) => Boolean(docs[t])).length;
  const docsCount = PL_REGISTRO_DOCUMENTO_TIPOS.filter((t) => Boolean(docs[t])).length;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
        Memoria fotográfica y documentos para{" "}
        <span className="font-mono text-cyan-300">{placa}</span>
        {marca || modelo ? (
          <span className="text-cyan-200/80">
            {" "}
            · {[marca, modelo].filter(Boolean).join(" ")}
            {initialImportacion.anio ? ` (${initialImportacion.anio})` : ""}
          </span>
        ) : null}
        .
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

      {/* Resumen datos ya cargados */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <ClipboardList className="h-5 w-5 text-cyan-400" />
          Resumen del registro
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Placa (texto)" value={placa} mono />
          <Item label="Color" value={color} />
          <Item label="Año" value={initialImportacion.anio != null ? String(initialImportacion.anio) : null} />
          <Item label="Serial carrocería" value={serialCarroceria} mono />
          <Item label="Serial motor" value={serialMotor} mono />
          <Item label="Fecha ingreso PL" value={initialImportacion.fechaIngreso} />
          <Item label="Importador" value={initialImportacion.importadorNombre} />
          <Item label="Comprador" value={compradorNombre} />
          <Item label="Tel. comprador" value={compradorTelefono} />
          <Item label="Cédula comprador" value={compradorCedula} />
        </dl>
      </section>

      {/* Ajuste importador / fecha */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Ship className="h-5 w-5 text-cyan-400" />
          Importador y fecha PL
        </h2>
        <p className="mt-1 text-sm text-slate-500">Puedes corregir estos datos si hace falta.</p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const anioRaw = String(fd.get("anio") ?? "").trim();
              const result = await updatePuertoLibreImportacionAction({
                vehiculoId,
                fechaIngreso: String(fd.get("fechaIngreso") ?? "") || null,
                anio: anioRaw ? Number(anioRaw) : null,
                importadorNombre: String(fd.get("importadorNombre") ?? "") || null,
                importadorDocumento: String(fd.get("importadorDocumento") ?? "") || null,
                importadorTelefono: String(fd.get("importadorTelefono") ?? "") || null,
                importadorEmail: String(fd.get("importadorEmail") ?? "") || null,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Datos de importación actualizados");
              router.refresh();
            });
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Fecha ingreso PL</span>
            <input
              name="fechaIngreso"
              type="date"
              defaultValue={initialImportacion.fechaIngreso ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Año del vehículo</span>
            <input
              name="anio"
              type="number"
              defaultValue={
                initialImportacion.anio != null ? String(initialImportacion.anio) : ""
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Importador</span>
            <input
              name="importadorNombre"
              defaultValue={initialImportacion.importadorNombre ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">RIF / cédula importador</span>
            <input
              name="importadorDocumento"
              defaultValue={initialImportacion.importadorDocumento ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Tel. importador</span>
            <input
              name="importadorTelefono"
              defaultValue={initialImportacion.importadorTelefono ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Email importador</span>
            <input
              name="importadorEmail"
              type="email"
              defaultValue={initialImportacion.importadorEmail ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>

      {/* Memoria fotográfica */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Camera className="h-5 w-5 text-cyan-400" />
          Memoria fotográfica
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {fotosCount}/{MEMORIA_FOTOGRAFICA_TIPOS.length}
          </span>
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Foto de la placa, 4 lados del vehículo, motor e impronta. Las fotos se guardan como PDF en
          el expediente.
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
                setMessage("Foto guardada");
                setError(null);
                router.refresh();
              }}
            />
          ))}
        </div>
      </section>

      {/* Documentos */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Documentos
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {docsCount}/{PL_REGISTRO_DOCUMENTO_TIPOS.length}
          </span>
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Manual, BL, factura, documento de importación y cédula del comprador.
        </p>
        <div className="mt-4 grid gap-3">
          {PL_REGISTRO_DOCUMENTO_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              onUploaded={(next) => {
                setDocs(next);
                setMessage("Documento guardado");
                setError(null);
                router.refresh();
              }}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-between">
        <Link
          href={`/puerto-libre/${vehiculoId}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-500"
        >
          <User className="h-4 w-4" />
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

function Item({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-slate-200 ${mono ? "font-mono text-xs" : ""}`}>
        {value?.trim() || "—"}
      </dd>
    </div>
  );
}
