"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Ship, Wrench } from "lucide-react";
import { VehiculoCreateForm } from "@/components/dashboard/vehiculo-create-form";
import { PlanillaAltaPuertoLibre } from "@/components/nfc/PlanillaAltaPuertoLibre";

export type RegistrationType = "importacion_puerto_libre" | "taller_postventa_garantia";

type Step = "SELECT_TYPE" | "FORM";

type Props = {
  tallerNombre: string;
};

export function PuertoLibreRegistroWizard({ tallerNombre }: Props) {
  const [step, setStep] = useState<Step>("SELECT_TYPE");
  const [regType, setRegType] = useState<RegistrationType>("importacion_puerto_libre");

  const isPuertoLibre = regType === "importacion_puerto_libre";

  if (step === "SELECT_TYPE") {
    return (
      <div className="space-y-6">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Tipo de registro
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Elige la condición de ingreso para usar la planilla correcta.
          </p>
          <p className="mt-1 text-xs text-zinc-600">{tallerNombre}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setRegType("importacion_puerto_libre");
              setStep("FORM");
            }}
            className="group flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 text-left transition hover:border-cyan-500/60 hover:bg-cyan-950/10"
          >
            <div className="w-fit rounded-xl bg-cyan-500/10 p-3 text-cyan-400 transition group-hover:bg-cyan-600 group-hover:text-white">
              <Ship className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-50">
                Recién importado / Puerto Libre
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                Planilla con vehículo, importador, comprador, fotos y documentos.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setRegType("taller_postventa_garantia");
              setStep("FORM");
            }}
            className="group flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 text-left transition hover:border-amber-500/50 hover:bg-amber-950/10"
          >
            <div className="w-fit rounded-xl bg-amber-500/10 p-3 text-amber-400 transition group-hover:bg-amber-600 group-hover:text-white">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-50">
                Revisión, garantía o reservación
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                Vehículos ya en servicio. Ingreso por fallas, garantía o mantenimiento — planilla
                de inspección de taller.
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => setStep("SELECT_TYPE")}
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-cyan-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cambiar tipo de registro
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            {isPuertoLibre ? "Planilla Puerto Libre" : "Registro servicio / garantía"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {isPuertoLibre
              ? "Completa vehículo, importador y comprador. Luego fotos y documentos."
              : "Tras el alta irás a la ficha para la inspección de ingreso al taller."}
          </p>
        </div>
        <Link
          href={isPuertoLibre ? "/puerto-libre/hoja-inspeccion" : "/dashboard/hoja-inspeccion"}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:border-cyan-500 hover:text-cyan-300"
        >
          <FileText className="h-4 w-4" />
          {isPuertoLibre ? "Planilla transportista (PDF)" : "Planilla taller (PDF)"}
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
        {isPuertoLibre ? (
          <PlanillaAltaPuertoLibre />
        ) : (
          <>
            <p className="mb-5 rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
              Este flujo usa la planilla de ingreso a taller (no la de recepción en transportista).
            </p>
            <VehiculoCreateForm
              redirectAfterCreate={(id) => `/dashboard/vehiculos/${id}?registrado=1`}
            />
          </>
        )}
      </div>
    </div>
  );
}
