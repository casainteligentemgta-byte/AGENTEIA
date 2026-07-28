"use client";

import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  Download,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { verifyNFCAndPin } from "@/app/actions/nfc/verify-nfc";
import type { NfcVerifiedVehicle } from "@/lib/nfc/types";

type Props = {
  token: string;
};

export function PublicStickerView({ token }: Props) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<NfcVerifiedVehicle | null>(null);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await verifyNFCAndPin(token, pin);
    if (res.success) {
      setVehicle(res.data);
    } else {
      setErrorMsg(res.message || "Error al validar PIN");
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/20 text-blue-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Smart Taller NFC</h1>
          <p className="text-xs text-slate-400">Expediente Digital & Puerto Libre</p>
        </div>

        {!vehicle ? (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
              <Lock className="mx-auto mb-2 h-8 w-8 text-amber-400" />
              <p className="text-xs text-slate-300">
                Ingresa tu PIN de seguridad para acceder a los documentos del automóvil.
              </p>
            </div>

            {errorMsg ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/40 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : null}

            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-3 text-center text-2xl tracking-[0.5em] text-white focus:border-blue-500 focus:outline-none"
              required
            />

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-500 disabled:bg-blue-800"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desbloquear Ficha"}
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-start justify-between border-b border-slate-800 pb-2">
                <div>
                  <h2 className="font-bold text-white">
                    {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Vehículo"}
                    {vehicle.year != null ? ` (${vehicle.year})` : ""}
                  </h2>
                  <p className="font-mono text-xs text-slate-400">
                    VIN: {vehicle.vin || "—"}
                  </p>
                </div>
                {vehicle.plate ? (
                  <span className="rounded border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 font-mono text-xs text-blue-400">
                    {vehicle.plate}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 pt-1 text-xs text-slate-300">
                <Wrench className="h-3.5 w-3.5 text-blue-400" />
                <span>
                  Kilometraje Registrado:{" "}
                  <strong className="text-white">
                    {vehicle.mileage.toLocaleString("es-VE")} km
                  </strong>
                </span>
              </div>
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <FileText className="h-4 w-4 text-blue-400" /> Documentos Almacenados
              </h3>
              <div className="space-y-2">
                {vehicle.documents.length === 0 ? (
                  <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-500">
                    No hay documentos cargados.
                  </p>
                ) : (
                  vehicle.documents.map((doc) => {
                    const href =
                      doc.url ??
                      `/api/nfc/download?path=${encodeURIComponent(doc.filePath)}`;
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3"
                      >
                        <span className="truncate pr-2 text-xs text-slate-200">
                          {doc.fileName}
                        </span>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-slate-800 p-2 text-slate-200 transition hover:bg-slate-700"
                          aria-label={`Descargar ${doc.fileName}`}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setVehicle(null);
                setPin("");
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs text-slate-400"
            >
              Cerrar Ficha
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
