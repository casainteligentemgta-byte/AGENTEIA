"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Check, Loader2, Target } from "lucide-react";
import { getMissions, updateMissionStatus, type Mission } from "@/app/actions/missions";
import { createClient } from "@/lib/supabase/client";

type Priority = "critical" | "high" | "normal";

function getPriority(mission: Mission): Priority {
  const today = new Date().toISOString().slice(0, 10);
  if (mission.due_date && mission.due_date <= today) return "critical";
  if (mission.reward_xp >= 50) return "critical";
  if (mission.reward_xp >= 25) return "high";
  return "normal";
}

const priorityConfig: Record<
  Priority,
  { icon: typeof Zap; className: string; label: string }
> = {
  critical: {
    icon: Zap,
    className: "text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]",
    label: "Critical",
  },
  high: {
    icon: Zap,
    className: "text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]",
    label: "High",
  },
  normal: {
    icon: Zap,
    className: "text-emerald-500/90 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]",
    label: "Normal",
  },
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function MissionControl() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { missions: data, error: err } = await getMissions();
    setMissions(data ?? []);
    setError(err ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("agent_missions_realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "agent_missions" },
          () => load()
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } catch {
      // Sin Supabase configurado o Realtime no disponible; la lista se actualiza con load()
    }
  }, [load]);

  const handleComplete = async (m: Mission) => {
    if (m.status === "completed") return;
    setCompletingId(m.id);
    const { ok, error: err } = await updateMissionStatus(m.id, "completed");
    setCompletingId(null);
    if (ok) setMissions((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "completed" as const } : x)));
    else setError(err ?? null);
  };

  const pending = missions.filter((m) => m.status === "pending");

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-zinc-950/50 p-[1px] shadow-xl backdrop-blur-xl"
      style={{
        background:
          "linear-gradient(135deg, rgba(63,63,70,0.4) 0%, rgba(39,39,42,0.2) 50%, rgba(24,24,27,0.4) 100%)",
      }}
    >
      <div className="relative rounded-2xl border border-white/5 bg-zinc-950/60 backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-zinc-800/80 px-4 py-3">
          <Target className="h-5 w-5 text-zinc-500" />
          <h2 className="text-sm font-semibold tracking-tight text-zinc-200">Mission Control</h2>
        </div>

        <div className="min-h-[120px] p-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : error ? (
            <p className="rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              {error}
            </p>
          ) : pending.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-600">Sin misiones pendientes</p>
          ) : (
            <motion.ul
              className="space-y-3"
              variants={container}
              initial="hidden"
              animate="show"
            >
              <AnimatePresence mode="popLayout">
                {pending.map((m) => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    onComplete={() => handleComplete(m)}
                    isCompleting={completingId === m.id}
                    variants={item}
                  />
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MissionCard({
  mission,
  onComplete,
  isCompleting,
  variants,
}: {
  mission: Mission;
  onComplete: () => void;
  isCompleting: boolean;
  variants: typeof item;
}) {
  const priority = getPriority(mission);
  const config = priorityConfig[priority];
  const Icon = config.icon;

  const dueLabel = mission.due_date
    ? new Date(mission.due_date + "T12:00:00").toLocaleDateString("es", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <motion.li
      layout
      variants={variants}
      className="group flex items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/60"
    >
      <div className={`flex shrink-0 ${config.className}`}>
        <Icon className="h-5 w-5" aria-label={config.label} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-100">{mission.title}</p>
        {mission.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{mission.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
            style={{ boxShadow: "0 0 12px rgba(16,185,129,0.15)" }}
          >
            {mission.reward_xp} XP
          </span>
          {dueLabel && (
            <span className="text-xs text-zinc-600">Vence {dueLabel}</span>
          )}
        </div>
      </div>

      <motion.button
        type="button"
        onClick={onComplete}
        disabled={isCompleting}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition-colors hover:bg-emerald-500/20 hover:shadow-[0_0_14px_rgba(16,185,129,0.2)] disabled:opacity-50"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Marcar completada"
      >
        {isCompleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </motion.button>
    </motion.li>
  );
}
