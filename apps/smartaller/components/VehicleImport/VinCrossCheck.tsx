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
  if (status === "ok") return "text-emerald-900";
  if (status === "warn") return "text-amber-900";
  return "text-red-900";
}

export function VinCrossCheck({ vin, sources }: Props) {
  const check = evaluateVinCrossCheck(vin, sources);
  const border = check.items.some((item) => item.status === "fail")
    ? "border-red-200 bg-red-50 text-red-900"
    : check.items.some((item) => item.status === "warn")
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900";

  return (
    <div className={`mt-2 rounded-xl border px-3 py-2 ${border}`}>
      <p className="font-mono text-sm">
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
