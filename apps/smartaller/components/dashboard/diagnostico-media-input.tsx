"use client";

import { useRef, useState } from "react";
import { Camera, Film, X } from "lucide-react";
import { cn } from "@/lib/utils";

type DiagnosticoMediaInputProps = {
  className?: string;
  disabled?: boolean;
};

export function DiagnosticoMediaInput({ className, disabled }: DiagnosticoMediaInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ url: string; name: string; type: string }[]>([]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    for (const preview of previews) {
      URL.revokeObjectURL(preview.url);
    }
    setPreviews(
      selected.map((file) => ({
        url: URL.createObjectURL(file),
        name: file.name,
        type: file.type,
      }))
    );
  }

  function clearSelection() {
    for (const preview of previews) {
      URL.revokeObjectURL(preview.url);
    }
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <label className="mb-1.5 block text-sm text-zinc-400">
          Fotos y videos del diagnóstico (opcional)
        </label>
        <p className="mb-2 text-xs text-zinc-500">
          JPG, PNG, WEBP, MP4 o MOV · hasta 8 archivos · el cliente los verá en su app
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-zinc-600 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-blue-500 hover:text-blue-300 disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          Seleccionar archivos
        </button>
        <input
          ref={inputRef}
          type="file"
          name="media"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
          multiple
          disabled={disabled}
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((preview) => (
            <div
              key={preview.url}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
            >
              {preview.type.startsWith("video/") ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-zinc-400">
                  <Film className="h-5 w-5" />
                  <span className="max-w-full truncate px-1 text-[9px]">{preview.name}</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.name} className="h-full w-full object-cover" />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={clearSelection}
            className="flex h-20 w-20 items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300"
            aria-label="Quitar selección"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
