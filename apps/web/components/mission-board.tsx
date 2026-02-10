"use client";

import { useEffect, useState } from "react";
import { Target, CheckCircle2, Loader2, Zap } from "lucide-react";
import { getMissions, updateMissionStatus, type Mission } from "@/app/actions/missions";

type MissionBoardProps = {
  /** Cuando cambia (ej. tras respuesta del agente), se recargan las misiones. */
  refetchTrigger?: number;
};

export function MissionBoard({ refetchTrigger }: MissionBoardProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { missions: data, error: err } = await getMissions();
    setMissions(data);
    setError(err ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (refetchTrigger != null) load();
  }, [refetchTrigger]);

  const handleToggle = async (m: Mission) => {
    const next = m.status === "pending" ? "completed" : "pending";
    setTogglingId(m.id);
    const { ok, error: err } = await updateMissionStatus(m.id, next);
    setTogglingId(null);
    if (ok) setMissions((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: next } : x)));
    else setError(err ?? null);
  };

  const pending = missions.filter((m) => m.status === "pending");
  const completed = missions.filter((m) => m.status === "completed");

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/50 p-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="mb-4 flex items-center gap-2 border-b border-neutral-800 pb-3">
        <Target className="h-5 w-5 text-emerald-500/80" />
        <h2 className="text-sm font-medium text-neutral-200">Mission Control</h2>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-amber-800/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Columna Pending */}
        <div className="flex flex-col rounded-lg border border-neutral-700/80 bg-neutral-900/30">
          <div className="flex items-center gap-2 border-b border-neutral-700/80 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-amber-500/80" />
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Pendientes
            </span>
            <span className="ml-auto text-xs text-neutral-600">{pending.length}</span>
          </div>
          <div className="min-h-[80px] space-y-2 p-2">
            {pending.length === 0 ? (
              <p className="py-4 text-center text-xs text-neutral-600">Sin misiones pendientes</p>
            ) : (
              pending.map((m) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  onToggle={() => handleToggle(m)}
                  isToggling={togglingId === m.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Columna Completed */}
        <div className="flex flex-col rounded-lg border border-neutral-700/80 bg-neutral-900/30">
          <div className="flex items-center gap-2 border-b border-neutral-700/80 px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Completadas
            </span>
            <span className="ml-auto text-xs text-neutral-600">{completed.length}</span>
          </div>
          <div className="min-h-[80px] space-y-2 p-2">
            {completed.length === 0 ? (
              <p className="py-4 text-center text-xs text-neutral-600">Aún no hay completadas</p>
            ) : (
              completed.map((m) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  onToggle={() => handleToggle(m)}
                  isToggling={togglingId === m.id}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MissionCard({
  mission,
  onToggle,
  isToggling,
}: {
  mission: Mission;
  onToggle: () => void;
  isToggling: boolean;
}) {
  const due = mission.due_date
    ? new Date(mission.due_date + "T12:00:00").toLocaleDateString("es", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <div
      className={`
        group rounded-lg border px-3 py-2.5 transition-colors
        ${mission.status === "completed" ? "border-neutral-700/50 bg-neutral-800/30 opacity-90" : "border-neutral-700/80 bg-neutral-800/50 hover:border-neutral-600"}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium text-neutral-200 ${mission.status === "completed" ? "line-through opacity-80" : ""}`}
          >
            {mission.title}
          </p>
          {mission.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{mission.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            {due && (
              <span className="text-xs text-neutral-600">Vence {due}</span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-emerald-500/80">
              <Zap className="h-3 w-3" />
              {mission.reward_xp} XP
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={isToggling}
          className={`
            rounded-md p-1.5 transition-colors
            ${mission.status === "pending" ? "text-neutral-500 hover:bg-emerald-500/20 hover:text-emerald-400" : "text-emerald-500/80 hover:bg-neutral-700 hover:text-emerald-400"}
            disabled:opacity-50
          `}
          aria-label={mission.status === "pending" ? "Marcar completada" : "Volver a pendiente"}
        >
          {isToggling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mission.status === "pending" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4 fill-emerald-500/30" />
          )}
        </button>
      </div>
    </div>
  );
}
