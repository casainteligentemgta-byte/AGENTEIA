"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Copy,
  Presentation,
  Printer,
  RotateCcw,
} from "lucide-react";
import {
  DEMO_AVISOS_LABELS,
  DEMO_AGENTE_LABELS,
  DEMO_AISLAMIENTO_LABELS,
  DEMO_CARGA_LABELS,
  DEMO_CUESTIONARIO_STORAGE_KEY,
  DEMO_GUION,
  DEMO_LLEGADA_LABELS,
  DEMO_NO_HACER,
  DEMO_PDF_LABELS,
  DEMO_PLACA_LABELS,
  DEMO_PREP,
  DEMO_ROL_LABELS,
  DEMO_UNIDADES,
  DEMO_VOLUMEN_LABELS,
  EMPTY_DEMO_CUESTIONARIO,
  buildMapaDeseos,
  parseDemoCuestionario,
  type DemoCuestionario,
} from "@/lib/importacion/demo-cliente";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";
import { REGIMEN_IMPORTACION_LABELS, REGIMENES_IMPORTACION } from "@/lib/importacion/regimenes";

type DemoTab = "guion" | "cuestionario" | "mapa";

const TABS: { id: DemoTab; label: string }[] = [
  { id: "guion", label: "Guion" },
  { id: "cuestionario", label: "Cuestionario" },
  { id: "mapa", label: "Mapa" },
];

function loadStored(): {
  form: DemoCuestionario;
  checks: Record<string, boolean>;
} {
  if (typeof window === "undefined") {
    return { form: EMPTY_DEMO_CUESTIONARIO, checks: {} };
  }
  try {
    const raw = window.localStorage.getItem(DEMO_CUESTIONARIO_STORAGE_KEY);
    if (!raw) return { form: EMPTY_DEMO_CUESTIONARIO, checks: {} };
    const parsed = JSON.parse(raw) as { form?: unknown; checks?: unknown };
    const checks =
      parsed.checks && typeof parsed.checks === "object"
        ? (parsed.checks as Record<string, boolean>)
        : {};
    return { form: parseDemoCuestionario(parsed.form), checks };
  } catch {
    return { form: EMPTY_DEMO_CUESTIONARIO, checks: {} };
  }
}

function FieldsetRadios<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: keyof DemoCuestionario;
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-zinc-200">{legend}</legend>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => {
          const id = `${String(name)}-${opt.value}`;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-0.5 text-sm text-zinc-300 hover:bg-zinc-900/60"
            >
              <input
                id={id}
                type="radio"
                name={String(name)}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-cyan-500"
              />
              <span className="leading-relaxed">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SmartImportDemoCliente() {
  const [form, setForm] = useState<DemoCuestionario>(EMPTY_DEMO_CUESTIONARIO);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<DemoTab>("guion");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = loadStored();
    setForm(stored.form);
    setChecks(stored.checks);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      DEMO_CUESTIONARIO_STORAGE_KEY,
      JSON.stringify({ form, checks })
    );
  }, [form, checks, hydrated]);

  const mapa = useMemo(() => buildMapaDeseos(form), [form]);

  const patch = useCallback((partial: Partial<DemoCuestionario>) => {
    setForm((prev) => parseDemoCuestionario({ ...prev, ...partial }));
  }, []);

  const toggleCheck = useCallback((id: string) => {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const resetSesion = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("¿Borrar el guion marcado y el cuestionario de esta sesión?")
    ) {
      return;
    }
    window.localStorage.removeItem(DEMO_CUESTIONARIO_STORAGE_KEY);
    setForm(EMPTY_DEMO_CUESTIONARIO);
    setChecks({});
    setCopied(false);
  }, []);

  const copyMapa = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mapa);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [mapa]);

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(mapa)}`;

  return (
    <main className="smartimport-typography min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 pb-16 pt-4 sm:px-6 print:bg-white print:px-0 print:text-black">
      <div className="mx-auto max-w-2xl">
        <Link
          href={IMPORTACION_BASE}
          className="mb-3 inline-flex rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 print:hidden"
          aria-label="Volver al dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <header className="mb-5 space-y-2 print:mb-3">
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-cyan-400/90 print:text-zinc-600">
            <Presentation className="h-3.5 w-3.5" />
            Demo a cliente
          </p>
          <h1 className="smartimport-page-title text-zinc-50 print:text-zinc-900">
            SmartImport — 60 minutos
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400 print:text-zinc-600">
            Tres escenas (extraer, cola, PDF SENIAT) y un cuestionario que
            cierra en un mapa de deseos para mandar al día siguiente.
          </p>
        </header>

        <div
          role="tablist"
          aria-label="Secciones del demo"
          className="mb-5 grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1 print:hidden"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={
                tab === item.id
                  ? "rounded-lg bg-cyan-600 px-2 py-2 text-xs font-semibold text-white"
                  : "rounded-lg px-2 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-100"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "guion" ? (
          <div className="space-y-5 print:hidden">
            <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Preparación
              </h2>
              <ul className="mt-3 space-y-2">
                {DEMO_PREP.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={Boolean(checks[item.id])}
                        onChange={() => toggleCheck(item.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-cyan-500"
                      />
                      <span className="leading-relaxed">{item.texto}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Lote de 3 unidades
              </h2>
              <ul className="space-y-3">
                {DEMO_UNIDADES.map((unidad) => (
                  <li
                    key={unidad.id}
                    className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4"
                  >
                    <p className="font-medium text-zinc-50">{unidad.titulo}</p>
                    <p className="mt-1 text-sm text-zinc-400">{unidad.estado}</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                      {unidad.paraQue}
                    </p>
                    <Link
                      href={unidad.href}
                      className="mt-2 inline-flex text-sm font-medium text-cyan-400 hover:text-cyan-300"
                    >
                      {unidad.cta} →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Guion
              </h2>
              <ol className="space-y-3">
                {DEMO_GUION.map((paso) => (
                  <li
                    key={paso.id}
                    className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4"
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(checks[paso.id])}
                        onChange={() => toggleCheck(paso.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-cyan-500"
                      />
                      <span>
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-xs text-cyan-400">
                            {paso.minutos}
                          </span>
                          <span className="font-medium text-zinc-50">
                            {paso.titulo}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm leading-relaxed text-zinc-400">
                          {paso.detalle}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <h2 className="text-sm font-semibold text-amber-200">Qué no hacer</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-zinc-400">
                {DEMO_NO_HACER.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {tab === "cuestionario" ? (
          <form
            className="space-y-6 print:hidden"
            onSubmit={(event) => {
              event.preventDefault();
              setTab("mapa");
            }}
          >
            <section className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Sesión
              </h2>
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Nombre del cliente</span>
                <input
                  value={form.clienteNombre}
                  onChange={(e) => patch({ clienteNombre: e.target.value })}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
                  autoComplete="organization"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Fecha</span>
                <input
                  type="date"
                  value={form.fechaIso}
                  onChange={(e) => patch({ fechaIso: e.target.value })}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
                />
              </label>
            </section>

            <section className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                1. Quién usa y con qué volumen
              </h2>
              <FieldsetRadios
                legend="¿Qué son?"
                name="rol"
                value={form.rol}
                onChange={(rol) => patch({ rol })}
                options={(Object.keys(DEMO_ROL_LABELS) as Array<
                  keyof typeof DEMO_ROL_LABELS
                >).map((value) => ({
                  value,
                  label: DEMO_ROL_LABELS[value],
                }))}
              />
              {form.rol === "otro" ? (
                <label className="block space-y-1 text-sm">
                  <span className="text-zinc-400">¿Cuál?</span>
                  <input
                    value={form.rolOtro}
                    onChange={(e) => patch({ rolOtro: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
                  />
                </label>
              ) : null}
              <FieldsetRadios
                legend="¿Cuántas personas tocarían el sistema?"
                name="personas"
                value={form.personas}
                onChange={(personas) => patch({ personas })}
                options={[
                  { value: "1", label: "1" },
                  { value: "2-5", label: "2–5" },
                  { value: "6+", label: "6 o más" },
                ]}
              />
              <FieldsetRadios
                legend="Unidades al mes"
                name="volumen"
                value={form.volumen}
                onChange={(volumen) => patch({ volumen })}
                options={(Object.keys(DEMO_VOLUMEN_LABELS) as Array<
                  keyof typeof DEMO_VOLUMEN_LABELS
                >).map((value) => ({
                  value,
                  label: DEMO_VOLUMEN_LABELS[value],
                }))}
              />
              <FieldsetRadios
                legend="¿Llegan por BL / contenedor o de a una?"
                name="llegada"
                value={form.llegada}
                onChange={(llegada) => patch({ llegada })}
                options={(Object.keys(DEMO_LLEGADA_LABELS) as Array<
                  keyof typeof DEMO_LLEGADA_LABELS
                >).map((value) => ({
                  value,
                  label: DEMO_LLEGADA_LABELS[value],
                }))}
              />
            </section>

            <section className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                2. Papeles y trámites
              </h2>
              <p className="text-sm leading-relaxed text-zinc-500">
                Flujo hoy: Registro → Embarque → Llegada → Desaduanamiento SENIAT
                → Propietario → Seguro → Matrícula → Nacionalizar (M2/M3).
              </p>
              <FieldsetRadios
                legend="Régimen que usan de verdad"
                name="regimen"
                value={form.regimen}
                onChange={(regimen) => patch({ regimen })}
                options={REGIMENES_IMPORTACION.map((value) => ({
                  value,
                  label: REGIMEN_IMPORTACION_LABELS[value],
                }))}
              />
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">
                  Tres documentos que siempre retrasan
                </span>
                <textarea
                  value={form.docsRetraso}
                  onChange={(e) => patch({ docsRetraso: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
                />
              </label>
              <FieldsetRadios
                legend="¿El PDF SENIAT cubre lo que consignan?"
                name="pdfSeniat"
                value={form.pdfSeniat}
                onChange={(pdfSeniat) => patch({ pdfSeniat })}
                options={(Object.keys(DEMO_PDF_LABELS) as Array<
                  keyof typeof DEMO_PDF_LABELS
                >).map((value) => ({
                  value,
                  label: DEMO_PDF_LABELS[value],
                }))}
              />
              {form.pdfSeniat === "falta" ? (
                <label className="block space-y-1 text-sm">
                  <span className="text-zinc-400">¿Qué falta?</span>
                  <input
                    value={form.pdfSeniatFalta}
                    onChange={(e) => patch({ pdfSeniatFalta: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
                  />
                </label>
              ) : null}
              <FieldsetRadios
                legend="Placa y título"
                name="placaQuien"
                value={form.placaQuien}
                onChange={(placaQuien) => patch({ placaQuien })}
                options={(Object.keys(DEMO_PLACA_LABELS) as Array<
                  keyof typeof DEMO_PLACA_LABELS
                >).map((value) => ({
                  value,
                  label: DEMO_PLACA_LABELS[value],
                }))}
              />
              <FieldsetRadios
                legend="¿Sticker NFC / enlace público?"
                name="nfc"
                value={form.nfc}
                onChange={(nfc) => patch({ nfc })}
                options={[
                  { value: "si", label: "Sí, lo quieren" },
                  { value: "no", label: "No, es ruido" },
                  { value: "despues", label: "Después" },
                ]}
              />
            </section>

            <section className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                3. Cómo quieren trabajar
              </h2>
              <FieldsetRadios
                legend="¿Carga masiva o alta una a una?"
                name="carga"
                value={form.carga}
                onChange={(carga) => patch({ carga })}
                options={(Object.keys(DEMO_CARGA_LABELS) as Array<
                  keyof typeof DEMO_CARGA_LABELS
                >).map((value) => ({
                  value,
                  label: DEMO_CARGA_LABELS[value],
                }))}
              />
              <FieldsetRadios
                legend="Avisos"
                name="avisos"
                value={form.avisos}
                onChange={(avisos) => patch({ avisos })}
                options={(Object.keys(DEMO_AVISOS_LABELS) as Array<
                  keyof typeof DEMO_AVISOS_LABELS
                >).map((value) => ({
                  value,
                  label: DEMO_AVISOS_LABELS[value],
                }))}
              />
              <FieldsetRadios
                legend="Agente aduanal"
                name="agenteAduanal"
                value={form.agenteAduanal}
                onChange={(agenteAduanal) => patch({ agenteAduanal })}
                options={(Object.keys(DEMO_AGENTE_LABELS) as Array<
                  keyof typeof DEMO_AGENTE_LABELS
                >).map((value) => ({
                  value,
                  label: DEMO_AGENTE_LABELS[value],
                }))}
              />
              <FieldsetRadios
                legend="Datos sensibles"
                name="aislamiento"
                value={form.aislamiento}
                onChange={(aislamiento) => patch({ aislamiento })}
                options={(Object.keys(DEMO_AISLAMIENTO_LABELS) as Array<
                  keyof typeof DEMO_AISLAMIENTO_LABELS
                >).map((value) => ({
                  value,
                  label: DEMO_AISLAMIENTO_LABELS[value],
                }))}
              />
              <FieldsetRadios
                legend="¿Piloto de un BL real la próxima semana?"
                name="piloto"
                value={form.piloto}
                onChange={(piloto) => patch({ piloto })}
                options={[
                  { value: "si", label: "Sí" },
                  { value: "no", label: "No" },
                ]}
              />
              {form.piloto === "si" ? (
                <label className="block space-y-1 text-sm">
                  <span className="text-zinc-400">Fecha del piloto</span>
                  <input
                    value={form.pilotoFecha}
                    onChange={(e) => patch({ pilotoFecha: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
                    placeholder="ej. jueves 10"
                  />
                </label>
              ) : null}
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Lo que más faltó hoy</span>
                <textarea
                  value={form.faltante}
                  onChange={(e) => patch({ faltante: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Lo que ya les sirve</span>
                <textarea
                  value={form.sirveHoy}
                  onChange={(e) => patch({ sirveHoy: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Lo que piden para el piloto</span>
                <textarea
                  value={form.pidePiloto}
                  onChange={(e) => patch({ pidePiloto: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Lo que queda fuera (v2)</span>
                <textarea
                  value={form.quedaFuera}
                  onChange={(e) => patch({ quedaFuera: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
                />
              </label>
            </section>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              <ClipboardList className="h-4 w-4" />
              Ver mapa de deseos
            </button>
          </form>
        ) : null}

        {tab === "mapa" ? (
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                onClick={copyMapa}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100 hover:border-cyan-500/40"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 text-cyan-400" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100 hover:border-cyan-500/40"
              >
                <Printer className="h-4 w-4 text-cyan-400" />
                Imprimir
              </button>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100 hover:border-cyan-500/40"
              >
                WhatsApp
              </a>
            </div>
            <pre className="whitespace-pre-wrap rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4 text-sm leading-relaxed text-zinc-200 print:border-zinc-300 print:bg-white print:text-zinc-900">
              {mapa}
            </pre>
          </section>
        ) : null}

        <div className="mt-8 flex justify-end print:hidden">
          <button
            type="button"
            onClick={resetSesion}
            className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Nueva sesión
          </button>
        </div>
      </div>
    </main>
  );
}
