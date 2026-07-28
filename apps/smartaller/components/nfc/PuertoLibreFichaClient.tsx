"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  setPuertoLibrePinAction,
  updatePuertoLibreImportacionAction,
  updatePuertoLibrePropietarioAction,
  updatePuertoLibreVehiculoAction,
  type PuertoLibreFicha,
} from "@/app/actions/nfc/puerto-libre-vehiculo";
import { createNfcStickerAction } from "@/app/actions/nfc/nfc-management";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { NFCQRCode } from "@/components/nfc/NFCQRCode";
import { IMPORT_DOCUMENTO_TIPOS, type VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";

type Props = {
  ficha: PuertoLibreFicha;
  baseUrl: string;
};

export function PuertoLibreFichaClient({ ficha, baseUrl }: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState<VehiculosDocumentos>(ficha.documentos);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flash(ok: string | null, err: string | null) {
    setMessage(ok);
    setError(err);
  }

  return (
    <div className="space-y-8">
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

      {/* 1. Documentos de importación */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Documentos de importación</h2>
        <p className="mt-1 text-sm text-slate-500">
          Carga el expediente aduanero y de propiedad del vehículo.
        </p>
        <div className="mt-4 grid gap-3">
          {IMPORT_DOCUMENTO_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={ficha.id}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              onUploaded={(next) => {
                setDocs(next);
                flash("Documento guardado", null);
                router.refresh();
              }}
            />
          ))}
          <ImportDocumentoUpload
            vehiculoId={ficha.id}
            tipo="cedula"
            existingUrl={docs.cedula?.url}
            onUploaded={(next) => {
              setDocs(next);
              flash("Cédula guardada", null);
              router.refresh();
            }}
          />
        </div>
      </section>

      {/* 2. Datos de importación */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Datos de importación</h2>
        <p className="mt-1 text-sm text-slate-500">Régimen Puerto Libre y referencias aduaneras.</p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            startTransition(async () => {
              const valorRaw = String(fd.get("valorCif") ?? "").trim();
              const result = await updatePuertoLibreImportacionAction({
                vehiculoId: ficha.id,
                regimen: String(fd.get("regimen") ?? "") || "Puerto Libre",
                aduana: String(fd.get("aduana") ?? "") || null,
                fechaIngreso: String(fd.get("fechaIngreso") ?? "") || null,
                numeroBl: String(fd.get("numeroBl") ?? "") || null,
                paisOrigen: String(fd.get("paisOrigen") ?? "") || null,
                valorCif: valorRaw ? Number(valorRaw) : null,
                agenteAduanal: String(fd.get("agenteAduanal") ?? "") || null,
                observaciones: String(fd.get("observaciones") ?? "") || null,
              });
              if (!result.success) flash(null, result.error);
              else {
                flash("Importación actualizada", null);
                router.refresh();
              }
            });
          }}
        >
          <Field
            label="Régimen"
            name="regimen"
            defaultValue={ficha.importacion.regimen ?? "Puerto Libre"}
          />
          <Field label="Aduana" name="aduana" defaultValue={ficha.importacion.aduana ?? ""} />
          <Field
            label="Fecha de ingreso"
            name="fechaIngreso"
            type="date"
            defaultValue={ficha.importacion.fechaIngreso ?? ""}
          />
          <Field
            label="Nº BL / Guía"
            name="numeroBl"
            defaultValue={ficha.importacion.numeroBl ?? ""}
          />
          <Field
            label="País de origen"
            name="paisOrigen"
            defaultValue={ficha.importacion.paisOrigen ?? ""}
          />
          <Field
            label="Valor CIF (USD)"
            name="valorCif"
            type="number"
            defaultValue={
              ficha.importacion.valorCif != null ? String(ficha.importacion.valorCif) : ""
            }
          />
          <Field
            label="Agente aduanal"
            name="agenteAduanal"
            defaultValue={ficha.importacion.agenteAduanal ?? ""}
            className="sm:col-span-2"
          />
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Observaciones</span>
            <textarea
              name="observaciones"
              rows={3}
              defaultValue={ficha.importacion.observaciones ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <div className="sm:col-span-2">
            <SaveButton pending={pending} label="Guardar importación" />
          </div>
        </form>
      </section>

      {/* 3. Datos del vehículo */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Datos del vehículo</h2>
        <p className="mt-1 text-sm text-slate-500">Identificación y estado del automóvil.</p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            startTransition(async () => {
              const result = await updatePuertoLibreVehiculoAction({
                vehiculoId: ficha.id,
                placa: String(fd.get("placa") ?? ""),
                marca: String(fd.get("marca") ?? "") || null,
                modelo: String(fd.get("modelo") ?? "") || null,
                color: String(fd.get("color") ?? "") || null,
                serialMotor: String(fd.get("serialMotor") ?? "") || null,
                serialCarroceria: String(fd.get("serialCarroceria") ?? "") || null,
                kilometrajeUltimo: String(fd.get("kilometrajeUltimo") ?? "") || null,
              });
              if (!result.success) flash(null, result.error);
              else {
                flash("Vehículo actualizado", null);
                router.refresh();
              }
            });
          }}
        >
          <Field label="Placa" name="placa" defaultValue={ficha.placa} className="uppercase" />
          <Field label="Marca" name="marca" defaultValue={ficha.marca ?? ""} />
          <Field label="Modelo" name="modelo" defaultValue={ficha.modelo ?? ""} />
          <Field label="Color" name="color" defaultValue={ficha.color ?? ""} />
          <Field
            label="Serial motor"
            name="serialMotor"
            defaultValue={ficha.serial_motor ?? ""}
          />
          <Field
            label="VIN / chasis"
            name="serialCarroceria"
            defaultValue={ficha.serial_carroceria ?? ""}
          />
          <Field
            label="Kilometraje"
            name="kilometrajeUltimo"
            type="number"
            defaultValue={
              ficha.kilometraje_ultimo != null ? String(ficha.kilometraje_ultimo) : ""
            }
          />
          <div className="sm:col-span-2">
            <SaveButton pending={pending} label="Guardar vehículo" />
          </div>
        </form>
      </section>

      {/* 4. Propietario */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Propietario</h2>
        <p className="mt-1 text-sm text-slate-500">Datos del titular del vehículo.</p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            startTransition(async () => {
              const result = await updatePuertoLibrePropietarioAction({
                vehiculoId: ficha.id,
                nombreCliente: String(fd.get("nombreCliente") ?? "") || null,
                telefonoCliente: String(fd.get("telefonoCliente") ?? "") || null,
                cedulaPropietario: String(fd.get("cedulaPropietario") ?? "") || null,
                emailPropietario: String(fd.get("emailPropietario") ?? "") || null,
                fechaNacimientoPropietario:
                  String(fd.get("fechaNacimientoPropietario") ?? "") || null,
              });
              if (!result.success) flash(null, result.error);
              else {
                flash("Propietario actualizado", null);
                router.refresh();
              }
            });
          }}
        >
          <Field
            label="Nombre completo"
            name="nombreCliente"
            defaultValue={ficha.nombre_cliente ?? ""}
            className="sm:col-span-2"
          />
          <Field
            label="Cédula"
            name="cedulaPropietario"
            defaultValue={ficha.cedula_propietario ?? ""}
          />
          <Field
            label="Teléfono"
            name="telefonoCliente"
            defaultValue={ficha.telefono_cliente ?? ""}
          />
          <Field
            label="Email"
            name="emailPropietario"
            type="email"
            defaultValue={ficha.email_propietario ?? ""}
          />
          <Field
            label="Fecha de nacimiento"
            name="fechaNacimientoPropietario"
            type="date"
            defaultValue={ficha.fecha_nacimiento_propietario ?? ""}
          />
          <div className="sm:col-span-2">
            <SaveButton pending={pending} label="Guardar propietario" />
          </div>
        </form>
      </section>

      {/* 5. NFC */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Sticker NFC</h2>
        <p className="mt-1 text-sm text-slate-500">
          PIN y enlace público para el expediente digital.
        </p>

        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          action={(fd) => {
            startTransition(async () => {
              const result = await setPuertoLibrePinAction({
                vehiculoId: ficha.id,
                pin: String(fd.get("pin") ?? ""),
              });
              if (!result.success) flash(null, result.error);
              else {
                flash("PIN NFC actualizado", null);
                router.refresh();
              }
            });
          }}
        >
          <label className="block flex-1 space-y-1.5">
            <span className="text-sm text-slate-400">
              PIN de desbloqueo {ficha.tienePin ? "(ya configurado)" : ""}
            </span>
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="4–8 dígitos"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
              required
            />
          </label>
          <SaveButton pending={pending} label="Guardar PIN" />
        </form>

        {ficha.sticker ? (
          <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-slate-300">
                Estado:{" "}
                <span className={ficha.sticker.activo ? "text-emerald-400" : "text-slate-500"}>
                  {ficha.sticker.activo ? "Activo" : "Inactivo"}
                </span>
              </p>
              <a
                href={`${baseUrl}/v/${ficha.sticker.token}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate font-mono text-xs text-cyan-400 hover:text-cyan-300"
              >
                {baseUrl}/v/{ficha.sticker.token}
              </a>
              <a
                href={`/api/nfc/download?id=${ficha.sticker.id}&format=txt`}
                className="mt-2 inline-block text-xs text-slate-400 hover:text-slate-200"
              >
                Descargar payload NFC
              </a>
            </div>
            <NFCQRCode url={`${baseUrl}/v/${ficha.sticker.token}`} size={140} />
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                if (!ficha.tienePin) {
                  flash(null, "Configura el PIN antes de crear el sticker NFC.");
                  return;
                }
                const result = await createNfcStickerAction({
                  vehiculoId: ficha.id,
                  placa: ficha.placa,
                  marca: ficha.marca,
                  modelo: ficha.modelo,
                  color: ficha.color,
                  nombreTitular: ficha.nombre_cliente,
                  etiqueta: `PL-${ficha.placa}`,
                });
                if (!result.success) flash(null, result.error);
                else {
                  flash("Sticker NFC creado", null);
                  router.refresh();
                }
              });
            }}
            className="mt-4 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
          >
            Generar sticker NFC para este vehículo
          </button>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-sm text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
      />
    </label>
  );
}

function SaveButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-60"
    >
      {pending ? "Guardando…" : label}
    </button>
  );
}
