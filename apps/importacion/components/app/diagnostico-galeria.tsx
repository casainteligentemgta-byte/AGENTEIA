"use client";

import { useState } from "react";
import { Film, ImageIcon, X, ZoomIn } from "lucide-react";
import type { DiagnosticoMediaItem } from "@/lib/schemas/diagnostico-media";
import { cn } from "@/lib/utils";

type DiagnosticoGaleriaProps = {
  media: DiagnosticoMediaItem[];
  titulo?: string;
  className?: string;
  compact?: boolean;
  variant?: "light" | "dark";
};

export function DiagnosticoGaleria({
  media,
  titulo = "Diagnóstico visual",
  className,
  compact = false,
  variant = "light",
}: DiagnosticoGaleriaProps) {
  const [active, setActive] = useState<DiagnosticoMediaItem | null>(null);

  if (media.length === 0) return null;

  const isDark = variant === "dark";

  return (
    <>
      <div className={cn("space-y-2", className)}>
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            isDark ? "text-zinc-500" : "text-zinc-500"
          )}
        >
          {titulo}
        </p>
        <div
          className={cn(
            "grid gap-2",
            compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"
          )}
        >
          {media.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => setActive(item)}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border",
                isDark
                  ? "border-zinc-700 bg-zinc-900"
                  : "border-zinc-200 bg-zinc-100"
              )}
            >
              {item.type === "video" ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-zinc-900 text-white">
                  <Film className="h-6 w-6" />
                  <span className="text-[10px] font-medium">Video</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.caption ?? "Diagnóstico"}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              )}
              <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100">
                <ZoomIn className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setActive(null)}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="max-h-[85vh] max-w-4xl overflow-hidden rounded-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            {active.type === "video" ? (
              <video
                src={active.url}
                controls
                autoPlay
                className="max-h-[85vh] w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.url}
                alt={active.caption ?? "Diagnóstico ampliado"}
                className="max-h-[85vh] w-full object-contain"
              />
            )}
            {active.caption && (
              <p className="border-t border-white/10 px-4 py-3 text-sm text-zinc-200">
                {active.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function DiagnosticoMediaBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
      <ImageIcon className="h-3 w-3" />
      {count} foto{count !== 1 ? "s" : ""}
    </span>
  );
}
