"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { verifyNfcPin } from "@/app/actions/nfc/verify-nfc";
import type { NfcStickerPublic } from "@/lib/nfc/types";

type Props = {
  token: string;
  initial: NfcStickerPublic;
};

export function PublicStickerView({ token, initial }: Props) {
  const [sticker, setSticker] = useState(initial);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showSensitive = !sticker.requierePin || sticker.verificado;

  function onVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyNfcPin({ token, pin });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSticker(result.sticker);
      setPin("");
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <header className="mb-8 text-center">
        <p className="text-sm font-medium tracking-[0.2em] text-cyan-400/90 uppercase">
          Puerto Libre
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          SmartTaller
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Verificación del sticker NFC
          {sticker.tallerNombre ? ` · ${sticker.tallerNombre}` : ""}
        </p>
      </header>

      <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/50 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-sm sm:p-8">
        <div className="space-y-4">
          <Row label="Estado" value={sticker.activo ? "Activo" : "Inactivo"} />
          {sticker.etiqueta ? <Row label="Etiqueta" value={sticker.etiqueta} /> : null}

          {showSensitive ? (
            <>
              {sticker.placa ? (
                <Row label="Placa" value={sticker.placa} mono highlight />
              ) : (
                <Row label="Placa" value="Sin placa registrada" muted />
              )}
              <Row
                label="Vehículo"
                value={
                  [sticker.marca, sticker.modelo].filter(Boolean).join(" ") || "No indicado"
                }
              />
              {sticker.color ? <Row label="Color" value={sticker.color} /> : null}
              {sticker.nombre_titular ? (
                <Row label="Titular" value={sticker.nombre_titular} />
              ) : null}
              {sticker.verificado ? (
                <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  PIN verificado
                </p>
              ) : null}
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Este sticker está protegido. Introduce el PIN para ver los datos del vehículo.
              </p>
              <form onSubmit={onVerify} className="space-y-3">
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN de 4–8 dígitos"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center font-mono text-lg tracking-[0.35em] text-zinc-100 outline-none focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20"
                  maxLength={8}
                  required
                />
                {error ? <p className="text-sm text-red-300">{error}</p> : null}
                <button
                  type="submit"
                  disabled={pending || pin.length < 4}
                  className="w-full rounded-xl bg-cyan-600 py-3 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
                >
                  {pending ? "Verificando…" : "Verificar PIN"}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-800/80 py-2 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span
        className={`text-right text-sm ${
          highlight
            ? "font-mono text-base tracking-wide text-cyan-300"
            : muted
              ? "text-zinc-500"
              : mono
                ? "font-mono text-zinc-200"
                : "text-zinc-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
