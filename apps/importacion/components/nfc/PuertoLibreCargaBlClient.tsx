"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ship, UserRound } from "lucide-react";
import { BuqueTrackingChip } from "@/components/nfc/BuqueTrackingChip";
import {
  assignNumeroBlAction,
  saveCargaBlDatosAction,
  type CargaBlIndexItem,
  type CargaBlLote,
} from "@/app/actions/nfc/importacion-lote";
import { formatUsd } from "@/lib/importacion/precalculo-aranceles";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";
import { ADUANAS_VENEZUELA } from "@/lib/importacion/aduanas-venezuela";
import {
  DOCUMENTO_TIPOS_CARGA_BL,
  cargaBlPath,
} from "@/lib/importacion/expediente-lote";
import {
  PUERTOS_DESCARGA_VENEZUELA,
  parsePuertosDescarga,
  primaryPuertoDescarga,
  resolvePuertoDescarga,
} from "@/lib/importacion/puertos-venezuela";
import { hrefAfterGuardarDatosBl } from "@/lib/importacion/paths";

const INPUT_CLASS =
  "box-border w-full max-w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60";

export function PuertoLibreCargaBlLoteView({ lote }: { lote: CargaBlLote }) {
  const router = useRouter();
  const [fechaIngreso, setFechaIngreso] = useState(lote.fechaIngreso);
  const [fechaLlegadaBuque, setFechaLlegadaBuque] = useState(
    lote.fechaLlegadaBuque
  );
  const [puerto, setPuerto] = useState(lote.puerto);
  const [aduana, setAduana] = useState(lote.aduana);
  const [agenteAduanal, setAgenteAduanal] = useState(lote.agenteAduanal);
  const [numeroBl, setNumeroBl] = useState(lote.numeroBl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const extraPuertos = parsePuertosDescarga(puerto).filter(
    (p) =>
      !PUERTOS_DESCARGA_VENEZUELA.includes(
        p as (typeof PUERTOS_DESCARGA_VENEZUELA)[number]
      )
  );

  function saveDatos() {
    setError(null);
    startTransition(async () => {
      const result = await saveCargaBlDatosAction({
        sourceVehiculoId: lote.sourceVehiculoId,
        numeroBl,
        fechaIngreso,
        fechaLlegadaBuque,
        puerto,
        aduana,
        agenteAduanal,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(hrefAfterGuardarDatosBl());
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href="/smartimport"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Expedientes
        </Link>
        <div>
          <p className="text-xs uppercase tracking-wide text-cyan-400/80">
            Embarque
          </p>
          <label className="mt-1 block space-y-1.5">
            <span className="text-sm text-slate-400">Nº BL / Guía</span>
            <input
              value={numeroBl}
              onChange={(e) => setNumeroBl(e.target.value.toUpperCase())}
              placeholder="Nº de BL"
              aria-label="Número de BL"
              className="box-border w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-2xl font-semibold uppercase text-slate-50 outline-none focus:border-cyan-500/60"
            />
          </label>
          <p className="mt-1 text-sm text-slate-400">
            {lote.unidades.length} expediente
            {lote.unidades.length === 1 ? "" : "s"}
            {lote.importadorNombre ? ` · ${lote.importadorNombre}` : ""}
            . Los papeles se cargan en cada expediente.
          </p>
          <BuqueTrackingChip
            numeroBl={numeroBl}
            fechaLlegadaBuque={fechaLlegadaBuque}
          />
        </div>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Ship className="h-5 w-5 text-cyan-400" />
          Datos de embarque
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Nº de BL, llegada del buque, ingreso al PL y agente. Se escriben en
          todos los expedientes de esta carga.
        </p>
        {lote.importadorNombre ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <UserRound className="h-4 w-4 text-cyan-400" />
            Importador: {lote.importadorNombre}
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block min-w-0 space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Nº BL / Guía *</span>
            <input
              value={numeroBl}
              onChange={(e) => setNumeroBl(e.target.value.toUpperCase())}
              placeholder="Nº de BL"
              required
              className={`${INPUT_CLASS} font-mono uppercase`}
            />
          </label>
          <PlanillaFechaField
            label="Fecha de llegada del buque"
            name="fechaLlegadaBuque"
            value={fechaLlegadaBuque}
            onChange={setFechaLlegadaBuque}
          />
          <PlanillaFechaField
            label="Fecha de ingreso al PL"
            name="fechaIngreso"
            value={fechaIngreso}
            onChange={setFechaIngreso}
          />
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm text-slate-400">Puerto de descarga</span>
            <select
              value={primaryPuertoDescarga(puerto)}
              onChange={(e) => setPuerto(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Selecciona puerto</option>
              {PUERTOS_DESCARGA_VENEZUELA.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              {extraPuertos.map((p) => (
                <option key={p} value={p}>
                  {resolvePuertoDescarga(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm text-slate-400">Aduana</span>
            <select
              value={aduana}
              onChange={(e) => setAduana(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Selecciona aduana</option>
              {ADUANAS_VENEZUELA.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">
              Nombre del agente aduanal
            </span>
            <input
              value={agenteAduanal}
              onChange={(e) => setAgenteAduanal(e.target.value)}
              placeholder="Como figura en la constancia"
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={saveDatos}
          disabled={pending || !numeroBl.trim()}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar datos en el BL"}
        </button>
        {error ? (
          <p className="mt-3 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-200">
          Expedientes de este BL
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Cada uno guarda su partida, memoria descriptiva y cuestionario.
        </p>
        <ul className="mt-3 space-y-1.5 font-mono text-sm">
          {lote.unidades.map((u) => (
            <li key={u.id}>
              <Link
                href={`/smartimport/${u.id}`}
                className="text-cyan-300 hover:text-cyan-200"
              >
                {u.codigoExpediente}
                {u.vin ? ` · ${u.vin}` : ""}
                {u.marca || u.modelo
                  ? ` · ${[u.marca, u.modelo].filter(Boolean).join(" ")}`
                  : ""}
                {u.valorCif != null ? ` · CIF ${formatUsd(u.valorCif)}` : ""}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function PuertoLibreCargaBlAssign({
  vehiculoId,
  codigoExpediente,
  vin,
}: {
  vehiculoId: string;
  codigoExpediente: string;
  vin: string | null;
}) {
  const router = useRouter();
  const [numeroBl, setNumeroBl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function assign() {
    setError(null);
    startTransition(async () => {
      const result = await assignNumeroBlAction({
        vehiculoId,
        numeroBl,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.replace(cargaBlPath(result.numeroBl));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/smartimport"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Expedientes
      </Link>
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h1 className="text-xl font-semibold text-slate-50">
          Asignar BL a la carga
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {codigoExpediente}
          {vin ? ` · ${vin}` : ""}. Sin nº de BL no se puede anexar a un grupo.
          Si el BL ya tiene papeles, este expediente los hereda.
        </p>
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm text-slate-400">Nº BL / Guía</span>
          <input
            value={numeroBl}
            onChange={(e) => setNumeroBl(e.target.value.toUpperCase())}
            placeholder="COSU1234567"
            className="box-border w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm uppercase text-slate-100 outline-none focus:border-cyan-500/60"
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-red-300">{error}</p>
        ) : null}
        <button
          type="button"
          onClick={assign}
          disabled={pending || !numeroBl.trim()}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {pending ? "Asignando…" : "Continuar"}
        </button>
      </section>
    </div>
  );
}

export function PuertoLibreCargaBlIndex({ lotes }: { lotes: CargaBlIndexItem[] }) {
  return (
    <div className="space-y-6">
      <Link
        href="/smartimport"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Expedientes
      </Link>
      <header>
        <p className="text-xs uppercase tracking-wide text-cyan-400/80">
          Documentos de la carga
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-50">Por BL</h1>
        <p className="mt-1 text-sm text-slate-400">
          Carga una vez. Se anexa a cada expediente de ese BL.
        </p>
      </header>
      {lotes.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-sm text-slate-400">
          Aún no hay expedientes con nº de BL. Regístralos en Extraer o asigna el
          BL desde Embarque.
        </p>
      ) : (
        <ul className="space-y-2">
          {lotes.map((lote) => (
            <li
              key={lote.blKey}
              className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 hover:border-cyan-500/40"
            >
              <Link
                href={cargaBlPath(lote.blKey)}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-slate-100">
                    BL {lote.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lote.unidades} expediente{lote.unidades === 1 ? "" : "s"}
                    {lote.fechaIngreso ? ` · ingreso ${lote.fechaIngreso}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  {lote.docsCargados}/{DOCUMENTO_TIPOS_CARGA_BL.length}
                </span>
              </Link>
              <BuqueTrackingChip
                numeroBl={lote.label}
                fechaLlegadaBuque={lote.fechaLlegadaBuque}
                compact
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
