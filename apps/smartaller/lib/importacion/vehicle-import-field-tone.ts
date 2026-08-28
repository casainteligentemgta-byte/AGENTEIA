import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";

export type ReviewFieldTone = "auto" | "input" | "optional" | "critical";

const CRITICAL_KEYS = new Set<keyof CargaMasivaRow>([
  "vin",
  "serialCarroceria",
  "serialMotor",
]);

const REQUIRED_KEYS = new Set<keyof CargaMasivaRow>(["marca", "modelo"]);

export const REVIEW_FIELD_TONE_META: Record<
  ReviewFieldTone,
  { emoji: string; label: string; inputClass: string; badgeClass: string }
> = {
  auto: {
    emoji: "🟢",
    label: "Auto-rellenado, confiable",
    inputClass:
      "w-full rounded-xl border border-emerald-400/70 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-50 outline-none focus:border-emerald-300",
    badgeClass: "bg-emerald-900/70 text-emerald-100",
  },
  input: {
    emoji: "🔵",
    label: "Requiere tu dato",
    inputClass:
      "w-full rounded-xl border border-blue-400/70 bg-blue-950/40 px-3 py-2 text-sm text-blue-50 outline-none focus:border-blue-300",
    badgeClass: "bg-blue-900/70 text-blue-100",
  },
  optional: {
    emoji: "🟠",
    label: "Falta completar (recomendado)",
    inputClass:
      "w-full rounded-xl border border-amber-400/70 bg-amber-950/40 px-3 py-2 text-sm text-amber-50 outline-none focus:border-amber-300",
    badgeClass: "bg-amber-900/70 text-amber-100",
  },
  critical: {
    emoji: "🔴",
    label: "Crítico (VIN, seriales) — verificar 2x",
    inputClass:
      "w-full rounded-xl border border-red-400/70 bg-red-950/40 px-3 py-2 text-sm text-red-50 outline-none focus:border-red-300",
    badgeClass: "bg-red-900/70 text-red-100",
  },
};

export function reviewFieldTone(params: {
  key: keyof CargaMasivaRow;
  value: string;
  extracted: boolean;
}): ReviewFieldTone {
  const empty = params.value.trim().length === 0;

  if (CRITICAL_KEYS.has(params.key)) {
    return "critical";
  }

  if (empty) {
    return REQUIRED_KEYS.has(params.key) ? "input" : "optional";
  }

  return params.extracted ? "auto" : "input";
}
