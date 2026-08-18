"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createPuertoLibreVehiculoAction,
  uploadPuertoLibreDocumentoAction,
} from "@/app/actions/nfc/importacion-vehiculo";
import {
  PuertoLibreFase1Form,
  type PuertoLibreFase1FormValues,
  type PuertoLibreScanFiles,
} from "@/components/nfc/PuertoLibreFase1Form";
import type { UltimoImportador } from "@/lib/taller-preferencias";

type Props = {
  /** Cliente importador seleccionado (obligatorio en alta). */
  importadorId?: string;
  /** Importador guardado del taller (último registro) o snapshot del cliente. */
  initialImportador?: UltimoImportador | null;
  /** Si true, no se editan datos del importador (vienen del paso cliente). */
  lockImportador?: boolean;
};

async function attachScanFiles(vehiculoId: string, scanFiles: PuertoLibreScanFiles) {
  async function uploadOne(tipo: "factura_comercial" | "certificado_origen", file: File) {
    const fd = new FormData();
    fd.set("vehiculoId", vehiculoId);
    fd.set("tipo", tipo);
    fd.set("file", file);
    const uploaded = await uploadPuertoLibreDocumentoAction(fd);
    if (!uploaded.success) return uploaded.error;
    return null;
  }

  if (scanFiles.factura_comercial) {
    const error = await uploadOne("factura_comercial", scanFiles.factura_comercial);
    if (error) return error;
  }

  const certs = scanFiles.certificadosOrigen?.length
    ? scanFiles.certificadosOrigen
    : scanFiles.certificado_origen
      ? [scanFiles.certificado_origen]
      : [];
  if (certs.length > 0) {
    const error = await uploadOne("certificado_origen", certs[certs.length - 1]!);
    if (error) return error;
  }
  return null;
}

function valuesToAltaPayload(
  values: PuertoLibreFase1FormValues,
  importadorId?: string
) {
  return {
    marca: values.marca,
    modelo: values.modelo,
    color: values.color,
    anio: values.anio ? Number(values.anio) : undefined,
    serialMotor: values.serialMotor,
    vin: values.vin,
    serialCarroceria: values.serialCarroceria,
    kilometraje: values.kilometraje ? Number(values.kilometraje) : undefined,
    condicion: values.condicion,
    esSubasta:
      values.condicion === "usado"
        ? values.esSubasta === "true"
          ? true
          : values.esSubasta === "false"
            ? false
            : null
        : false,
    partidaArancelaria: values.partidaArancelaria,
    cilindradaCc: values.cilindradaCc,
    tipoCombustible: values.tipoCombustible || null,
    fechaLlegadaBuque: values.fechaLlegadaBuque,
    regimen: values.regimen || "puerto_libre",
    importadorId,
    importadorNombre: values.importadorNombre,
    importadorDocumento: values.importadorDocumento,
    importadorTelefono: values.importadorTelefono,
    importadorEmail: values.importadorEmail,
    importadorDireccion: values.importadorDireccion,
    aduana: values.aduana,
    puerto: values.puerto,
    modalidadTransito: values.modalidadTransito || null,
    aduanaTransito: values.aduanaTransito,
    numeroBl: values.numeroBl,
    paisOrigen: values.paisOrigen,
    valorCif: values.valorCif,
    tasaCambioBcv: values.tasaCambioBcv,
    numeroExpedienteSeniat: values.numeroExpedienteSeniat,
    numeroDav: values.numeroDav,
    numeroCertificadoOrigen: values.numeroCertificadoOrigen,
    numeroListaEmpaque: values.numeroListaEmpaque,
    numeroPolizaTransporte: values.numeroPolizaTransporte,
    observaciones: values.observaciones,
  };
}

/** Alta de importación: datos del vehículo (cliente ya seleccionado). */
export function PlanillaAltaPuertoLibre({
  importadorId,
  initialImportador,
  lockImportador = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(
    values: PuertoLibreFase1FormValues,
    _formData: FormData,
    scanFiles: PuertoLibreScanFiles
  ) {
    setError(null);
    if (!importadorId) {
      setError("Selecciona o crea el cliente importador antes de continuar");
      return;
    }
    startTransition(async () => {
      const result = await createPuertoLibreVehiculoAction(
        valuesToAltaPayload(values, importadorId)
      );
      if (!result.success) {
        setError(result.error);
        return;
      }

      const attachError = await attachScanFiles(result.vehiculoId, scanFiles);
      if (attachError) {
        setError(
          `Importación registrada, pero no se pudo guardar un documento: ${attachError}`
        );
        router.push(`/smartimport/${result.vehiculoId}/planilla?fase=1`);
        router.refresh();
        return;
      }

      router.push(`/smartimport/${result.vehiculoId}/planilla?fase=1`);
      router.refresh();
    });
  }

  return (
    <PuertoLibreFase1Form
      variant="alta"
      lockImportador={lockImportador}
      initial={{
        importadorNombre: initialImportador?.importadorNombre ?? "",
        importadorDocumento: initialImportador?.importadorDocumento ?? "",
        importadorTelefono: initialImportador?.importadorTelefono ?? "",
        importadorEmail: initialImportador?.importadorEmail ?? "",
        importadorDireccion: initialImportador?.importadorDireccion ?? "",
      }}
      onSubmit={handleSubmit}
      actions={
        <>
          {error ? (
            <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending || !importadorId}
            className="w-full rounded-xl bg-cyan-600 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Registrando…" : "Registrar importación"}
          </button>
        </>
      }
    />
  );
}
