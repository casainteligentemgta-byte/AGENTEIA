"use client";

import { useState } from "react";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { updateMissionStatus, type Mission } from "@/app/actions/missions";
import { SourceCard } from "./source-card";
import type { ProviderMeta } from "@/lib/ojo-de-dios/types";

const AGENDA_META: ProviderMeta = {
  id: "agenda",
  label: "Agenda",
  status: "ok",
  fetchedAt: null,
  sourceName: "Misiones del agente",
  sourceUrl: null,
  message: null,
};

export function AgendaCard({
  initialMissions,
  missionsError,
}: {
  initialMissions: Mission[];
  missionsError: string | null;
}) {
  const [missions, setMissions] = useState(initialMissions);
  const [error, setError] = useState(missionsError);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const pending = missions.filter((mission) => mission.status === "pending");
  const meta: ProviderMeta = {
    ...AGENDA_META,
    status: error ? "error" : "ok",
    message: error,
  };

  const complete = async (mission: Mission) => {
    setCompletingId(mission.id);
    const { ok, error: err } = await updateMissionStatus(mission.id, "completed");
    setCompletingId(null);
    if (!ok) {
      setError(err ?? "No se pudo actualizar la misión.");
      return;
    }
    setMissions((prev) =>
      prev.map((item) => (item.id === mission.id ? { ...item, status: "completed" } : item))
    );
  };

  return (
    <SourceCard meta={meta} id="agenda">
      {error ? (
        <p className="text-sm text-amber-200">{error}</p>
      ) : pending.length === 0 ? (
        <div className="flex min-h-[88px] flex-col items-start justify-center gap-2 text-sm text-white/55">
          <CalendarDays className="h-5 w-5 text-cyan-300/70" />
          <p>Sin misiones pendientes.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.slice(0, 6).map((mission) => {
            const due = mission.due_date
              ? new Date(mission.due_date + "T12:00:00").toLocaleDateString("es-VE", {
                  day: "numeric",
                  month: "short",
                })
              : null;
            return (
              <li
                key={mission.id}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{mission.title}</p>
                  {mission.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-white/50">{mission.description}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-white/40">
                    {mission.reward_xp} XP{due ? ` · vence ${due}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => complete(mission)}
                  disabled={completingId === mission.id}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  aria-label={`Marcar completada: ${mission.title}`}
                >
                  {completingId === mission.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SourceCard>
  );
}
