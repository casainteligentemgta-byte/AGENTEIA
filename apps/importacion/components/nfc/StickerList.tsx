"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, Link2, Power, PowerOff } from "lucide-react";
import {
  activateNfcStickerAction,
  deactivateNfcStickerAction,
} from "@/app/actions/nfc/nfc-management";
import { NFCQRCode } from "@/components/nfc/NFCQRCode";
import type { NfcStickerListItem } from "@/lib/nfc/types";

type Props = {
  stickers: NfcStickerListItem[];
  highlightToken?: string | null;
  baseUrl: string;
};

export function StickerList({ stickers, highlightToken, baseUrl }: Props) {
  if (stickers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-12 text-center">
        <p className="text-zinc-300">Aún no hay stickers NFC</p>
        <p className="mt-1 text-sm text-zinc-500">
          Crea el primero para generar URL pública y QR de grabado.
        </p>
        <Link
          href="/importacion/nuevo"
          className="mt-5 inline-flex rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Nuevo sticker
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {stickers.map((sticker) => (
        <StickerCard
          key={sticker.id}
          sticker={sticker}
          highlight={highlightToken === sticker.token}
          baseUrl={baseUrl}
        />
      ))}
    </ul>
  );
}

function StickerCard({
  sticker,
  highlight,
  baseUrl,
}: {
  sticker: NfcStickerListItem;
  highlight: boolean;
  baseUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const publicUrl = `${baseUrl}/v/${sticker.token}`;

  function toggleActivo() {
    setError(null);
    startTransition(async () => {
      const result = sticker.activo
        ? await deactivateNfcStickerAction(sticker.id)
        : await activateNfcStickerAction(sticker.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      className={`rounded-2xl border bg-zinc-900/50 p-5 transition ${
        highlight
          ? "border-cyan-500/60 shadow-lg shadow-cyan-900/20"
          : "border-zinc-800"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-zinc-100">
              {sticker.etiqueta || sticker.placa || "Sticker NFC"}
            </h2>
            <span
              className={`rounded-md px-2 py-0.5 text-xs ${
                sticker.activo
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-zinc-700/60 text-zinc-400"
              }`}
            >
              {sticker.activo ? "Activo" : "Inactivo"}
            </span>
            {sticker.tienePin ? (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">
                PIN
              </span>
            ) : null}
          </div>
          <p className="text-sm text-zinc-400">
            {[sticker.marca, sticker.modelo, sticker.color].filter(Boolean).join(" · ") ||
              "Sin ficha de vehículo"}
          </p>
          {sticker.placa ? (
            <p className="font-mono text-sm tracking-wide text-cyan-300">{sticker.placa}</p>
          ) : null}
          <p className="flex items-center gap-1.5 truncate text-xs text-zinc-500">
            <Link2 className="h-3.5 w-3.5 shrink-0" />
            <a href={publicUrl} className="truncate hover:text-zinc-300" target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </p>
        </div>

        <NFCQRCode url={publicUrl} size={140} label="Escanear / grabar" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={`/api/nfc/download?id=${sticker.id}&format=txt`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-cyan-600 hover:text-cyan-300"
        >
          <Download className="h-3.5 w-3.5" />
          Descargar NFC
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={toggleActivo}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-60"
        >
          {sticker.activo ? (
            <>
              <PowerOff className="h-3.5 w-3.5" /> Desactivar
            </>
          ) : (
            <>
              <Power className="h-3.5 w-3.5" /> Activar
            </>
          )}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </li>
  );
}
