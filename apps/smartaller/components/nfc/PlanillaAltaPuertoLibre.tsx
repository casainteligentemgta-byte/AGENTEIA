"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPuertoLibreVehiculoAction } from "@/app/actions/nfc/puerto-libre-vehiculo";
import {
  PuertoLibreFase1Form,
  type PuertoLibreFase1FormValues,
} from "@/components/nfc/PuertoLibreFase1Form";
import type { UltimoImportador } from "@/lib/taller-preferencias";

type Props = {
  /** Importador guardado del taller (último registro). */
  initialImportador?: UltimoImportador | null;
};

/** Fase 1: datos del vehículo + importador (con OCR de factura/BL). */
export function PlanillaAltaPuertoLibre({ initialImportador }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(values: PuertoLibreFase1FormValues) {
    setError(null);
    startTransition(async () => {
      const result = await createPuertoLibreVehiculoAction({
        marca: values.marca,
        modelo: values.modelo,
        color: values.color,
        anio: values.anio ? Number(values.anio) : undefined,
        serialMotor: values.serialMotor,
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
        fechaLlegadaBuque: values.fechaLlegadaBuque,
        importadorNombre: values.importadorNombre,
        importadorDocumento: values.importadorDocumento,
        importadorTelefono: values.importadorTelefono,
        importadorEmail: values.importadorEmail,
        aduana: values.aduana,
        numeroBl: values.numeroBl,
        paisOrigen: values.paisOrigen,
        valorCif: values.valorCif,
        observaciones: values.observaciones,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/puerto-libre/${result.vehiculoId}/planilla?fase=1a`);
      router.refresh();
    });
  }

  return (
    <PuertoLibreFase1Form
      variant="alta"
      initial={{
        importadorNombre: initialImportador?.importadorNombre ?? "",
        importadorDocumento: initialImportador?.importadorDocumento ?? "",
        importadorTelefono: initialImportador?.importadorTelefono ?? "",
        importadorEmail: initialImportador?.importadorEmail ?? "",
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
            disabled={pending}
            className="w-full rounded-xl bg-cyan-600 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Registrando…" : "Registrar vehículo"}
          </button>
        </>
      }
    />
  );
}
