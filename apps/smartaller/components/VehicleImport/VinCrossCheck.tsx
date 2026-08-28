"use client";

import {
  evaluateVinCrossCheck,
  type VinDocSources,
} from "@/lib/importacion/vehicle-import-vin";

type Props = {
  vin: string;
  sources?: VinDocSources;
};

function mark(status: "ok" | "warn" | "fail"): string {
  if (status === "ok") return "✓";
  if (status === "warn") return "⚠️";
  return "✕";
}

function tone(status: "ok" | "warn" | "fail"): string {
  if (status === "ok") return "text-emerald-300";
  if (status === "warn") return "text-amber-300";
  return "text-red-300";
}

export function VinCrossCheck({ vin, sources }: Props) {
  const check = evaluateVinCrossCheck(vin, sources);
  const border = check.items.some((item) => item.status === "fail")
    ? "border-red-900/50 bg-red-950/20"
    : check.items.some((item) => item.status === "warn")
      ? "border-amber-900/40 bg-amber-950/20"
      : "border-emerald-900/40 bg-emerald-950/20";

  return (
    <div className={`mt-2 rounded-xl border px-3 py-2 ${border}`}>
      <p className="font-mono text-sm text-zinc-100">
        VIN: [{check.display || "—"}]
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs">
        {check.items.map((item) => (
          <li key={item.label} className={tone(item.status)}>
            {mark(item.status)} {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
