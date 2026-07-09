"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, CheckCircle2 } from "lucide-react";
import { uploadEstadoVisualFotoAction } from "@/app/actions/estado-visual-recepcion";
import { FotoAnotacionCanvas } from "@/components/dashboard/foto-anotacion-canvas";
import {
  ESTADO_VISUAL_VISTAS,
  ESTADO_VISUAL_VISTA_LABELS,
  emptyEstadoVisualSlots,
  type EstadoVisualRecepcion,
  type EstadoVisualVista,
  type FotoEstadoVisual,
} from "@/lib/schemas/estado-visual-recepcion";

type Props = {
  value: EstadoVisualRecepcion;
  onChange: (value: EstadoVisualRecepcion) => void;
  disabled?: boolean;
};

function slotForVista(fotos: FotoEstadoVisual[], vista: EstadoVisualVista): FotoEstadoVisual {
  return fotos.find((f) => f.vista === vista) ?? { vista, trazos: [] };
}

export function EstadoVisualFotos({ value, onChange, disabled }: Props) {
  const inputRefs = useRef<Partial<Record<EstadoVisualVista, HTMLInputElement>>>({});
  const [pendingVista, setPendingVista] = useState<EstadoVisualVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fotos = value.fotos.length > 0 ? value.fotos : emptyEstadoVisualSlots();

  function updateSlot(vista: EstadoVisualVista, patch: Partial<FotoEstadoVisual>) {
    const next = fotos.map((f) => (f.vista === vista ? { ...f, ...patch } : f));
    onChange({ fotos: next });
  }

  function handleFile(vista: EstadoVisualVista, file: File) {
    setError(null);
    setPendingVista(vista);
    const formData = new FormData();
    formData.append("vista", vista);
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadEstadoVisualFotoAction(formData);
      setPendingVista(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      updateSlot(vista, {
        url: result.foto.url,
        path: result.foto.path,
        trazos: [],
      });
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Toma 4 fotos del vehículo (frontal, trasero y laterales). Sobre cada foto puedes marcar
        daños con el lápiz de la tableta.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {ESTADO_VISUAL_VISTAS.map((vista) => {
          const slot = slotForVista(fotos, vista);
          const uploading = isPending && pendingVista === vista;
          const hasPhoto = Boolean(slot.url);

          return (
            <div
              key={vista}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-medium text-zinc-200">
                  {ESTADO_VISUAL_VISTA_LABELS[vista]}
                </h4>
                {hasPhoto && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
                )}
              </div>

              {!hasPhoto ? (
                <button
                  type="button"
                  disabled={disabled || uploading}
                  onClick={() => inputRefs.current[vista]?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 py-10 text-sm text-zinc-400 transition hover:border-blue-500 hover:text-blue-300 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <Camera className="h-8 w-8" />
                  )}
                  {uploading ? "Subiendo…" : "Tomar / subir foto"}
                </button>
              ) : (
                <FotoAnotacionCanvas
                  vista={vista}
                  imageUrl={slot.url!}
                  trazos={slot.trazos}
                  onTrazosChange={(trazos) => updateSlot(vista, { trazos })}
                  disabled={disabled || uploading}
                />
              )}

              {hasPhoto && (
                <button
                  type="button"
                  disabled={disabled || uploading}
                  onClick={() => inputRefs.current[vista]?.click()}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                >
                  Reemplazar foto
                </button>
              )}

              <input
                ref={(el) => {
                  if (el) inputRefs.current[vista] = el;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                className="hidden"
                disabled={disabled || uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(vista, file);
                  e.target.value = "";
                }}
              />
            </div>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
