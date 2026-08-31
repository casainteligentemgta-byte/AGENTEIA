"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isGenericModelo } from "@/lib/importacion/completitud-datos";
import {
  VEHICULO_CATALOGO_OTRA,
  VEHICULO_MARCAS,
  modelosDeMarca,
  resolveMarcaCatalogo,
  sugerenciasColorCargaMasiva,
} from "@/lib/importacion/vehiculo-catalog";

const cellClass =
  "box-border w-full min-w-0 max-w-full rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-100 outline-none focus:border-cyan-500/50";

function uniqueOptions(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

function matchOption(options: string[], current: string): string {
  return (
    options.find((item) => item.toLowerCase() === current.toLowerCase()) ??
    current
  );
}

export function CargaMasivaSelectAllCheckbox({
  all,
  some,
  onToggle,
  label,
}: {
  all: boolean;
  some: boolean;
  onToggle: (next: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some && !all;
  }, [all, some]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={all}
      onChange={(e) => onToggle(e.target.checked)}
      aria-label={label}
      className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-cyan-500 accent-cyan-400"
    />
  );
}

export function CargaMasivaMarcaCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const current = value.trim();
  const resolved = resolveMarcaCatalogo(current);
  const inCatalog = Boolean(resolved);
  const [otraMode, setOtraMode] = useState(Boolean(current && !inCatalog));
  useEffect(() => {
    if (inCatalog) setOtraMode(false);
  }, [current, inCatalog]);
  const options = uniqueOptions([
    ...VEHICULO_MARCAS,
    ...(current && !inCatalog ? [current] : []),
  ]);
  const selected = !current
    ? ""
    : otraMode || !inCatalog
      ? VEHICULO_CATALOGO_OTRA
      : resolved!;

  return (
    <div
      className="w-[6.75rem] max-w-[6.75rem] min-w-0 space-y-1"
      title={current || undefined}
    >
      <select
        className={cellClass}
        value={selected}
        onChange={(e) => {
          const next = e.target.value;
          if (next === VEHICULO_CATALOGO_OTRA) {
            setOtraMode(true);
            if (inCatalog) onChange("");
            return;
          }
          setOtraMode(false);
          onChange(next);
        }}
        aria-label="Marca"
      >
        <option value="">Marca…</option>
        {options.map((marca) => (
          <option key={marca} value={marca}>
            {marca}
          </option>
        ))}
        <option value={VEHICULO_CATALOGO_OTRA}>Otra…</option>
      </select>
      {otraMode ? (
        <input
          className={cellClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe la marca"
        />
      ) : null}
    </div>
  );
}

export function CargaMasivaModeloCell({
  marca,
  value,
  onChange,
}: {
  marca: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const modelos = modelosDeMarca(marca);
  const current = value.trim();
  const generic = isGenericModelo(current);
  const inCatalog = modelos.some((m) => m.toLowerCase() === current.toLowerCase());
  const extra = current && !inCatalog ? [current] : [];
  const options = uniqueOptions([...modelos, ...extra]);
  const [otraMode, setOtraMode] = useState(
    Boolean(current && !inCatalog && !generic)
  );
  useEffect(() => {
    if (inCatalog || generic) setOtraMode(false);
  }, [current, generic, inCatalog]);
  const showOtra = otraMode || Boolean(current && !inCatalog && !generic);
  const selected = !current
    ? ""
    : showOtra
      ? VEHICULO_CATALOGO_OTRA
      : matchOption(options, current);

  return (
    <div className="w-[8.25rem] max-w-[8.25rem] min-w-0 space-y-1" title={current || undefined}>
      <div className="flex items-center gap-1">
        <select
          className={`${cellClass} flex-1 ${
            generic || !current ? "border-red-800/70 text-red-300" : ""
          }`}
          value={selected}
          onChange={(e) => {
            const next = e.target.value;
            if (next === VEHICULO_CATALOGO_OTRA) {
              setOtraMode(true);
              onChange("");
              return;
            }
            setOtraMode(false);
            onChange(next);
          }}
          aria-label="Modelo"
        >
          <option value="">Modelo…</option>
          {options.map((modelo) => (
            <option key={modelo} value={modelo}>
              {modelo}
              {isGenericModelo(modelo) ? " (no es modelo)" : ""}
            </option>
          ))}
          <option value={VEHICULO_CATALOGO_OTRA}>Otra…</option>
        </select>
        {current ? (
          <button
            type="button"
            onClick={() => {
              setOtraMode(false);
              onChange("");
            }}
            className="shrink-0 rounded-md border border-slate-700 px-1.5 py-1 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-white"
            title="Borrar modelo"
          >
            ×
          </button>
        ) : null}
      </div>
      {showOtra ? (
        <input
          className={cellClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe el modelo"
        />
      ) : null}
    </div>
  );
}

export function CargaMasivaColorCell({
  value,
  onChange,
  sugerencias = [],
}: {
  value: string;
  onChange: (next: string) => void;
  /** Colores ya extraídos en el lote (NASDAQ SILVER, etc.). */
  sugerencias?: readonly string[];
}) {
  const listId = useId();
  const current = value.trim();
  const options = sugerenciasColorCargaMasiva([...sugerencias, current]);

  return (
    <div
      className="w-[8.5rem] max-w-[8.5rem] min-w-0"
      title={current || undefined}
    >
      <input
        list={listId}
        className={cellClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Color…"
        aria-label="Color"
        autoComplete="off"
        spellCheck={false}
      />
      <datalist id={listId}>
        {options.map((color) => (
          <option key={color} value={color} />
        ))}
      </datalist>
    </div>
  );
}

export function CargaMasivaBulkModelo({
  marcaComun,
  applyCount,
  onApply,
  onClear,
}: {
  marcaComun: string | null;
  applyCount: number;
  onApply: (modelo: string) => void;
  onClear: () => void;
}) {
  const modelos = marcaComun ? modelosDeMarca(marcaComun) : [];
  const [texto, setTexto] = useState("");
  const disabled = applyCount === 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        {marcaComun && modelos.length > 0 ? (
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-slate-400">
            Modelo de {marcaComun}
            <select
              disabled={disabled}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100 outline-none disabled:opacity-50"
              defaultValue=""
              onChange={(e) => {
                const next = e.target.value;
                e.currentTarget.value = "";
                if (next) onApply(next);
              }}
            >
              <option value="">Aplicar modelo del catálogo…</option>
              {modelos.map((modelo) => (
                <option key={modelo} value={modelo}>
                  {modelo}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="flex-1 text-[11px] text-slate-500">
            {marcaComun
              ? `No hay catálogo para ${marcaComun}. Escribe el modelo y aplícalo a las filas.`
              : "Selecciona filas de la misma marca para ver sus modelos, o escribe un nombre y aplícalo."}
          </p>
        )}
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-slate-400">
          Mismo nombre en seleccionadas
          <input
            disabled={disabled}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej. Tiggo 7 Pro Max"
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100 outline-none disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          disabled={disabled || !texto.trim()}
          onClick={() => {
            onApply(texto.trim());
            setTexto("");
          }}
          className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
        >
          Aplicar modelo ({applyCount})
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Borrar modelo ({applyCount})
        </button>
      </div>
    </div>
  );
}
