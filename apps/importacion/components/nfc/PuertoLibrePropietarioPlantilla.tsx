"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Shield, User } from "lucide-react";
import {
  updatePuertoLibrePropietarioAction,
  updatePuertoLibreSeguroAction,
} from "@/app/actions/nfc/importacion-vehiculo";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";
import { PropietarioCedulaScan } from "@/components/nfc/PropietarioCedulaScan";
import {
  SEGURO_DOCUMENTO_TIPOS,
  type SeguroData,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

type Props = {
  vehiculoId: string;
  compradorNombre: string | null;
  compradorTelefono: string | null;
  compradorCedula: string | null;
  compradorEmail: string | null;
  compradorFechaNacimiento: string | null;
  compradorDireccion: string | null;
  initialSeguro: SeguroData;
  initialDocumentos: VehiculosDocumentos;
};

/** Plantilla comprador + seguro (edición fuera de la planilla; fases 4 y 5). */
export function PuertoLibrePropietarioPlantilla({
  vehiculoId,
  compradorNombre,
  compradorTelefono,
  compradorCedula,
  compradorEmail,
  compradorFechaNacimiento,
  compradorDireccion,
  initialSeguro,
  initialDocumentos,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [docs, setDocs] = useState(initialDocumentos);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombreCliente, setNombreCliente] = useState(compradorNombre ?? "");
  const [cedulaPropietario, setCedulaPropietario] = useState(
    compradorCedula ?? ""
  );
  const [telefonoCliente, setTelefonoCliente] = useState(
    compradorTelefono ?? ""
  );
  const [direccion, setDireccion] = useState(compradorDireccion ?? "");
  const [emailPropietario, setEmailPropietario] = useState(
    compradorEmail ?? ""
  );
  const [fechaNacimientoPropietario, setFechaNacimientoPropietario] =
    useState(compradorFechaNacimiento ?? "");

  function applyScanned(fields: {
    nombreCliente?: string;
    cedulaPropietario?: string;
    fechaNacimientoPropietario?: string;
  }) {
    if (fields.nombreCliente) setNombreCliente(fields.nombreCliente);
    if (fields.cedulaPropietario) setCedulaPropietario(fields.cedulaPropietario);
    if (fields.fechaNacimientoPropietario) {
      setFechaNacimientoPropietario(fields.fechaNacimientoPropietario);
    }
  }

  return (
    <div className="space-y-6">
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

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <User className="h-5 w-5 text-cyan-400" />
          Datos del comprador / propietario
        </h2>

        <div className="mt-4">
          <PropietarioCedulaScan
            vehiculoId={vehiculoId}
            existingUrl={docs.cedula?.url}
            onExtracted={applyScanned}
            onDocumentUploaded={(next) => {
              setDocs(next);
              setMessage("Cédula leída y guardada");
              setError(null);
              router.refresh();
            }}
          />
        </div>

        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await updatePuertoLibrePropietarioAction({
                vehiculoId,
                nombreCliente: String(fd.get("nombreCliente") ?? ""),
                telefonoCliente: String(fd.get("telefonoCliente") ?? ""),
                cedulaPropietario: String(fd.get("cedulaPropietario") ?? ""),
                emailPropietario: String(fd.get("emailPropietario") ?? ""),
                direccion: String(fd.get("direccion") ?? ""),
                fechaNacimientoPropietario:
                  String(fd.get("fechaNacimientoPropietario") ?? "") || null,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Datos del propietario guardados");
              router.refresh();
            });
          }}
        >
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Nombre *</span>
            <input
              name="nombreCliente"
              required
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Cédula</span>
            <input
              name="cedulaPropietario"
              value={cedulaPropietario}
              onChange={(e) => setCedulaPropietario(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <PlanillaFechaField
            label="Fecha de nacimiento"
            name="fechaNacimientoPropietario"
            value={fechaNacimientoPropietario}
            onChange={setFechaNacimientoPropietario}
            className="sm:col-span-1"
          />
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">WhatsApp</span>
            <input
              name="telefonoCliente"
              value={telefonoCliente}
              onChange={(e) => setTelefonoCliente(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Dirección</span>
            <input
              name="direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Email</span>
            <input
              name="emailPropietario"
              type="email"
              value={emailPropietario}
              onChange={(e) => setEmailPropietario(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar propietario"}
            </button>
          </div>
        </form>

        <div className="mt-6 grid gap-3">
          <ImportDocumentoUpload
            vehiculoId={vehiculoId}
            tipo="foto_comprador"
            existingUrl={docs.foto_comprador?.url}
            hint=""
            actionLabel="Tomar / subir foto propietario"
            onUploaded={(next) => {
              setDocs(next);
              setMessage("Foto del propietario guardada");
              setError(null);
              router.refresh();
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Shield className="h-5 w-5 text-cyan-400" />
          Seguro
        </h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            setError(null);
            setMessage(null);
            const montoRaw = String(fd.get("montoAsegurado") ?? "").trim();
            startTransition(async () => {
              const result = await updatePuertoLibreSeguroAction({
                vehiculoId,
                aseguradora: String(fd.get("aseguradora") ?? "") || null,
                numeroPoliza: String(fd.get("numeroPoliza") ?? "") || null,
                tipoCobertura: String(fd.get("tipoCobertura") ?? "") || null,
                vigenciaDesde: String(fd.get("vigenciaDesde") ?? "") || null,
                vigenciaHasta: String(fd.get("vigenciaHasta") ?? "") || null,
                montoAsegurado: montoRaw ? Number(montoRaw) : null,
                telefonoAseguradora: String(fd.get("telefonoAseguradora") ?? "") || null,
                corredor: String(fd.get("corredor") ?? "") || null,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Seguro guardado");
              router.refresh();
            });
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Aseguradora</span>
            <input
              name="aseguradora"
              defaultValue={initialSeguro.aseguradora ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Nro de póliza</span>
            <input
              name="numeroPoliza"
              defaultValue={initialSeguro.numeroPoliza ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Tipo de cobertura</span>
            <input
              name="tipoCobertura"
              defaultValue={initialSeguro.tipoCobertura ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Teléfono aseguradora</span>
            <input
              name="telefonoAseguradora"
              defaultValue={initialSeguro.telefonoAseguradora ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Vigencia desde</span>
            <input
              name="vigenciaDesde"
              type="date"
              defaultValue={initialSeguro.vigenciaDesde ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Vigencia hasta</span>
            <input
              name="vigenciaHasta"
              type="date"
              defaultValue={initialSeguro.vigenciaHasta ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Monto asegurado</span>
            <input
              name="montoAsegurado"
              type="number"
              defaultValue={
                initialSeguro.montoAsegurado != null
                  ? String(initialSeguro.montoAsegurado)
                  : ""
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Corredor / agente</span>
            <input
              name="corredor"
              defaultValue={initialSeguro.corredor ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar seguro"}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-300">Documentos del seguro</h3>
          <div className="mt-3 grid gap-3">
            {SEGURO_DOCUMENTO_TIPOS.map((tipo) => (
              <ImportDocumentoUpload
                key={tipo}
                vehiculoId={vehiculoId}
                tipo={tipo}
                existingUrl={docs[tipo]?.url}
                hint=""
                onUploaded={(next) => {
                  setDocs(next);
                  setMessage("Documento de seguro guardado");
                  setError(null);
                  router.refresh();
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
