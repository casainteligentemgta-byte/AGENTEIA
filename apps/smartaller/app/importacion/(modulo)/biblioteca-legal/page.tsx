"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  Scale,
  Shield,
  ShieldAlert,
  ShieldBan,
} from "lucide-react";
import {
  NORMA_PROCESO_LABELS,
  NORMA_TIPO_LABELS,
  countIlicitosCatalogados,
  countLapsosCatalogados,
  listNormasLegales,
  listVigilanciaActiva,
  type NormaLegal,
  type VigilanciaActivaItem,
} from "@/lib/importacion/normas-legales";

const ESTADO_LABEL: Record<NormaLegal["estado"], string> = {
  vigente: "Vigente",
  referencia: "Referencia",
  borrador: "Borrador",
};

const VIGILANCIA_TIPO_LABEL: Record<VigilanciaActivaItem["tipo"], string> = {
  bloqueo: "Bloqueo",
  alerta: "Alerta",
  checklist: "Checklist",
};

type FilterId = "todas" | "lapsos" | "ilicitos" | "vigilancia";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "todas", label: "Catálogo" },
  { id: "lapsos", label: "Lapsos" },
  { id: "ilicitos", label: "Ilícitos" },
  { id: "vigilancia", label: "Vigilancia" },
];

function tieneAlertaLapso(n: NormaLegal): boolean {
  return n.lapsos.some((l) => l.alertaDiasAntes != null || l.alertaCodigo != null);
}

export default function BibliotecaLegalPage() {
  const [filter, setFilter] = useState<FilterId>("todas");
  const normas = listNormasLegales();
  const vigilancia = listVigilanciaActiva();
  const lapsosCount = countLapsosCatalogados();
  const ilicitosCount = countIlicitosCatalogados();

  const visible = useMemo(() => {
    if (filter === "lapsos") return normas.filter((n) => n.lapsos.length > 0);
    if (filter === "ilicitos") return normas.filter((n) => n.ilicitos.length > 0);
    if (filter === "vigilancia") {
      return normas.filter((n) => n.reglaCodigo != null || tieneAlertaLapso(n));
    }
    return normas;
  }, [filter, normas]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24 sm:px-6">
      <div className="flex items-start gap-3">
        <Link
          href="/importacion"
          className="mt-0.5 rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-400/90">
            <Scale className="h-3.5 w-3.5" />
            Cumplimiento
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Biblioteca legal
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Leyes, reglamentos y códigos ligados a los procesos de aduana. La app
            vigila lapsos a vencer e ilícitos posibles en cada procedimiento.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
          <p className="text-lg font-semibold text-white">{normas.length}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Normas</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-center">
          <p className="text-lg font-semibold text-amber-200">{lapsosCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-amber-200/60">Lapsos</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-3 text-center">
          <p className="text-lg font-semibold text-rose-200">{ilicitosCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-rose-200/60">Ilícitos</p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Filtrar biblioteca"
        className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                active
                  ? "bg-sky-500/20 text-sky-100"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
        <p className="flex items-start gap-2">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>
            <strong className="font-medium text-amber-50">Garante y vigilante:</strong>{" "}
            cada norma con «control automático» o alerta de lapso se evalúa al
            registrar/editar expedientes y en el cron de vencimientos (nacionalización
            90 días, seguro 30 días, cupo persona natural).
          </span>
        </p>
      </div>

      {filter === "vigilancia" && (
        <ul className="space-y-2">
          {vigilancia.map((v) => (
            <li
              key={v.id}
              className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-emerald-50">{v.titulo}</p>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    {VIGILANCIA_TIPO_LABEL[v.tipo]}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {v.normaCodigo}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{v.descripcion}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ul className="space-y-4">
        {visible.map((n) => (
          <li
            key={n.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] text-sky-400/80">{n.codigo}</p>
                <h2 className="mt-0.5 text-base font-semibold text-white">{n.titulo}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {NORMA_TIPO_LABELS[n.tipo]} · {NORMA_PROCESO_LABELS[n.proceso]}
                  {n.organismo ? ` · ${n.organismo}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  {ESTADO_LABEL[n.estado]}
                </span>
                {n.reglaCodigo && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    <Shield className="h-3 w-3" />
                    Control automático
                  </span>
                )}
                {tieneAlertaLapso(n) && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                    <Bell className="h-3 w-3" />
                    Alerta de lapso
                  </span>
                )}
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-300">{n.resumen}</p>

            {n.lapsos.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200/80">
                  <Clock className="h-3.5 w-3.5" />
                  Lapsos a vigilar
                </p>
                <ul className="space-y-2">
                  {n.lapsos.map((l) => (
                    <li
                      key={`${n.id}-${l.nombre}`}
                      className="rounded-lg border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-amber-50">{l.nombre}</p>
                        <p className="font-mono text-xs text-amber-200/90">
                          {l.duracion}
                          {l.alertaDiasAntes != null
                            ? ` · avisa a ${l.alertaDiasAntes}d`
                            : ""}
                        </p>
                      </div>
                      {l.alertaCodigo && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          Código de alerta:{" "}
                          <span className="font-mono text-slate-300">
                            {l.alertaCodigo}
                          </span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {n.ilicitos.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-200/80">
                  <ShieldBan className="h-3.5 w-3.5" />
                  Ilícitos / riesgos a prevenir
                </p>
                <ul className="space-y-2">
                  {n.ilicitos.map((i) => (
                    <li
                      key={i.codigo}
                      className="rounded-lg border border-rose-500/15 bg-rose-500/[0.06] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-[10px] text-rose-300/80">
                          {i.codigo}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-rose-50">{i.descripcion}</p>
                      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-emerald-300/90">
                        <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          <span className="font-medium text-emerald-200">
                            Qué vigila la app:{" "}
                          </span>
                          {i.vigilancia}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {n.obliga && (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
                <p className="text-xs font-medium text-slate-400">En el sistema</p>
                <p className="mt-1 text-sm text-slate-200">{n.obliga}</p>
              </div>
            )}

            {n.etiquetas.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {n.etiquetas.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {visible.length === 0 && filter !== "vigilancia" && (
        <p className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-500">
          No hay normas en este filtro.
        </p>
      )}

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
        Catálogo de referencia operativa (no sustituye asesoría legal ni el texto
        oficial). Se ampliará con más resoluciones y comunicados SENIAT.
      </p>

      <p className="flex items-center gap-1.5 text-[10px] text-slate-600">
        <BookOpen className="h-3 w-3" />
        Ampliar con Gaceta Oficial / resoluciones SENIAT cuando haya texto
        verificable.
      </p>
    </div>
  );
}
