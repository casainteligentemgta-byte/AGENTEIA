"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Camera,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ScanLine,
  Gauge,
  Pencil,
} from "lucide-react";
import { procesarFotoPasoInspeccionAction } from "@/app/actions/estado-visual-recepcion";
import { FotoAnotacionCanvas } from "@/components/dashboard/foto-anotacion-canvas";
import {
  HINT_ANOTACIONES_FOTO,
  INSPECCION_FOTO_PASOS,
  pasoPermiteAnotaciones,
  TOTAL_PASOS,
  type InspeccionFotoPasoId,
} from "@/lib/inspeccion/pasos";
import {
  emptyEstadoVisualSlots,
  type EstadoVisualRecepcion,
  type FotoEstadoVisual,
} from "@/lib/schemas/estado-visual-recepcion";
import type { FichaVehiculoInspeccion } from "@/lib/ordenes-recepcion/ficha-vehiculo";
import { FichaVehiculoInspeccionResumen } from "@/components/dashboard/ficha-vehiculo-inspeccion-resumen";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";

type Props = {
  estadoVisual: EstadoVisualRecepcion;
  onEstadoVisualChange: (value: EstadoVisualRecepcion) => void;
  vehiculoId?: string;
  placaEsperada?: string;
  pasoIndex: number;
  onPasoIndexChange: (index: number) => void;
  onVehiculoResuelto?: (data: {
    vehiculoId: string;
    placa: string;
    ficha: FichaVehiculoInspeccion;
    odometroLabel: string;
  }) => void;
  onKilometrajeDetectado?: (km: number) => void;
  fichaVehiculo?: FichaVehiculoInspeccion;
  disabled?: boolean;
};

function slotForVista(fotos: FotoEstadoVisual[], vista: InspeccionFotoPasoId): FotoEstadoVisual {
  return fotos.find((f) => f.vista === vista) ?? { vista, trazos: [] };
}

export function InspeccionWizardFotos({
  estadoVisual,
  onEstadoVisualChange,
  vehiculoId,
  placaEsperada,
  pasoIndex,
  onPasoIndexChange,
  onVehiculoResuelto,
  onKilometrajeDetectado,
  fichaVehiculo,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autoCameraTriggered = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fotos = estadoVisual.fotos.length > 0 ? estadoVisual.fotos : emptyEstadoVisualSlots();
  const paso = INSPECCION_FOTO_PASOS[pasoIndex];
  const slot = paso ? slotForVista(fotos, paso.id) : null;
  const hasPhoto = Boolean(slot?.url);

  function updateSlot(vista: InspeccionFotoPasoId, patch: Partial<FotoEstadoVisual>) {
    const next = fotos.map((f) => (f.vista === vista ? { ...f, ...patch } : f));
    onEstadoVisualChange({ fotos: next });
  }

  function avanzarPaso() {
    if (pasoIndex < INSPECCION_FOTO_PASOS.length - 1) {
      autoCameraTriggered.current = false;
      onPasoIndexChange(pasoIndex + 1);
    } else {
      onPasoIndexChange(INSPECCION_FOTO_PASOS.length);
    }
  }

  function handleFile(file: File) {
    if (!paso) return;
    setError(null);
    setStatusMsg(
      paso.escanearPlaca
        ? "Leyendo placa y guardando foto frontal…"
        : paso.extraerKilometraje
          ? "Leyendo tablero y guardando foto…"
          : "Guardando foto…"
    );

    startTransition(async () => {
      const normalized = await normalizeImageFileForUpload(file);
      const formData = new FormData();
      formData.append("vista", paso.id);
      formData.append("file", normalized);
      if (vehiculoId) formData.append("vehiculoId", vehiculoId);
      if (placaEsperada) formData.append("placaEsperada", placaEsperada);

      const result = await procesarFotoPasoInspeccionAction(formData);
      setStatusMsg(null);

      if (!result.ok) {
        const detalle =
          "placaDetectada" in result && result.placaDetectada
            ? ` (leída: ${result.placaDetectada})`
            : "";
        setError(`${result.error}${detalle}`);
        return;
      }

      updateSlot(paso.id, {
        url: result.foto.url,
        path: result.foto.path,
        trazos: [],
      });

      if (paso.escanearPlaca && result.vehiculoId && result.ficha && result.placaVehiculo) {
        onVehiculoResuelto?.({
          vehiculoId: result.vehiculoId,
          placa: result.placaVehiculo,
          ficha: result.ficha,
          odometroLabel: result.odometroLabel ?? "Kilometraje",
        });
        setStatusMsg(
          result.avisoPlaca
            ? `✓ Vehículo: ${result.placaVehiculo}. ${result.avisoPlaca}`
            : `✓ Vehículo confirmado: ${result.placaVehiculo}`
        );
      }

      if (
        paso.extraerKilometraje &&
        result.kilometrajeDetectado != null &&
        result.kilometrajeDetectado > 0
      ) {
        onKilometrajeDetectado?.(result.kilometrajeDetectado);
        setStatusMsg(`✓ Kilometraje detectado: ${result.kilometrajeDetectado.toLocaleString("es-CO")}`);
      }

      if (paso.extraerKilometraje && result.avisoTablero) {
        setStatusMsg(`✓ Foto del tablero guardada. ${result.avisoTablero}`);
      }

      if (!pasoPermiteAnotaciones(paso)) {
        window.setTimeout(avanzarPaso, 800);
      }
    });
  }

  useEffect(() => {
    if (!paso || hasPhoto || isPending) return;
    if (autoCameraTriggered.current) return;
    autoCameraTriggered.current = true;
    const t = window.setTimeout(() => inputRef.current?.click(), 500);
    return () => window.clearTimeout(t);
  }, [pasoIndex, paso, hasPhoto, isPending]);

  if (!paso) return null;

  const permiteAnotaciones = pasoPermiteAnotaciones(paso);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        {INSPECCION_FOTO_PASOS.map((p, i) => (
          <div
            key={p.id}
            className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${
              i < pasoIndex
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                : i === pasoIndex
                  ? "border-blue-500 bg-blue-500/20 text-blue-300"
                  : "border-zinc-700 text-zinc-600"
            }`}
          >
            {i < pasoIndex ? "✓" : i + 1}
          </div>
        ))}
        <span className="ml-1">
          Paso {pasoIndex + 1} de {TOTAL_PASOS - 1}
        </span>
      </div>

      {fichaVehiculo && pasoIndex >= 1 && <FichaVehiculoInspeccionResumen ficha={fichaVehiculo} />}

      <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">{paso.titulo}</h3>
            <p className="mt-1 text-sm text-zinc-400">{paso.instruccion}</p>
            {permiteAnotaciones && hasPhoto && (
              <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-amber-200/90">
                <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {HINT_ANOTACIONES_FOTO}
              </p>
            )}
          </div>
          {paso.escanearPlaca && (
            <ScanLine className="h-6 w-6 shrink-0 text-blue-400" aria-hidden />
          )}
          {paso.extraerKilometraje && (
            <Gauge className="h-6 w-6 shrink-0 text-amber-400" aria-hidden />
          )}
        </div>

        {!hasPhoto ? (
          <button
            type="button"
            disabled={disabled || isPending}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-blue-500/50 py-16 text-blue-300 transition hover:border-blue-400 hover:bg-blue-500/10 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-12 w-12 animate-spin" />
            ) : (
              <Camera className="h-12 w-12" />
            )}
            <span className="text-sm font-medium">
              {isPending ? statusMsg ?? "Procesando…" : "Tomar foto"}
            </span>
          </button>
        ) : permiteAnotaciones ? (
          <FotoAnotacionCanvas
            vista={paso.id}
            imageUrl={slot!.url!}
            trazos={slot!.trazos}
            onTrazosChange={(trazos) => updateSlot(paso.id, { trazos })}
            disabled={disabled || isPending}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slot!.url} alt={paso.titulo} className="w-full" />
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled || isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {hasPhoto && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Foto guardada
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={disabled || isPending}
                onClick={() => inputRef.current?.click()}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Reemplazar
              </button>
              <button
                type="button"
                disabled={disabled || isPending}
                onClick={avanzarPaso}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {statusMsg && !error && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {statusMsg}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
