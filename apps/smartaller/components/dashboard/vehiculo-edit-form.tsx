"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { updateVehiculoTallerAction } from "@/app/actions/vehiculos";
import type { TipoVehiculo } from "@/lib/vehicles/types";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { VehicleTypePicker, VehicleTypeIcon } from "@/components/app/vehicle-type-picker";
import { DocumentoScanInput } from "@/components/dashboard/documento-scan-input";
import type { VehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";

type FormFields = {
  placa: string;
  marca: string;
  modelo: string;
  color: string;
  serialMotor: string;
  serialCarroceria: string;
  nombreCliente: string;
  telefonoCliente: string;
  cedulaPropietario: string;
  emailPropietario: string;
  fechaNacimientoPropietario: string;
  odometro: string;
};

type VehiculoEditFormProps = {
  vehiculoId: string;
  tipoVehiculo: TipoVehiculo;
  placa: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serialMotor: string | null;
  serialCarroceria: string | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  cedulaPropietario: string | null;
  emailPropietario: string | null;
  fechaNacimientoPropietario: string | null;
  unidadOdometro: string | null;
  kilometrajeUltimo: number | null;
  horasMotorUltimo: number | null;
  documentos: VehiculosDocumentos;
};

function odometroInicial(
  unidadOdometro: string | null,
  kilometrajeUltimo: number | null,
  horasMotorUltimo: number | null
): string {
  const valor = unidadOdometro === "horas" ? horasMotorUltimo : kilometrajeUltimo;
  return valor != null ? String(valor) : "";
}

export function VehiculoEditForm({
  vehiculoId,
  tipoVehiculo,
  placa,
  marca,
  modelo,
  color,
  serialMotor,
  serialCarroceria,
  nombreCliente,
  telefonoCliente,
  cedulaPropietario,
  emailPropietario,
  fechaNacimientoPropietario,
  unidadOdometro,
  kilometrajeUltimo,
  horasMotorUltimo,
  documentos: documentosIniciales,
}: VehiculoEditFormProps) {
  const [tipo, setTipo] = useState<TipoVehiculo>(tipoVehiculo);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [documentos, setDocumentos] = useState<VehiculosDocumentos>(documentosIniciales);
  const [fields, setFields] = useState<FormFields>({
    placa,
    marca: marca ?? "",
    modelo: modelo ?? "",
    color: color ?? "",
    serialMotor: serialMotor ?? "",
    serialCarroceria: serialCarroceria ?? "",
    nombreCliente: nombreCliente ?? "",
    telefonoCliente: telefonoCliente ?? "",
    cedulaPropietario: cedulaPropietario ?? "",
    emailPropietario: emailPropietario ?? "",
    fechaNacimientoPropietario: fechaNacimientoPropietario ?? "",
    odometro: odometroInicial(unidadOdometro, kilometrajeUltimo, horasMotorUltimo),
  });

  const config = getConfigTipoVehiculo(tipo);
  const odometroLabel =
    config.unidadOdometro === "horas" ? "Horas de motor" : "Kilometraje";

  function updateField<K extends keyof FormFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function applyScannedFields(scanned: Record<string, string>) {
    setFields((prev) => ({
      ...prev,
      placa: scanned.placa ?? prev.placa,
      marca: scanned.marca ?? prev.marca,
      modelo: scanned.modelo ?? prev.modelo,
      color: scanned.color ?? prev.color,
      serialMotor: scanned.serialMotor ?? prev.serialMotor,
      serialCarroceria: scanned.serialCarroceria ?? prev.serialCarroceria,
      nombreCliente: scanned.nombreCliente ?? prev.nombreCliente,
      cedulaPropietario: scanned.cedulaPropietario ?? prev.cedulaPropietario,
      fechaNacimientoPropietario:
        scanned.fechaNacimientoPropietario ?? prev.fechaNacimientoPropietario,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await updateVehiculoTallerAction({
        vehiculoId,
        tipo_vehiculo: tipo,
        placa: fields.placa,
        marca: fields.marca,
        modelo: fields.modelo,
        color: fields.color,
        serialMotor: fields.serialMotor,
        serialCarroceria: fields.serialCarroceria,
        cedulaPropietario: fields.cedulaPropietario,
        emailPropietario: fields.emailPropietario,
        fechaNacimientoPropietario: fields.fechaNacimientoPropietario,
        nombreCliente: fields.nombreCliente,
        telefonoCliente: fields.telefonoCliente,
        odometro: fields.odometro,
        documentos: Object.keys(documentos).length > 0 ? documentos : {},
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Cambios guardados correctamente");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-zinc-400">Tipo de vehículo</p>
        <VehicleTypePicker value={tipo} onChange={setTipo} />
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Documentos del propietario</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Puedes volver a escanear para actualizar los datos
          </p>
        </div>

        <DocumentoScanInput
          tipo="cedula"
          label="Cédula del propietario"
          hint="Foto frontal de la cédula de ciudadanía"
          onScanned={({ documento, fields: scanned }) => {
            setDocumentos((prev) => ({ ...prev, cedula: documento }));
            applyScannedFields(scanned);
          }}
        />

        <DocumentoScanInput
          tipo="titulo"
          label="Título de propiedad"
          hint="Tarjeta de propiedad o licencia de tránsito del vehículo"
          onScanned={({ documento, fields: scanned }) => {
            setDocumentos((prev) => ({ ...prev, titulo: documento }));
            applyScannedFields(scanned);
          }}
        />

        {(documentos.cedula || documentos.titulo) && (
          <div className="flex flex-wrap gap-3">
            {documentos.cedula && (
              <a
                href={documentos.cedula.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-blue-300 hover:border-blue-500"
              >
                Ver cédula escaneada
              </a>
            )}
            {documentos.titulo && (
              <a
                href={documentos.titulo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-blue-300 hover:border-blue-500"
              >
                Ver título de propiedad
              </a>
            )}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15">
            <VehicleTypeIcon tipo={tipo} className="h-7 w-7 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Datos del vehículo</h2>
            <p className="text-sm text-zinc-500">Edita la ficha técnica y el odómetro</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="placa-edit" className="block text-sm font-medium text-zinc-300">
              Placa / identificador *
            </label>
            <input
              id="placa-edit"
              required
              value={fields.placa}
              onChange={(e) => updateField("placa", e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm uppercase outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="marca-edit" className="block text-sm font-medium text-zinc-300">
              Marca
            </label>
            <input
              id="marca-edit"
              value={fields.marca}
              onChange={(e) => updateField("marca", e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="modelo-edit" className="block text-sm font-medium text-zinc-300">
              Modelo
            </label>
            <input
              id="modelo-edit"
              value={fields.modelo}
              onChange={(e) => updateField("modelo", e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="color-edit" className="block text-sm font-medium text-zinc-300">
              Color
            </label>
            <input
              id="color-edit"
              value={fields.color}
              onChange={(e) => updateField("color", e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="serialMotor-edit" className="block text-sm font-medium text-zinc-300">
              Serial del motor
            </label>
            <input
              id="serialMotor-edit"
              value={fields.serialMotor}
              onChange={(e) => updateField("serialMotor", e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm uppercase outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="serialCarroceria-edit" className="block text-sm font-medium text-zinc-300">
              Serial de carrocería / chasis
            </label>
            <input
              id="serialCarroceria-edit"
              value={fields.serialCarroceria}
              onChange={(e) => updateField("serialCarroceria", e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm uppercase outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="odometro-edit" className="block text-sm font-medium text-zinc-300">
              {odometroLabel}
            </label>
            <input
              id="odometro-edit"
              inputMode="numeric"
              value={fields.odometro}
              onChange={(e) => updateField("odometro", e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="font-semibold text-zinc-100">Propietario y contacto</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Para recordatorios, WhatsApp y portal del cliente
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nombreCliente-edit" className="block text-sm font-medium text-zinc-300">
              Nombre completo *
            </label>
            <input
              id="nombreCliente-edit"
              required
              value={fields.nombreCliente}
              onChange={(e) => updateField("nombreCliente", e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="cedulaPropietario-edit" className="block text-sm font-medium text-zinc-300">
              Cédula
            </label>
            <input
              id="cedulaPropietario-edit"
              inputMode="numeric"
              value={fields.cedulaPropietario}
              onChange={(e) =>
                updateField("cedulaPropietario", e.target.value.replace(/\D/g, ""))
              }
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="emailPropietario-edit" className="block text-sm font-medium text-zinc-300">
              Correo electrónico
            </label>
            <input
              id="emailPropietario-edit"
              type="email"
              value={fields.emailPropietario}
              onChange={(e) => updateField("emailPropietario", e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="fechaNacimientoPropietario-edit"
              className="block text-sm font-medium text-zinc-300"
            >
              Fecha de nacimiento
            </label>
            <input
              id="fechaNacimientoPropietario-edit"
              type="date"
              value={fields.fechaNacimientoPropietario}
              onChange={(e) => updateField("fechaNacimientoPropietario", e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="telefonoCliente-edit" className="block text-sm font-medium text-zinc-300">
              Teléfono (WhatsApp) *
            </label>
            <input
              id="telefonoCliente-edit"
              required
              value={fields.telefonoCliente}
              onChange={(e) => updateField("telefonoCliente", e.target.value)}
              placeholder="3001234567"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {message && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar cambios
      </button>
    </form>
  );
}
