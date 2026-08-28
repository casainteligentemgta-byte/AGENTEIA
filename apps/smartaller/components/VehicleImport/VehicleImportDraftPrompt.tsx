"use client";

type Props = {
  vehicleCount: number;
  step: 1 | 2 | 3;
  updatedAt: string | null;
  onContinue: () => void;
  onStartNew: () => void;
};

function whenLabel(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86_400_000
  );
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

export function VehicleImportDraftPrompt({
  vehicleCount,
  step,
  updatedAt,
  onContinue,
  onStartNew,
}: Props) {
  const when = whenLabel(updatedAt);
  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 text-amber-900">
      <div>
        <h2 className="text-lg font-semibold">
          ¿Tienes un draft guardado desde ayer?
        </h2>
        <p className="mt-1 text-sm text-amber-800">
          {vehicleCount} vehículo{vehicleCount === 1 ? "" : "s"}
          {` · paso ${step}/3`}
          {when ? ` · ${when}` : ""}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Continuar con draft
        </button>
        <button
          type="button"
          onClick={onStartNew}
          className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-100"
        >
          Comenzar nuevo
        </button>
      </div>
    </div>
  );
}
