"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Nfc } from "lucide-react";
import {
  setPuertoLibrePinAction,
  type PuertoLibreFicha,
} from "@/app/actions/nfc/importacion-vehiculo";
import { createNfcStickerAction } from "@/app/actions/nfc/nfc-management";
import { NFCQRCode } from "@/components/nfc/NFCQRCode";
import { PinFieldWithReveal } from "@/components/nfc/PinFieldWithReveal";

type Props = {
  ficha: Pick<
    PuertoLibreFicha,
    | "id"
    | "placa"
    | "marca"
    | "modelo"
    | "color"
    | "nombre_cliente"
    | "tienePin"
    | "sticker"
    | "codigoExpediente"
  >;
  baseUrl: string;
};

export function PuertoLibreExpedienteNfc({ ficha, baseUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const etiqueta =
    ficha.codigoExpediente?.trim() ||
    (ficha.placa ? `PL-${ficha.placa}` : "Puerto Libre");

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Nfc className="h-4 w-4 text-cyan-400" />
            Sticker NFC
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Configura el PIN y genera el enlace público de este expediente.
          </p>
        </div>
        {ficha.tienePin ? (
          <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-300">
            PIN listo
          </span>
        ) : (
          <span className="rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-300">
            Sin PIN
          </span>
        )}
      </div>

      {(message || error) && (
        <p
          className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
            error
              ? "border-red-900/50 bg-red-950/30 text-red-200"
              : "border-emerald-900/40 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          {error ?? message}
        </p>
      )}

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        action={(fd) => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await setPuertoLibrePinAction({
              vehiculoId: ficha.id,
              pin: String(fd.get("pin") ?? ""),
            });
            if (!result.success) {
              setError(result.error);
              return;
            }
            setMessage("PIN NFC guardado");
            router.refresh();
          });
        }}
      >
        <PinFieldWithReveal
          label={`PIN de desbloqueo ${ficha.tienePin ? "(actualizar)" : "*"}`}
          required
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar PIN"}
        </button>
      </form>

      {ficha.sticker ? (
        <div className="mt-5 flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm text-zinc-300">
              Estado:{" "}
              <span
                className={
                  ficha.sticker.activo ? "text-emerald-400" : "text-zinc-500"
                }
              >
                {ficha.sticker.activo ? "Activo" : "Inactivo"}
              </span>
            </p>
            <div className="rounded-xl border border-cyan-700/50 bg-cyan-950/30 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-400/80">
                URL NFC (para NFC Tools)
              </p>
              <a
                href={`${baseUrl}/v/${ficha.sticker.token}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 block break-all font-mono text-sm leading-relaxed text-cyan-200 hover:text-cyan-100"
              >
                {baseUrl}/v/{ficha.sticker.token}
              </a>
            </div>
            <a
              href={`/api/nfc/download?id=${ficha.sticker.id}&format=txt`}
              className="inline-block text-xs text-zinc-400 hover:text-zinc-200"
            >
              Descargar payload NFC
            </a>
          </div>
          <NFCQRCode url={`${baseUrl}/v/${ficha.sticker.token}`} size={140} />
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            setError(null);
            startTransition(async () => {
              if (!ficha.tienePin) {
                setError("Configura el PIN antes de crear el sticker NFC.");
                return;
              }
              const result = await createNfcStickerAction({
                vehiculoId: ficha.id,
                placa: ficha.placa,
                marca: ficha.marca,
                modelo: ficha.modelo,
                color: ficha.color,
                nombreTitular: ficha.nombre_cliente,
                etiqueta,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Sticker NFC creado");
              router.refresh();
            });
          }}
          className="mt-4 w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
        >
          Generar sticker NFC
        </button>
      )}
    </section>
  );
}
