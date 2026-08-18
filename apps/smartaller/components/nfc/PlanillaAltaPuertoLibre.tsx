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
import type { MultiDocDetectedPayload } from "@/components/nfc/PuertoLibreDocScan";
import type { UltimoImportador } from "@/lib/taller-preferencias";

type Props = {
  /** Cliente importador seleccionado (obligatorio en alta). */
  importadorId?: string;
  /** Importador guardado del taller (último registro) o snapshot del cliente. */
  initialImportador?: UltimoImportador | null;
  /** Si true, no se editan datos del importador (vienen del paso cliente). */
  lockImportador?: boolean;
  onMultiDetected?: (payload: MultiDocDetectedPayload) => void;
};

async function attachScanFiles(vehiculoId: string, scanFiles: PuertoLibreScanFiles) {
  const tipos = Object.keys(scanFiles) as (keyof PuertoLibreScanFiles)[];
  for (const tipo of tipos) {
    const file = scanFiles[tipo];
    if (!file) continue;
    const fd = new FormData();
    fd.set("vehiculoId", vehiculoId);
    fd.set("tipo", tipo);
    fd.set("file", file);
    const uploaded = await uploadPuertoLibreDocumentoAction(fd);
    if (!uploaded.success) {
      return uploaded.error;
    }
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
    partidaArancelariaFuente: values.partidaArancelariaFuente || undefined,
    partidaArancelariaFundamento: values.partidaArancelariaFundamento,
    tarifaAdValoremPct: values.tarifaAdValoremPct,
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
    costosArancelariosUsd: values.costosArancelariosUsd,
    gastosPuertoUsd: values.gastosPuertoUsd,
    fleteInternacionalUsd: values.fleteInternacionalUsd,
    costoTotalLandedUsd: values.costoTotalLandedUsd,
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
  onMultiDetected,
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
      onMultiDetected={onMultiDetected}
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
