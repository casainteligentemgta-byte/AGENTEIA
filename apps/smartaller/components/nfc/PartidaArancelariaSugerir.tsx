"use client";

import { useState, useTransition } from "react";
import { sugerirPartidaArancelariaAction } from "@/app/actions/nfc/importacion-arancel";
import type { ClasificarVehiculoResult } from "@/lib/arancel/clasificar-vehiculo";
import type { TipoCombustible } from "@/lib/schemas/importacion-alta";

type Props = {
  tipoCombustible: TipoCombustible | "";
  cilindradaCc: string;
  onApply: (codigo: string, meta: { fundamento: string }) => void;
};

export function PartidaArancelariaSugerir({
  tipoCombustible,
  cilindradaCc,
  onApply,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClasificarVehiculoResult | null>(null);
  const [traccion4x4, setTraccion4x4] = useState(false);

  function calcular() {
    setError(null);
    startTransition(async () => {
      const ccRaw = cilindradaCc.trim();
      const cc = ccRaw ? Number(ccRaw) : null;
      const res = await sugerirPartidaArancelariaAction({
        tipoCombustible: tipoCombustible || null,
        cilindradaCc: cc != null && Number.isFinite(cc) ? cc : null,
        uso: "turismo",
        traccion4x4,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setResult(res.result);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={traccion4x4}
            onChange={(e) => setTraccion4x4(e.target.checked)}
            className="rounded border-zinc-600"
          />
          4x4
        </label>
        <button
          type="button"
          onClick={calcular}
          disabled={pending}
          className="rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:border-cyan-500/60 disabled:opacity-60"
        >
          {pending ? "Calculando…" : "Calcular partida"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {result?.sugerida ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
          <p className="font-mono text-sm text-cyan-300">
            {result.sugerida.codigoFormateado}
          </p>
          <p className="mt-1">{result.sugerida.descripcionCorta}</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Confianza {result.sugerida.confianza}% · {result.sugerida.fundamento}
          </p>
          {result.advertencias[0] ? (
            <p className="mt-1 text-[11px] text-amber-400/90">
              {result.advertencias[0]}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() =>
              onApply(result.sugerida!.codigo, {
                fundamento: result.sugerida!.fundamento,
              })
            }
            className="mt-2 rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-cyan-500"
          >
            Aplicar al campo
          </button>
          {result.alternativas.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
              {result.alternativas.map((alt) => (
                <li key={alt.codigo}>
                  <button
                    type="button"
                    className="text-left font-mono text-zinc-400 hover:text-cyan-300"
                    onClick={() =>
                      onApply(alt.codigo, { fundamento: alt.fundamento })
                    }
                  >
                    {alt.codigoFormateado}
                  </button>{" "}
                  {alt.descripcionCorta}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
