"use client";

import { useMemo, useState } from "react";
import {
  VEHICULO_CATALOGO_OTRA,
  VEHICULO_COLORES,
  VEHICULO_MARCAS,
  aniosVehiculoCatalogo,
  modelosDeMarca,
} from "@/lib/puerto-libre/vehiculo-catalog";

const selectClass =
  "box-border w-full max-w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60";

const inputClass = selectClass;

type Props = {
  initialMarca?: string;
  initialModelo?: string;
  initialColor?: string;
  initialAnio?: number | null;
};

function resolveSelectValue(
  value: string,
  options: readonly string[]
): { select: string; custom: string } {
  const trimmed = value.trim();
  if (!trimmed) return { select: "", custom: "" };
  if (options.includes(trimmed)) return { select: trimmed, custom: "" };
  return { select: VEHICULO_CATALOGO_OTRA, custom: trimmed };
}

/** Selectores de marca → modelo, color y año (con opción Otra). */
export function VehiculoCatalogoFields({
  initialMarca = "",
  initialModelo = "",
  initialColor = "",
  initialAnio,
}: Props) {
  const marcaInit = resolveSelectValue(initialMarca, VEHICULO_MARCAS);
  const [marcaSelect, setMarcaSelect] = useState(marcaInit.select);
  const [marcaOtra, setMarcaOtra] = useState(marcaInit.custom);

  const marcaEfectiva =
    marcaSelect === VEHICULO_CATALOGO_OTRA ? marcaOtra.trim() : marcaSelect;
  const modelos = useMemo(
    () => (marcaEfectiva ? modelosDeMarca(marcaEfectiva) : []),
    [marcaEfectiva]
  );

  const modeloInit = resolveSelectValue(initialModelo, modelos);
  const [modeloSelect, setModeloSelect] = useState(() => {
    if (!initialModelo.trim()) return "";
    if (modelos.includes(initialModelo.trim())) return initialModelo.trim();
    if (modelos.length === 0 && initialModelo.trim()) return VEHICULO_CATALOGO_OTRA;
    return modeloInit.select || (initialModelo.trim() ? VEHICULO_CATALOGO_OTRA : "");
  });
  const [modeloOtra, setModeloOtra] = useState(() => {
    if (!initialModelo.trim()) return "";
    if (modelos.includes(initialModelo.trim())) return "";
    return initialModelo.trim();
  });

  const colorInit = resolveSelectValue(initialColor, VEHICULO_COLORES);
  const [colorSelect, setColorSelect] = useState(colorInit.select);
  const [colorOtra, setColorOtra] = useState(colorInit.custom);

  const anios = useMemo(() => aniosVehiculoCatalogo(), []);
  const anioDefault =
    initialAnio && anios.includes(initialAnio)
      ? String(initialAnio)
      : String(anios[0] ?? new Date().getFullYear());

  const marcaValue =
    marcaSelect === VEHICULO_CATALOGO_OTRA ? marcaOtra : marcaSelect;
  const modeloValue =
    modeloSelect === VEHICULO_CATALOGO_OTRA ? modeloOtra : modeloSelect;
  const colorValue =
    colorSelect === VEHICULO_CATALOGO_OTRA ? colorOtra : colorSelect;

  return (
    <>
      <label className="block min-w-0 space-y-1.5">
        <span className="text-sm text-slate-400">Marca *</span>
        <select
          required
          value={marcaSelect}
          onChange={(e) => {
            const next = e.target.value;
            setMarcaSelect(next);
            if (next !== VEHICULO_CATALOGO_OTRA) setMarcaOtra("");
            setModeloSelect("");
            setModeloOtra("");
          }}
          className={selectClass}
        >
          <option value="" disabled>
            Selecciona marca
          </option>
          {VEHICULO_MARCAS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value={VEHICULO_CATALOGO_OTRA}>Otra…</option>
        </select>
        {marcaSelect === VEHICULO_CATALOGO_OTRA ? (
          <input
            required
            value={marcaOtra}
            onChange={(e) => setMarcaOtra(e.target.value)}
            placeholder="Escribe la marca"
            className={inputClass}
          />
        ) : null}
        <input type="hidden" name="marca" value={marcaValue} />
      </label>

      <label className="block min-w-0 space-y-1.5">
        <span className="text-sm text-slate-400">Modelo *</span>
        {modelos.length > 0 && marcaSelect !== VEHICULO_CATALOGO_OTRA ? (
          <>
            <select
              required
              value={modeloSelect}
              onChange={(e) => {
                const next = e.target.value;
                setModeloSelect(next);
                if (next !== VEHICULO_CATALOGO_OTRA) setModeloOtra("");
              }}
              className={selectClass}
              disabled={!marcaSelect}
            >
              <option value="" disabled>
                Selecciona modelo
              </option>
              {modelos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value={VEHICULO_CATALOGO_OTRA}>Otro…</option>
            </select>
            {modeloSelect === VEHICULO_CATALOGO_OTRA ? (
              <input
                required
                value={modeloOtra}
                onChange={(e) => setModeloOtra(e.target.value)}
                placeholder="Escribe el modelo"
                className={inputClass}
              />
            ) : null}
          </>
        ) : (
          <input
            required
            value={modeloOtra}
            onChange={(e) => {
              setModeloSelect(VEHICULO_CATALOGO_OTRA);
              setModeloOtra(e.target.value);
            }}
            placeholder={
              marcaEfectiva ? "Escribe el modelo" : "Primero elige marca"
            }
            disabled={!marcaEfectiva}
            className={inputClass}
          />
        )}
        <input type="hidden" name="modelo" value={modeloValue} />
      </label>

      <label className="block min-w-0 space-y-1.5">
        <span className="text-sm text-slate-400">Color *</span>
        <select
          required
          value={colorSelect}
          onChange={(e) => {
            const next = e.target.value;
            setColorSelect(next);
            if (next !== VEHICULO_CATALOGO_OTRA) setColorOtra("");
          }}
          className={selectClass}
        >
          <option value="" disabled>
            Selecciona color
          </option>
          {VEHICULO_COLORES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={VEHICULO_CATALOGO_OTRA}>Otro…</option>
        </select>
        {colorSelect === VEHICULO_CATALOGO_OTRA ? (
          <input
            required
            value={colorOtra}
            onChange={(e) => setColorOtra(e.target.value)}
            placeholder="Escribe el color"
            className={inputClass}
          />
        ) : null}
        <input type="hidden" name="color" value={colorValue} />
      </label>

      <label className="block min-w-0 space-y-1.5">
        <span className="text-sm text-slate-400">Año *</span>
        <select
          name="anio"
          required
          defaultValue={anioDefault}
          className={selectClass}
        >
          {anios.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
