"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";

const VISTAS_RESTANTES = ESTADO_VISUAL_VISTAS.filter((v) => v !== "frontal");

type Props = {
  value: EstadoVisualRecepcion;
  onChange: (value: EstadoVisualRecepcion) => void;
  vehiculoId?: string;
  /** Abre la cámara para la foto frontal al entrar (si aún no hay foto) */
  abrirCamaraFrontal?: boolean;
  disabled?: boolean;
};

function slotForVista(fotos: FotoEstadoVisual[], vista: EstadoVisualVista): FotoEstadoVisual {
  return fotos.find((f) => f.vista === vista) ?? { vista, trazos: [] };
}

export function EstadoVisualFotos({
  value,
  onChange,
  vehiculoId,
  abrirCamaraFrontal,
  disabled,
}: Props) {
  const inputRefs = useRef<Partial<Record<EstadoVisualVista, HTMLInputElement>>>({});
  const autoCameraTriggered = useRef(false);
  const [pendingVista, setPendingVista] = useState<EstadoVisualVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fotos = value.fotos.length > 0 ? value.fotos : emptyEstadoVisualSlots();
  const tieneFrontal = Boolean(slotForVista(fotos, "frontal").url);

  function updateSlot(vista: EstadoVisualVista, patch: Partial<FotoEstadoVisual>) {
    const next = fotos.map((f) => (f.vista === vista ? { ...f, ...patch } : f));
    onChange({ fotos: next });
  }

  function handleFile(vista: EstadoVisualVista, file: File) {
    setError(null);
    setPendingVista(vista);

    startTransition(async () => {
      const normalized = await normalizeImageFileForUpload(file);
      const formData = new FormData();
      formData.append("vista", vista);
      formData.append("file", normalized);
      if (vehiculoId) formData.append("vehiculoId", vehiculoId);

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

  function openCamera(vista: EstadoVisualVista) {
    inputRefs.current[vista]?.click();
  }

  useEffect(() => {
    if (!abrirCamaraFrontal || tieneFrontal || autoCameraTriggered.current) return;
    autoCameraTriggered.current = true;
    const t = window.setTimeout(() => openCamera("frontal"), 600);
    return () => window.clearTimeout(t);
  }, [abrirCamaraFrontal, tieneFrontal]);

  function renderVista(vista: EstadoVisualVista, destacada = false) {
    const slot = slotForVista(fotos, vista);
    const uploading = isPending && pendingVista === vista;
    const hasPhoto = Boolean(slot.url);

    return (
      <div
        key={vista}
        className={
          destacada
            ? "rounded-xl border-2 border-blue-500/40 bg-blue-500/5 p-4"
            : "rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
        }
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className={`font-medium text-zinc-200 ${destacada ? "text-base" : "text-sm"}`}>
            {ESTADO_VISUAL_VISTA_LABELS[vista]}
            {destacada && !hasPhoto && (
              <span className="ml-2 text-xs font-normal text-blue-400">— toma la foto aquí</span>
            )}
          </h4>
          {hasPhoto && <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />}
        </div>

        {!hasPhoto ? (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => openCamera(vista)}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition disabled:opacity-50 ${
              destacada
                ? "border-blue-500/60 py-14 text-blue-300 hover:border-blue-400 hover:bg-blue-500/10"
                : "border-zinc-600 py-10 text-zinc-400 hover:border-blue-500 hover:text-blue-300"
            }`}
          >
            {uploading ? (
              <Loader2 className={`animate-spin ${destacada ? "h-10 w-10" : "h-8 w-8"}`} />
            ) : (
              <Camera className={destacada ? "h-10 w-10" : "h-8 w-8"} />
            )}
            <span className="text-sm font-medium">
              {uploading ? "Guardando…" : destacada ? "Tomar foto frontal" : "Tomar foto"}
            </span>
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

        {hasPhoto && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => openCamera(vista)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            Reemplazar foto
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Usa la cámara de este dispositivo. La foto frontal se guarda al instante al tomarla; luego
        completa trasero y laterales. Marca daños con el lápiz sobre cada imagen.
      </p>

      {renderVista("frontal", true)}

      <div className="grid gap-4 sm:grid-cols-3">
        {VISTAS_RESTANTES.map((vista) => renderVista(vista))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
