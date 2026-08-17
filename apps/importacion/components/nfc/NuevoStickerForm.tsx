"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type HTMLAttributes } from "react";
import { createNfcStickerAction } from "@/app/actions/nfc/nfc-management";
import { PinFieldWithReveal } from "@/components/nfc/PinFieldWithReveal";

export type NfcVehiculoOption = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  nombreCliente: string | null;
};

type Props = {
  vehiculos: NfcVehiculoOption[];
};

export function NuevoStickerForm({ vehiculos }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vehiculoId, setVehiculoId] = useState("");
  const [placa, setPlaca] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [color, setColor] = useState("");
  const [nombreTitular, setNombreTitular] = useState("");

  const selected = useMemo(
    () => vehiculos.find((v) => v.id === vehiculoId) ?? null,
    [vehiculos, vehiculoId]
  );

  function onSelectVehiculo(id: string) {
    setVehiculoId(id);
    if (!id) return;
    const v = vehiculos.find((item) => item.id === id);
    if (!v) return;
    setPlaca(v.placa ?? "");
    setMarca(v.marca ?? "");
    setModelo(v.modelo ?? "");
    setColor(v.color ?? "");
    setNombreTitular(v.nombreCliente ?? "");
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const pinRaw = String(formData.get("pin") ?? "").trim();
      if (vehiculoId && pinRaw.length < 4) {
        setError("Con vehículo vinculado, el PIN es obligatorio (4–8 dígitos).");
        return;
      }

      const result = await createNfcStickerAction({
        vehiculoId: vehiculoId || null,
        etiqueta: String(formData.get("etiqueta") ?? "").trim() || null,
        placa: placa.trim() || null,
        marca: marca.trim() || null,
        modelo: modelo.trim() || null,
        color: color.trim() || null,
        nombreTitular: nombreTitular.trim() || null,
        pin: pinRaw || null,
        notas: String(formData.get("notas") ?? "").trim() || null,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(`/importacion?created=${result.token}`);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm text-zinc-400">Vehículo de SmartTaller</span>
        <select
          value={vehiculoId}
          onChange={(e) => onSelectVehiculo(e.target.value)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
        >
          <option value="">Sin vincular (datos manuales)</option>
          {vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.placa}
              {[v.marca, v.modelo].filter(Boolean).length
                ? ` — ${[v.marca, v.modelo].filter(Boolean).join(" ")}`
                : ""}
              {v.nombreCliente ? ` · ${v.nombreCliente}` : ""}
            </option>
          ))}
        </select>
        {vehiculos.length === 0 ? (
          <span className="block text-xs text-zinc-500">
            No hay vehículos en tu taller. Puedes crear el sticker con datos manuales.
          </span>
        ) : selected ? (
          <span className="block text-xs text-cyan-500/80">
            Al guardar, el PIN se asigna a este vehículo para desbloquear la ficha pública.
          </span>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Etiqueta" name="etiqueta" placeholder="Sticker FL-001" />
        <ControlledField
          label="Placa"
          name="placa"
          value={placa}
          onChange={setPlaca}
          placeholder="AA90N9O"
          className="uppercase"
        />
        <ControlledField
          label="Marca"
          name="marca"
          value={marca}
          onChange={setMarca}
          placeholder="Toyota"
        />
        <ControlledField
          label="Modelo"
          name="modelo"
          value={modelo}
          onChange={setModelo}
          placeholder="Corolla"
        />
        <ControlledField
          label="Color"
          name="color"
          value={color}
          onChange={setColor}
          placeholder="Blanco"
        />
        <ControlledField
          label="Titular"
          name="nombreTitular"
          value={nombreTitular}
          onChange={setNombreTitular}
          placeholder="Nombre del propietario"
        />
        <Field
          label={vehiculoId ? "PIN (obligatorio)" : "PIN (opcional)"}
          name="pin"
          type="password"
          inputMode="numeric"
          placeholder="4–8 dígitos"
          autoComplete="new-password"
        />
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Notas internas</span>
        <textarea
          name="notas"
          rows={3}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
          placeholder="Solo visibles en el panel del taller"
        />
      </label>

      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear sticker NFC"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  className = "",
  inputMode,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  className?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-zinc-400">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className={`w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 ${className}`}
      />
    </label>
  );
}

function ControlledField({
  label,
  name,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-zinc-400">{label}</span>
      <input
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 ${className}`}
      />
    </label>
  );
}
