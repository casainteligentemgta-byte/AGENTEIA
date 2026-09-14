"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, FileStack, Sparkles, X } from "lucide-react";
import { SMARTIMPORT_VALIDACION_PATH } from "@/lib/importacion/paths";

const STORAGE_KEY = "smartimport-novedades-20260914-deploy";

export function SmartImportNovedades({ deploySha }: { deploySha?: string }) {
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== "1");
  }, []);

  if (!visible) return null;

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <section
      aria-label="Novedades"
      className="rounded-2xl border border-cyan-700/40 bg-cyan-950/30 p-4"
    >
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-cyan-100">
            Novedades
            {deploySha ? (
              <span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-wide text-cyan-400/80">
                {deploySha.slice(0, 7)}
              </span>
            ) : null}
          </p>
          <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
            <li>
              Los <strong className="font-medium text-slate-100">papeles de la carga</strong>{" "}
              volvieron al BL: factura, certificado, embarque y desaduanamiento.
            </li>
            <li>
              Al guardar datos del BL regresas a la cola de{" "}
              <strong className="font-medium text-slate-100">embarque</strong>.
            </li>
            <li>
              Cuestionario de validación con el cliente (fase a fase).
            </li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/smartimport/lote"
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
            >
              <FileStack className="h-3.5 w-3.5" />
              Docs de carga
            </Link>
            <Link
              href={SMARTIMPORT_VALIDACION_PATH}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-700/60 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:border-cyan-500"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Validar con cliente
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-900 hover:text-slate-100"
          aria-label="Ocultar novedades"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
