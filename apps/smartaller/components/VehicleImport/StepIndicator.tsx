"use client";

type Props = {
  step: 1 | 2 | 3;
  vehicleIndex: number;
  vehicleTotal: number;
};

const STEPS = [
  { id: 1, label: "Documentos" },
  { id: 2, label: "Revisar datos" },
  { id: 3, label: "Confirmar" },
] as const;

export function VehicleImportStepIndicator({
  step,
  vehicleIndex,
  vehicleTotal,
}: Props) {
  const pct = Math.round((step / 3) * 100);
  return (
    <div className="space-y-3">
      <ol className="flex items-center gap-2" aria-label={`Paso ${step} de 3`}>
        {STEPS.map((item, index) => {
          const done = step > item.id;
          const active = step === item.id;
          return (
            <li key={item.id} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-cyan-600 text-white"
                    : done
                      ? "bg-emerald-700 text-white"
                      : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {item.id}
              </div>
              <span
                className={`truncate text-xs font-medium sm:text-sm ${
                  active ? "text-zinc-100" : "text-zinc-500"
                }`}
              >
                {item.label}
                <span className="ml-1 text-zinc-600">({item.id}/3)</span>
              </span>
              {index < STEPS.length - 1 ? (
                <span className="hidden h-px flex-1 bg-zinc-800 sm:block" />
              ) : null}
            </li>
          );
        })}
      </ol>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-cyan-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {vehicleTotal > 0 ? (
        <p className="text-xs text-zinc-500">
          Vehículo {Math.min(vehicleIndex + 1, vehicleTotal)} de {vehicleTotal}
        </p>
      ) : (
        <p className="text-xs text-zinc-500">Sube los documentos para detectar vehículos</p>
      )}
    </div>
  );
}
