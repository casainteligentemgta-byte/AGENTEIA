"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type HTMLAttributes } from "react";
import { createNfcStickerAction } from "@/app/actions/nfc/nfc-management";

export function NuevoStickerForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const pinRaw = String(formData.get("pin") ?? "").trim();
      const result = await createNfcStickerAction({
        etiqueta: String(formData.get("etiqueta") ?? "").trim() || null,
        placa: String(formData.get("placa") ?? "").trim() || null,
        marca: String(formData.get("marca") ?? "").trim() || null,
        modelo: String(formData.get("modelo") ?? "").trim() || null,
        color: String(formData.get("color") ?? "").trim() || null,
        nombreTitular: String(formData.get("nombreTitular") ?? "").trim() || null,
        pin: pinRaw || null,
        notas: String(formData.get("notas") ?? "").trim() || null,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(`/puerto-libre?created=${result.token}`);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Etiqueta" name="etiqueta" placeholder="Sticker FL-001" />
        <Field label="Placa" name="placa" placeholder="AA90N9O" className="uppercase" />
        <Field label="Marca" name="marca" placeholder="Toyota" />
        <Field label="Modelo" name="modelo" placeholder="Corolla" />
        <Field label="Color" name="color" placeholder="Blanco" />
        <Field label="Titular" name="nombreTitular" placeholder="Nombre del propietario" />
        <Field
          label="PIN (opcional)"
          name="pin"
          type="password"
          inputMode="numeric"
          placeholder="4–8 dígitos"
          autoComplete="new-password"
        />
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Notas internas</span>
        <textarea
          name="notas"
          rows={3}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
          placeholder="Solo visibles en el panel del taller"
        />
      </label>

      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear sticker NFC"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  className = "",
  inputMode,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  className?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-zinc-400">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className={`w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 ${className}`}
      />
    </label>
  );
}
