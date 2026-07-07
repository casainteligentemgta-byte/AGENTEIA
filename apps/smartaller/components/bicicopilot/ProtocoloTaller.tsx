"use client";

import { useState, useTransition } from "react";
import { Loader2, Wrench } from "lucide-react";
import { submitMaintenanceProtocol } from "@/app/actions/bicicopilot";
import {
  COMPONENT_TYPE_LABELS,
  type BikeComponent,
} from "@/lib/bicicopilot/types";

type ProtocoloTallerProps = {
  bikeId: string;
  shopId: string;
  component: BikeComponent;
};

const CHECKLIST = [
  { key: "transmissionChecked" as const, label: "Transmisión revisada y lubricada" },
  { key: "brakesChecked" as const, label: "Frenos — pastillas y ajuste" },
  { key: "bearingsChecked" as const, label: "Rodamientos y juegos" },
  { key: "torqueChecked" as const, label: "Torque de pernos críticos" },
];

export function ProtocoloTaller({ bikeId, shopId, component }: ProtocoloTallerProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checks, setChecks] = useState({
    transmissionChecked: false,
    brakesChecked: false,
    bearingsChecked: false,
    torqueChecked: false,
  });
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  function toggleCheck(key: keyof typeof checks) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await submitMaintenanceProtocol({
        bikeId,
        shopId,
        componentId: component.id,
        mechanicNotes: notes,
        photoProofUrl: photoUrl,
        ...checks,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      setChecks({
        transmissionChecked: false,
        brakesChecked: false,
        bearingsChecked: false,
        torqueChecked: false,
      });
      setNotes("");
      setPhotoUrl("");
    });
  }

  return (
    <section className="app-card-white p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Wrench className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Protocolo de cierre</h2>
          <p className="text-sm text-zinc-500">
            {COMPONENT_TYPE_LABELS[component.component_type]} · {component.brand_model}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-zinc-800">
            Checklist obligatorio
          </legend>
          {CHECKLIST.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 px-4 py-3 transition hover:border-brand-300 hover:bg-brand-50/50"
            >
              <input
                type="checkbox"
                checked={checks[item.key]}
                onChange={() => toggleCheck(item.key)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-zinc-700">{item.label}</span>
            </label>
          ))}
        </fieldset>

        <div>
          <label htmlFor="mechanic-notes" className="mb-1.5 block text-sm font-medium text-zinc-600">
            Notas del mecánico
          </label>
          <textarea
            id="mechanic-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="app-input min-h-[80px] resize-none"
            placeholder="Observaciones del servicio…"
          />
        </div>

        <div>
          <label htmlFor="photo-url" className="mb-1.5 block text-sm font-medium text-zinc-600">
            URL foto de prueba (opcional)
          </label>
          <input
            id="photo-url"
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="app-input"
            placeholder="https://…"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            Protocolo guardado. Contador del componente reiniciado a 0 km.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Cerrar servicio y resetear contador
        </button>
      </form>
    </section>
  );
}
