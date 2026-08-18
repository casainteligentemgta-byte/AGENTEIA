"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  setPuertoLibrePinAction,
  updatePuertoLibreImportacionAction,
  updatePuertoLibrePropietarioAction,
  updatePuertoLibreSeguroAction,
  updatePuertoLibreVehiculoAction,
  type PuertoLibreFicha,
} from "@/app/actions/nfc/importacion-vehiculo";
import { createNfcStickerAction } from "@/app/actions/nfc/nfc-management";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { NFCQRCode } from "@/components/nfc/NFCQRCode";
import { PinFieldWithReveal } from "@/components/nfc/PinFieldWithReveal";
import {
  ESTADOS_NACIONALIZACION,
  ESTADOS_SENIAT,
  ESTADO_NACIONALIZACION_LABELS,
  ESTADO_SENIAT_LABELS,
  IMPORT_DOCUMENTO_TIPOS,
  SEGURO_DOCUMENTO_TIPOS,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import { placaRealVisible } from "@/lib/importacion/expediente";
import { SeniatRechazoPanel } from "@/components/nfc/SeniatRechazoPanel";
import {
  ADUANAS_VENEZUELA,
  resolveAduanaVenezuela,
} from "@/lib/importacion/aduanas-venezuela";
import { PAISES, resolvePais } from "@/lib/importacion/paises";

type Props = {
  ficha: PuertoLibreFicha;
  baseUrl: string;
  canMutate?: boolean;
};

export function PuertoLibreFichaClient({
  ficha,
  baseUrl,
  canMutate = false,
}: Props) {
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

      <SeniatRechazoPanel
        vehiculoId={ficha.id}
        importacion={ficha.importacion}
        canMutate={canMutate}
      />

      {/* 1. Documentos de importación */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Documentos de importación</h2>
          <Link
            href={`/smartimport/${ficha.id}/planilla`}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Usar planilla
          </Link>
        </div>
        <div className="mt-4 grid gap-3">
          {IMPORT_DOCUMENTO_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={ficha.id}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              acceptMode={tipo === "manual_vehiculo" ? "pdf" : "both"}
              actionLabel={tipo === "manual_vehiculo" ? "Subir PDF" : undefined}
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
        <p className="mt-1 text-sm text-slate-500">
          Régimen de importación y referencias aduaneras.
        </p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            startTransition(async () => {
              const money = (key: string) => {
                const raw = String(fd.get(key) ?? "").trim();
                return raw ? Number(raw) : null;
              };
              const result = await updatePuertoLibreImportacionAction({
                vehiculoId: ficha.id,
                regimen: String(fd.get("regimen") ?? "") || "puerto_libre",
                aduana: String(fd.get("aduana") ?? "") || null,
                puerto: String(fd.get("puerto") ?? "") || null,
                modalidadTransito:
                  (String(fd.get("modalidadTransito") ?? "") as
                    | "ninguno"
                    | "transito"
                    | "uso24"
                    | "") || null,
                aduanaTransito: String(fd.get("aduanaTransito") ?? "") || null,
                fechaLlegadaBuque: String(fd.get("fechaLlegadaBuque") ?? "") || null,
                fechaIngreso: String(fd.get("fechaIngreso") ?? "") || null,
                fechaLiquidacion: String(fd.get("fechaLiquidacion") ?? "") || null,
                numeroBl: String(fd.get("numeroBl") ?? "") || null,
                paisOrigen: String(fd.get("paisOrigen") ?? "") || null,
                valorCif: money("valorCif"),
                costosArancelariosUsd: money("costosArancelariosUsd"),
                gastosPuertoUsd: money("gastosPuertoUsd"),
                fleteInternacionalUsd: money("fleteInternacionalUsd"),
                costoTotalLandedUsd: money("costoTotalLandedUsd"),
                agenteAduanal: String(fd.get("agenteAduanal") ?? "") || null,
                observaciones: String(fd.get("observaciones") ?? "") || null,
                estadoNacionalizacion:
                  String(fd.get("estadoNacionalizacion") ?? "") || "pendiente",
                fechaLimiteNacionalizacion:
                  String(fd.get("fechaLimiteNacionalizacion") ?? "") || null,
                estadoSeniat: String(fd.get("estadoSeniat") ?? "") || "pendiente",
                fechaPresentacionSeniat:
                  String(fd.get("fechaPresentacionSeniat") ?? "") || null,
              });
              if (!result.success) flash(null, result.error);
              else {
                flash("Importación actualizada", null);
                router.refresh();
              }
            });
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Régimen</span>
            <select
              name="regimen"
              defaultValue={ficha.importacion.regimen ?? "puerto_libre"}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            >
              <option value="ordinario">Régimen ordinario</option>
              <option value="equipaje">Régimen de equipaje</option>
              <option value="puerto_libre">Puerto Libre</option>
              <option value="diplomatico">Régimen diplomático</option>
              <option value="temporal">Admisión temporal</option>
            </select>
          </label>
          <SelectField
            label="Aduana"
            name="aduana"
            defaultValue={resolveAduanaVenezuela(ficha.importacion.aduana)}
            options={ADUANAS_VENEZUELA}
            placeholder="Selecciona aduana"
          />
          <SelectField
            label="País de origen"
            name="paisOrigen"
            defaultValue={resolvePais(ficha.importacion.paisOrigen)}
            options={PAISES}
            placeholder="Selecciona país"
          />
          <Field
            label="Puerto"
            name="puerto"
            defaultValue={ficha.importacion.puerto ?? ""}
          />
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Tránsito o USO24</span>
            <select
              name="modalidadTransito"
              defaultValue={ficha.importacion.modalidadTransito ?? "ninguno"}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            >
              <option value="ninguno">Sin tránsito / USO24</option>
              <option value="transito">Tránsito</option>
              <option value="uso24">USO24</option>
            </select>
          </label>
          <SelectField
            label="Aduana (tránsito / USO24)"
            name="aduanaTransito"
            defaultValue={resolveAduanaVenezuela(
              ficha.importacion.aduanaTransito
            )}
            options={ADUANAS_VENEZUELA}
            placeholder="Si aplica"
          />
          <Field
            label="Nº BL / Guía"
            name="numeroBl"
            defaultValue={ficha.importacion.numeroBl ?? ""}
          />
          <Field
            label="Fecha llegada del buque"
            name="fechaLlegadaBuque"
            type="date"
            defaultValue={ficha.importacion.fechaLlegadaBuque ?? ""}
          />
          <Field
            label="Fecha de ingreso al PL"
            name="fechaIngreso"
            type="date"
            defaultValue={ficha.importacion.fechaIngreso ?? ""}
          />
          <Field
            label="Fecha liquidación SENIAT"
            name="fechaLiquidacion"
            type="date"
            defaultValue={ficha.importacion.fechaLiquidacion ?? ""}
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
            label="Aranceles (USD)"
            name="costosArancelariosUsd"
            type="number"
            defaultValue={
              ficha.importacion.costosArancelariosUsd != null
                ? String(ficha.importacion.costosArancelariosUsd)
                : ""
            }
          />
          <Field
            label="Gastos de puerto (USD)"
            name="gastosPuertoUsd"
            type="number"
            defaultValue={
              ficha.importacion.gastosPuertoUsd != null
                ? String(ficha.importacion.gastosPuertoUsd)
                : ""
            }
          />
          <Field
            label="Flete internacional (USD)"
            name="fleteInternacionalUsd"
            type="number"
            defaultValue={
              ficha.importacion.fleteInternacionalUsd != null
                ? String(ficha.importacion.fleteInternacionalUsd)
                : ""
            }
          />
          <Field
            label="Costo total landed (USD)"
            name="costoTotalLandedUsd"
            type="number"
            defaultValue={
              ficha.importacion.costoTotalLandedUsd != null
                ? String(ficha.importacion.costoTotalLandedUsd)
                : ""
            }
          />
          <Field
            label="Agente aduanal"
            name="agenteAduanal"
            defaultValue={ficha.importacion.agenteAduanal ?? ""}
            className="sm:col-span-2"
          />

          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Estado nacionalización</span>
            <select
              name="estadoNacionalizacion"
              defaultValue={ficha.importacion.estadoNacionalizacion ?? "pendiente"}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            >
              {ESTADOS_NACIONALIZACION.map((estado) => (
                <option key={estado} value={estado}>
                  {ESTADO_NACIONALIZACION_LABELS[estado]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Fecha límite nacionalización"
            name="fechaLimiteNacionalizacion"
            type="date"
            defaultValue={ficha.importacion.fechaLimiteNacionalizacion ?? ""}
          />

          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Estado SENIAT</span>
            <select
              name="estadoSeniat"
              defaultValue={ficha.importacion.estadoSeniat ?? "pendiente"}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            >
              {ESTADOS_SENIAT.map((estado) => (
                <option key={estado} value={estado}>
                  {ESTADO_SENIAT_LABELS[estado]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Fecha presentación SENIAT"
            name="fechaPresentacionSeniat"
            type="date"
            defaultValue={ficha.importacion.fechaPresentacionSeniat ?? ""}
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

      {/* 3. Seguro y datos de seguridad */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Seguro y datos de seguridad</h2>
        <p className="mt-1 text-sm text-slate-500">
          Póliza, coberturas, dispositivos de seguridad y documentos escaneados.
        </p>

        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            startTransition(async () => {
              const montoRaw = String(fd.get("montoAsegurado") ?? "").trim();
              const result = await updatePuertoLibreSeguroAction({
                vehiculoId: ficha.id,
                aseguradora: String(fd.get("aseguradora") ?? "") || null,
                numeroPoliza: String(fd.get("numeroPoliza") ?? "") || null,
                tipoCobertura: String(fd.get("tipoCobertura") ?? "") || null,
                vigenciaDesde: String(fd.get("vigenciaDesde") ?? "") || null,
                vigenciaHasta: String(fd.get("vigenciaHasta") ?? "") || null,
                montoAsegurado: montoRaw ? Number(montoRaw) : null,
                telefonoAseguradora: String(fd.get("telefonoAseguradora") ?? "") || null,
                corredor: String(fd.get("corredor") ?? "") || null,
                observaciones: String(fd.get("observacionesSeguro") ?? "") || null,
                tieneAlarma: fd.get("tieneAlarma") === "on",
                tieneGps: fd.get("tieneGps") === "on",
                tieneInmovilizador: fd.get("tieneInmovilizador") === "on",
                dispositivosSeguridad:
                  String(fd.get("dispositivosSeguridad") ?? "") || null,
                contactoEmergencia: String(fd.get("contactoEmergencia") ?? "") || null,
                telefonoEmergencia: String(fd.get("telefonoEmergencia") ?? "") || null,
              });
              if (!result.success) flash(null, result.error);
              else {
                flash("Seguro y seguridad actualizados", null);
                router.refresh();
              }
            });
          }}
        >
          <Field
            label="Aseguradora"
            name="aseguradora"
            defaultValue={ficha.seguro.aseguradora ?? ""}
          />
          <Field
            label="Nº de póliza"
            name="numeroPoliza"
            defaultValue={ficha.seguro.numeroPoliza ?? ""}
          />
          <Field
            label="Tipo de cobertura"
            name="tipoCobertura"
            defaultValue={ficha.seguro.tipoCobertura ?? ""}
            placeholder="RCV, todo riesgo…"
          />
          <Field
            label="Teléfono aseguradora"
            name="telefonoAseguradora"
            defaultValue={ficha.seguro.telefonoAseguradora ?? ""}
          />
          <Field
            label="Vigencia desde"
            name="vigenciaDesde"
            type="date"
            defaultValue={ficha.seguro.vigenciaDesde ?? ""}
          />
          <Field
            label="Vigencia hasta"
            name="vigenciaHasta"
            type="date"
            defaultValue={ficha.seguro.vigenciaHasta ?? ""}
          />
          <Field
            label="Monto asegurado (USD)"
            name="montoAsegurado"
            type="number"
            defaultValue={
              ficha.seguro.montoAsegurado != null ? String(ficha.seguro.montoAsegurado) : ""
            }
          />
          <Field
            label="Corredor / agente"
            name="corredor"
            defaultValue={ficha.seguro.corredor ?? ""}
          />

          <p className="sm:col-span-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Dispositivos de seguridad
          </p>
          <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-200">
            <input
              type="checkbox"
              name="tieneAlarma"
              defaultChecked={Boolean(ficha.seguro.tieneAlarma)}
              className="rounded border-slate-600"
            />
            Alarma
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-200">
            <input
              type="checkbox"
              name="tieneGps"
              defaultChecked={Boolean(ficha.seguro.tieneGps)}
              className="rounded border-slate-600"
            />
            GPS / rastreador
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-200 sm:col-span-2">
            <input
              type="checkbox"
              name="tieneInmovilizador"
              defaultChecked={Boolean(ficha.seguro.tieneInmovilizador)}
              className="rounded border-slate-600"
            />
            Inmovilizador
          </label>
          <Field
            label="Otros dispositivos / notas"
            name="dispositivosSeguridad"
            defaultValue={ficha.seguro.dispositivosSeguridad ?? ""}
            placeholder="Ej. candado de volante…"
            className="sm:col-span-2"
          />
          <Field
            label="Contacto de emergencia"
            name="contactoEmergencia"
            defaultValue={ficha.seguro.contactoEmergencia ?? ""}
          />
          <Field
            label="Teléfono de emergencia"
            name="telefonoEmergencia"
            defaultValue={ficha.seguro.telefonoEmergencia ?? ""}
          />
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Observaciones del seguro</span>
            <textarea
              name="observacionesSeguro"
              rows={3}
              defaultValue={ficha.seguro.observaciones ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <div className="sm:col-span-2">
            <SaveButton pending={pending} label="Guardar seguro y seguridad" />
          </div>
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-300">Documentos del seguro</h3>
          <p className="mt-1 text-xs text-slate-500">
            Escanea (foto → PDF) o sube PDF; se almacena en el perfil del vehículo.
          </p>
          <div className="mt-3 grid gap-3">
            {SEGURO_DOCUMENTO_TIPOS.map((tipo) => (
              <ImportDocumentoUpload
                key={tipo}
                vehiculoId={ficha.id}
                tipo={tipo}
                existingUrl={docs[tipo]?.url}
                onUploaded={(next) => {
                  setDocs(next);
                  flash("Documento de seguro guardado en el perfil", null);
                  router.refresh();
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 4. Datos del vehículo */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Datos del vehículo</h2>
        <p className="mt-1 text-sm text-slate-500">
          Expediente {ficha.codigoExpediente ?? "—"}. La placa se carga cuando la
          obtengas (aún no hace falta al registrar).
        </p>
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
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Expediente</span>
            <input
              type="text"
              readOnly
              value={ficha.codigoExpediente ?? "—"}
              className="w-full cursor-default rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-cyan-300 outline-none"
            />
          </label>
          <Field
            label="Placa"
            name="placa"
            defaultValue={placaRealVisible(ficha.placa, ficha.codigoExpediente) ?? ""}
            placeholder="Cuando la obtengas"
            className="uppercase"
          />
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

      {/* 5. Propietario */}
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

      {/* 6. NFC */}
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
          <PinFieldWithReveal
            label={`PIN de desbloqueo ${ficha.tienePin ? "(ya configurado)" : ""}`}
            required
            labelClassName="text-sm text-slate-400"
            inputClassName="border-slate-700 bg-slate-900 text-slate-100 focus:border-cyan-500/60"
          />
          <SaveButton pending={pending} label="Guardar PIN" />
        </form>

        {ficha.sticker ? (
          <div className="mt-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm text-slate-300">
                Estado:{" "}
                <span className={ficha.sticker.activo ? "text-emerald-400" : "text-slate-500"}>
                  {ficha.sticker.activo ? "Activo" : "Inactivo"}
                </span>
              </p>
              <div className="rounded-xl border border-cyan-700/50 bg-cyan-950/30 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-400/80">
                  URL NFC (para NFC Tools)
                </p>
                <a
                  href={`${baseUrl}/v/${ficha.sticker.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 block break-all font-mono text-sm leading-relaxed text-cyan-200 hover:text-cyan-100"
                >
                  {baseUrl}/v/{ficha.sticker.token}
                </a>
              </div>
              <a
                href={`/api/nfc/download?id=${ficha.sticker.id}&format=txt`}
                className="inline-block text-xs text-slate-400 hover:text-slate-200"
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
                  etiqueta: ficha.codigoExpediente ?? ficha.placa,
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

function SelectField({
  label,
  name,
  defaultValue = "",
  options,
  placeholder,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: readonly string[];
  placeholder?: string;
  className?: string;
}) {
  const items =
    defaultValue.trim() && !options.some((o) => o === defaultValue.trim())
      ? [defaultValue.trim(), ...options]
      : options;

  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-sm text-slate-400">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
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
