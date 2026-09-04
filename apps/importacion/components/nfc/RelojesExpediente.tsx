"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { savePuertoLibreFechasPlazoAction } from "@/app/actions/nfc/importacion-vehiculo";
import {
  AlertaBanner,
  AlertaDiasNacionalizacion,
} from "@/components/nfc/AlertaDiasNacionalizacion";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";
import { buildAlertaNacionalizacion } from "@/lib/importacion/alerta-nacionalizacion";
import { buildAlertaPresentacionSeniat } from "@/lib/importacion/alerta-presentacion-seniat";
import { resolveRegimenImportacion } from "@/lib/importacion/regimenes";
import type { ImportacionData } from "@/lib/schemas/vehiculo-documentos";

type Props = {
  vehiculoId: string;
  importacion: ImportacionData;
  canEdit?: boolean;
  compact?: boolean;
};

/**
 * Relojes del expediente: nacionalización (PL / equipaje) y cita SENIAT.
 */
export function RelojesExpediente({
  vehiculoId,
  importacion,
  canEdit = false,
  compact = false,
}: Props) {
  const nac = buildAlertaNacionalizacion(importacion);
  const seniat = buildAlertaPresentacionSeniat(importacion);
  const regimen = resolveRegimenImportacion(importacion.regimen);
  const esEquipaje = regimen === "equipaje";
  const faltaLimiteEquipaje = esEquipaje && !nac && canEdit;
  const faltaCitaSeniat = !seniat && canEdit &&
    (importacion.estadoSeniat ?? "pendiente") !== "presentada" &&
    (importacion.estadoSeniat ?? "pendiente") !== "rechazada";

  if (!nac && !seniat && !faltaLimiteEquipaje && !faltaCitaSeniat) {
    return compact ? null : <AlertaDiasNacionalizacion importacion={importacion} />;
  }

  return (
    <div className={compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2"}>
      {nac ? (
        <AlertaDiasNacionalizacion importacion={importacion} compact={compact} />
      ) : faltaLimiteEquipaje ? (
        <FechaPlazoCard
          vehiculoId={vehiculoId}
          campo="fechaLimiteNacionalizacion"
          titulo="Nacionalización por equipaje"
          hint="Define cuándo vence el plazo para nacionalizar este vehículo."
          compact={compact}
        />
      ) : null}

      {seniat ? (
        <AlertaBanner alerta={seniat} compact={compact} />
      ) : faltaCitaSeniat ? (
        <FechaPlazoCard
          vehiculoId={vehiculoId}
          campo="fechaPresentacionSeniat"
          titulo="Presentación SENIAT"
          hint="Agenda el día en que le toca presentar el expediente."
          compact={compact}
        />
      ) : null}
    </div>
  );
}

function FechaPlazoCard({
  vehiculoId,
  campo,
  titulo,
  hint,
  compact,
}: {
  vehiculoId: string;
  campo: "fechaLimiteNacionalizacion" | "fechaPresentacionSeniat";
  titulo: string;
  hint: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setError("Elige una fecha");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await savePuertoLibreFechasPlazoAction({
        vehiculoId,
        [campo]: fecha,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-zinc-50">{titulo}</p>
          {!compact ? (
            <p className="text-xs text-zinc-400 sm:text-sm">{hint}</p>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <PlanillaFechaField
              label="Fecha"
              name={campo}
              value={fecha}
              onChange={setFecha}
              className="min-w-[10rem] flex-1"
            />
            <button
              type="button"
              onClick={guardar}
              disabled={pending}
              className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
