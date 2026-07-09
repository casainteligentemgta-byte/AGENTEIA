"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createVehiculoTallerAction } from "@/app/actions/vehiculos";
import type { TipoVehiculo } from "@/lib/vehicles/types";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { VehicleTypePicker, VehicleTypeIcon } from "@/components/app/vehicle-type-picker";
import { DocumentoScanInput } from "@/components/dashboard/documento-scan-input";
import { OrdenRecepcionForm } from "@/components/dashboard/orden-recepcion-form";
import { tieneDatosOrdenRecepcion, type OrdenRecepcionFormValue } from "@/lib/schemas/orden-recepcion";
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

const EMPTY_FIELDS: FormFields = {
  placa: "",
  marca: "",
  modelo: "",
  color: "",
  serialMotor: "",
  serialCarroceria: "",
  nombreCliente: "",
  telefonoCliente: "",
  cedulaPropietario: "",
  emailPropietario: "",
  fechaNacimientoPropietario: "",
  odometro: "",
};

export function VehiculoCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<TipoVehiculo>("auto");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FormFields>(EMPTY_FIELDS);
  const [documentos, setDocumentos] = useState<VehiculosDocumentos>({});
  const [ordenRecepcion, setOrdenRecepcion] = useState<OrdenRecepcionFormValue>({
    checklist: [],
    danos: [],
  });

  const config = getConfigTipoVehiculo(tipo);
  const odometroLabel =
    config.unidadOdometro === "horas" ? "Horas de motor al entrega" : "Kilometraje al entrega";

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const today = new Date().toISOString().slice(0, 10);
      const nowTime = new Date().toTimeString().slice(0, 5);
      const ordenPayload = tieneDatosOrdenRecepcion(ordenRecepcion)
        ? {
            ...ordenRecepcion,
            fechaIngreso: ordenRecepcion.fechaIngreso || today,
            horaIngreso: ordenRecepcion.horaIngreso || nowTime,
          }
        : undefined;

      const result = await createVehiculoTallerAction({
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
        documentos: Object.keys(documentos).length > 0 ? documentos : undefined,
        ordenRecepcion: ordenPayload,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/dashboard/vehiculos/${result.vehiculoId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-zinc-400">Tipo de vehículo</p>
        <VehicleTypePicker value={tipo} onChange={setTipo} />
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Documentos del propietario</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Escanea la cédula y el título de propiedad para precargar los datos
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
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15">
            <VehicleTypeIcon tipo={tipo} className="h-7 w-7 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Datos del vehículo</h2>
            <p className="text-sm text-zinc-500">Verifica o completa la información</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="placa" className="block text-sm font-medium text-zinc-300">
              Placa / identificador *
            </label>
            <input
              id="placa"
              required
              value={fields.placa}
              onChange={(e) => updateField("placa", e.target.value.toUpperCase())}
              placeholder="Ej. ABC123"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm uppercase outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="marca" className="block text-sm font-medium text-zinc-300">
              Marca
            </label>
            <input
              id="marca"
              value={fields.marca}
              onChange={(e) => updateField("marca", e.target.value)}
              placeholder="Ej. Toyota"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="modelo" className="block text-sm font-medium text-zinc-300">
              Modelo
            </label>
            <input
              id="modelo"
              value={fields.modelo}
              onChange={(e) => updateField("modelo", e.target.value)}
              placeholder="Ej. Corolla Cross"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="color" className="block text-sm font-medium text-zinc-300">
              Color
            </label>
            <input
              id="color"
              value={fields.color}
              onChange={(e) => updateField("color", e.target.value)}
              placeholder="Ej. Blanco perla"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="serialMotor" className="block text-sm font-medium text-zinc-300">
              Serial del motor
            </label>
            <input
              id="serialMotor"
              value={fields.serialMotor}
              onChange={(e) => updateField("serialMotor", e.target.value.toUpperCase())}
              placeholder="Ej. 2NZ-FE123456"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm uppercase outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="serialCarroceria" className="block text-sm font-medium text-zinc-300">
              Serial de carrocería / chasis
            </label>
            <input
              id="serialCarroceria"
              value={fields.serialCarroceria}
              onChange={(e) => updateField("serialCarroceria", e.target.value.toUpperCase())}
              placeholder="Ej. JTDBT923..."
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm uppercase outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="odometro" className="block text-sm font-medium text-zinc-300">
              {odometroLabel} (opcional)
            </label>
            <input
              id="odometro"
              inputMode="numeric"
              value={fields.odometro}
              onChange={(e) => updateField("odometro", e.target.value)}
              placeholder={config.unidadOdometro === "horas" ? "0" : "15000"}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="font-semibold text-zinc-100">Propietario</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Para recordatorios, WhatsApp y portal del cliente
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nombreCliente" className="block text-sm font-medium text-zinc-300">
              Nombre completo *
            </label>
            <input
              id="nombreCliente"
              required
              value={fields.nombreCliente}
              onChange={(e) => updateField("nombreCliente", e.target.value)}
              placeholder="Ej. María López"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="cedulaPropietario" className="block text-sm font-medium text-zinc-300">
              Cédula
            </label>
            <input
              id="cedulaPropietario"
              inputMode="numeric"
              value={fields.cedulaPropietario}
              onChange={(e) => updateField("cedulaPropietario", e.target.value.replace(/\D/g, ""))}
              placeholder="1234567890"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="emailPropietario" className="block text-sm font-medium text-zinc-300">
              Correo electrónico
            </label>
            <input
              id="emailPropietario"
              type="email"
              value={fields.emailPropietario}
              onChange={(e) => updateField("emailPropietario", e.target.value)}
              placeholder="propietario@correo.com"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="fechaNacimientoPropietario"
              className="block text-sm font-medium text-zinc-300"
            >
              Fecha de nacimiento
            </label>
            <input
              id="fechaNacimientoPropietario"
              type="date"
              value={fields.fechaNacimientoPropietario}
              onChange={(e) => updateField("fechaNacimientoPropietario", e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="telefonoCliente" className="block text-sm font-medium text-zinc-300">
              Teléfono (WhatsApp) *
            </label>
            <input
              id="telefonoCliente"
              required
              value={fields.telefonoCliente}
              onChange={(e) => updateField("telefonoCliente", e.target.value)}
              placeholder="3001234567"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <OrdenRecepcionForm
        value={ordenRecepcion}
        onChange={setOrdenRecepcion}
        odometroLabel={config.unidadOdometro === "horas" ? "Horas de motor" : "Kilometraje"}
      />

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Registrar vehículo
        </button>
      </div>
    </form>
  );
}
