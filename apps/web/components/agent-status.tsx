"use client";

import { useEffect, useState } from "react";
import { Bot, Sparkles, Loader2 } from "lucide-react";
import { getAgentStatus, type AgentStatusData } from "@/app/actions/agent-status";

const RING_SIZE = 72;
const RING_STROKE = 4;
const R = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

type AgentStatusProps = {
  isProcessing?: boolean;
  refreshIntervalMs?: number;
  /** Cuando cambia (ej. al terminar un mensaje), se vuelve a cargar el estado. */
  refetchTrigger?: number;
};

export function AgentStatus({
  isProcessing = false,
  refreshIntervalMs,
  refetchTrigger,
}: AgentStatusProps) {
  const [data, setData] = useState<AgentStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const result = await getAgentStatus();
      setData(result);
    } catch (e) {
      setData({
        memoryCount: 0,
        totalXp: 0,
        level: 1,
        xpPercent: 0,
        skills: [],
        error: e instanceof Error ? e.message : "No se pudo cargar el estado",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (refreshIntervalMs == null || refreshIntervalMs <= 0) return;
    const id = setInterval(fetchStatus, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs]);

  useEffect(() => {
    if (refetchTrigger != null) fetchStatus();
  }, [refetchTrigger]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/80 p-6">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  const status = data ?? {
    memoryCount: 0,
    totalXp: 0,
    level: 1,
    xpPercent: 0,
    skills: [],
  };

  // Anillo = progreso hacia el siguiente nivel (0–100 %)
  const strokeDashoffset = CIRCUMFERENCE - (status.xpPercent / 100) * CIRCUMFERENCE;

  return (
    <div
      className={`
        relative rounded-xl border border-neutral-800 bg-neutral-900/80 p-5
        transition-shadow duration-300
        ${isProcessing ? "shadow-[0_0_24px_rgba(34,197,94,0.15)]" : ""}
      `}
    >
      {/* Avatar con anillo de progreso (nivel) */}
      <div className="mb-4 flex justify-center">
        <div className="relative">
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            className="-rotate-90"
            aria-hidden
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth={RING_STROKE}
              className="text-neutral-800"
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              className="text-emerald-500/80 transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full bg-neutral-900"
            style={{ margin: RING_STROKE }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-400">
              <Bot className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs font-medium text-neutral-500">
        Nivel {status.level}
      </p>

      {/* Barra de XP (recuerdos) */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-neutral-500">
          <span>XP</span>
          <span>{status.totalXp} XP · {status.memoryCount} recuerdos</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-emerald-500/80 transition-all duration-500"
            style={{ width: `${status.xpPercent}%` }}
          />
        </div>
      </div>

      {/* Skills desbloqueadas */}
      <div className="mt-4 border-t border-neutral-800 pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Sparkles className="h-3.5 w-3.5" />
          Skills desbloqueadas
        </p>
        {status.skills.length === 0 ? (
          <p className="text-xs text-neutral-600">
            Aún no hay skills desbloqueadas.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {status.skills.map((skill) => (
              <li
                key={skill}
                className="rounded-md border border-neutral-700/80 bg-neutral-800/60 px-2 py-1 text-xs text-neutral-300"
              >
                {skill}
              </li>
            ))}
          </ul>
        )}
      </div>

      {data?.error && (
        <p className="mt-2 text-xs text-amber-600/90">{data.error}</p>
      )}
    </div>
  );
}
