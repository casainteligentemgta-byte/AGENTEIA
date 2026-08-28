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
      "w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 outline-none placeholder:text-emerald-700/50 focus:border-emerald-400",
    badgeClass:
      "border border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  input: {
    emoji: "🔵",
    label: "Requiere tu dato",
    inputClass:
      "w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none placeholder:text-blue-700/50 focus:border-blue-400",
    badgeClass: "border border-blue-200 bg-blue-50 text-blue-900",
  },
  optional: {
    emoji: "🟠",
    label: "Falta completar (recomendado)",
    inputClass:
      "w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 outline-none placeholder:text-amber-700/50 focus:border-amber-400",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  critical: {
    emoji: "🔴",
    label: "Crítico (VIN, seriales) — verificar 2x",
    inputClass:
      "w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 outline-none placeholder:text-red-700/50 focus:border-red-400",
    badgeClass: "border border-red-200 bg-red-50 text-red-900",
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
