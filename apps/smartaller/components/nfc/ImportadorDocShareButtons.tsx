"use client";

import { useState } from "react";
import { Eye, Share2, FileWarning } from "lucide-react";
import type { ImportadorDocumentoRef } from "@/lib/importadores/upload-documento";

async function shareUrlFallback(
  title: string,
  url: string
): Promise<"shared" | "aborted" | "unavailable"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text: title, url });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "aborted";
      }
    }
  }
  return "unavailable";
}

async function shareRemoteFile(params: {
  url: string;
  fileName: string;
  title: string;
}): Promise<"shared" | "downloaded" | "aborted" | "opened"> {
  let blob: Blob | null = null;
  try {
    const res = await fetch(params.url);
    if (res.ok) blob = await res.blob();
  } catch {
    blob = null;
  }

  if (blob) {
    const type = blob.type || "application/octet-stream";
    const file = new File([blob], params.fileName, { type });

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          files: [file],
          title: params.title,
          text: params.title,
        });
        return "shared";
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return "aborted";
        }
      }
    }
  }

  const urlShare = await shareUrlFallback(params.title, params.url);
  if (urlShare !== "unavailable") return urlShare;

  if (blob) {
    const a = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = params.fileName;
    a.click();
    URL.revokeObjectURL(objectUrl);
    return "downloaded";
  }

  window.open(params.url, "_blank", "noopener,noreferrer");
  return "opened";
}

type Props = {
  label: string;
  doc: ImportadorDocumentoRef | undefined;
  shareTitle: string;
};

export function ImportadorDocShareButtons({ label, doc, shareTitle }: Props) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const url = doc?.url;
  const fileName = doc?.file_name || `${label.toLowerCase()}.pdf`;

  async function share() {
    if (!url || pending) return;
    setStatus(null);
    setPending(true);
    try {
      const result = await shareRemoteFile({
        url,
        fileName,
        title: shareTitle,
      });
      if (result === "downloaded") {
        setStatus("Este dispositivo no permite compartir; se descargó el archivo.");
      } else if (result === "opened") {
        setStatus("Abre el archivo y compártelo desde ahí.");
      }
    } catch {
      setStatus("No se pudo compartir el archivo.");
    } finally {
      setPending(false);
    }
  }

  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-3 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <FileWarning className="h-4 w-4 text-amber-400" />
          {label}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Aún no hay archivo. Cárgalo en Editar.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3">
      <p className="text-sm font-medium text-zinc-100">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:border-cyan-500/60"
        >
          <Eye className="h-3.5 w-3.5" />
          Visualizar
        </a>
        <button
          type="button"
          onClick={share}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-400 disabled:opacity-60"
        >
          <Share2 className="h-3.5 w-3.5" />
          {pending ? "Compartiendo…" : "Compartir"}
        </button>
      </div>
      {status ? (
        <p className="mt-2 text-[11px] text-zinc-500">{status}</p>
      ) : null}
    </div>
  );
}
