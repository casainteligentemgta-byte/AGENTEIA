"use client";

import { REVIEW_FIELD_TONE_META } from "@/lib/importacion/vehicle-import-field-tone";

const ORDER = ["auto", "input", "optional", "critical"] as const;

export function FieldToneLegend() {
  return (
    <ul className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
      {ORDER.map((tone) => {
        const meta = REVIEW_FIELD_TONE_META[tone];
        return (
          <li key={tone} className="flex items-start gap-1.5 text-zinc-400">
            <span aria-hidden>{meta.emoji}</span>
            <span>{meta.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
