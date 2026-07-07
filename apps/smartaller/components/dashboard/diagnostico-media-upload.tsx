"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { uploadDiagnosticoMediaAction } from "@/app/actions/diagnostico-media";
import { DiagnosticoMediaInput } from "@/components/dashboard/diagnostico-media-input";

type DiagnosticoMediaUploadProps = {
  mantenimientoId: string;
  compact?: boolean;
};

export function DiagnosticoMediaUpload({
  mantenimientoId,
  compact = false,
}: DiagnosticoMediaUploadProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await uploadDiagnosticoMediaAction(mantenimientoId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage(
        result.added === 1
          ? "1 archivo subido correctamente"
          : `${result.added} archivos subidos correctamente`
      );
      formRef.current?.reset();
      setResetKey((k) => k + 1);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={compact ? "mt-3" : "space-y-3"}>
      <DiagnosticoMediaInput key={resetKey} disabled={pending} />
      {error && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        Subir diagnóstico visual
      </button>
    </form>
  );
}
