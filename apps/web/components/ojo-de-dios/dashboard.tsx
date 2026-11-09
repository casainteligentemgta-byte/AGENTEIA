"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CloudSun,
  Film,
  HeartPulse,
  Loader2,
  Mail,
  Newspaper,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import type { Mission } from "@/app/actions/missions";
import { AgendaCard } from "./agenda-card";
import { OjoShell } from "./shell";
import { SourceCard } from "./source-card";
import type { OjoDeDiosSnapshot, ProviderMeta } from "@/lib/ojo-de-dios/types";

function formatWhen(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const STRAVA_META: ProviderMeta = {
  id: "strava",
  label: "Strava",
  status: "needsAuth",
  fetchedAt: null,
  sourceName: "Strava",
  sourceUrl: "https://www.strava.com/",
  message: "No conectado",
};

export function OjoDeDiosDashboard({
  initial,
  initialMissions,
  missionsError,
}: {
  initial: OjoDeDiosSnapshot;
  initialMissions: Mission[];
  missionsError: string | null;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/ojo-de-dios/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setRefreshError(body?.error ?? "No se pudo actualizar.");
        return;
      }
      const next = (await res.json()) as OjoDeDiosSnapshot;
      setSnapshot(next);
    } catch {
      setRefreshError("No se pudo actualizar.");
    } finally {
      setRefreshing(false);
    }
  };

  const xMeta: ProviderMeta =
    snapshot.x.status === "hidden"
      ? { ...snapshot.x, status: "needsAuth", message: "No conectado" }
      : snapshot.x;

  return (
    <OjoShell>
      <main id="contenido" className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 md:mb-8">
          <div>
            <Link
              href="/agente"
              className="mb-3 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al panel
            </Link>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
              Personal
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Ojo de Dios
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/55">
              Panel privado. Las fuentes sin credenciales se muestran como no conectadas; no se
              inventan datos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Actualizar
            </button>
          </div>
        </header>

        {refreshError ? (
          <p
            role="status"
            aria-live="polite"
            className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
          >
            {refreshError}
          </p>
        ) : null}

        <div
          className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12 xl:gap-6"
          aria-busy={refreshing}
        >
          <div className="xl:col-span-4">
            <SourceCard meta={snapshot.weather} id="clima">
              {snapshot.weather.cities.length === 0 ? (
                <EmptyState icon={CloudSun} text={snapshot.weather.message ?? "Sin clima."} />
              ) : (
                <ul className="space-y-3">
                  {snapshot.weather.cities.map((city) => (
                    <li
                      key={city.cityId}
                      className="flex items-end justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{city.cityName}</p>
                        <p className="text-sm text-white/50">{city.weatherLabel}</p>
                      </div>
                      <p className="text-3xl font-semibold tabular-nums tracking-tight text-white">
                        {city.temperatureC}°
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {snapshot.weather.cities.length > 0 && snapshot.weather.message ? (
                <p className="mt-3 text-xs text-amber-200/90">{snapshot.weather.message}</p>
              ) : null}
            </SourceCard>
          </div>

          <div className="xl:col-span-8">
            <AgendaCard initialMissions={initialMissions} missionsError={missionsError} />
          </div>

          <div className="flex flex-col gap-5 xl:col-span-5" id="salud">
            <SourceCard meta={snapshot.garmin}>
              {snapshot.garmin.status !== "ok" ? (
                <EmptyState
                  icon={HeartPulse}
                  text={snapshot.garmin.message ?? "No conectado"}
                />
              ) : (
                <dl className="grid grid-cols-2 gap-3">
                  <Metric label="Pasos" value={snapshot.garmin.steps} />
                  <Metric
                    label="FC en reposo"
                    value={snapshot.garmin.restingHeartRate}
                    suffix=" lpm"
                  />
                  <Metric label="Sueño" value={snapshot.garmin.sleepScore} />
                  <Metric label="Body Battery" value={snapshot.garmin.bodyBattery} />
                </dl>
              )}
            </SourceCard>
            <SourceCard meta={STRAVA_META}>
              <EmptyState icon={Activity} text={STRAVA_META.message ?? "No conectado"} />
            </SourceCard>
          </div>

          <div className="xl:col-span-7">
            <SourceCard meta={snapshot.news} id="titulares">
              {snapshot.news.feeds.length === 0 ? (
                <EmptyState icon={Newspaper} text={snapshot.news.message ?? "Sin titulares."} />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  {snapshot.news.feeds.map((feed) => (
                    <div key={feed.id}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300/80">
                        {feed.label}
                      </h3>
                      {feed.items.length === 0 ? (
                        <p className="text-sm text-white/50">{feed.message ?? "Sin titulares."}</p>
                      ) : (
                        <ul className="space-y-2.5">
                          {feed.items.map((item) => (
                            <li key={item.url}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="block text-sm text-white hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                              >
                                {item.title}
                              </a>
                              <p className="text-[11px] text-white/45">
                                {[item.publisher, formatWhen(item.publishedAt)]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SourceCard>
          </div>

          <div className="xl:col-span-6">
            <SourceCard meta={snapshot.gmail} id="correo">
              {snapshot.gmail.status !== "ok" ? (
                <EmptyState icon={Mail} text={snapshot.gmail.message ?? "No conectado"} />
              ) : snapshot.gmail.items.length === 0 ? (
                <p className="text-sm text-white/55">
                  {snapshot.gmail.message ?? "No hay correos importantes sin leer."}
                </p>
              ) : (
                <ul className="space-y-3">
                  {snapshot.gmail.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/25 p-3"
                    >
                      <p className="text-sm font-medium text-white">{item.subject}</p>
                      <p className="mt-0.5 text-xs text-white/50">{item.from}</p>
                      {item.snippet ? (
                        <p className="mt-1 line-clamp-2 text-xs text-white/45">{item.snippet}</p>
                      ) : null}
                      {formatWhen(item.receivedAt) ? (
                        <p className="mt-1 text-[11px] text-white/35">
                          {formatWhen(item.receivedAt)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SourceCard>
          </div>

          <div className="xl:col-span-3">
            <SourceCard meta={xMeta} id="tendencias">
              {snapshot.x.status !== "ok" || snapshot.x.trends.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  text={
                    snapshot.x.status === "ok"
                      ? snapshot.x.message ?? "Sin tendencias."
                      : xMeta.message ?? "No conectado"
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {snapshot.x.trends.map((trend) => (
                    <li key={trend.name} className="text-sm text-white">
                      {trend.url ? (
                        <a
                          href={trend.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                        >
                          {trend.name}
                        </a>
                      ) : (
                        trend.name
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SourceCard>
          </div>

          <div className="xl:col-span-3">
            <SourceCard meta={snapshot.cinema} id="cine">
              <p className="mb-3 text-sm text-white/55">{snapshot.cinema.venue}</p>
              {snapshot.cinema.movies.length === 0 ? (
                <EmptyState
                  icon={Film}
                  text={snapshot.cinema.message ?? "Cartelera no disponible."}
                />
              ) : (
                <ul className="space-y-3">
                  {snapshot.cinema.movies.map((movie) => (
                    <li key={movie.title}>
                      <p className="text-sm font-medium text-white">{movie.title}</p>
                      <p className="text-xs text-white/50">{movie.times.join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SourceCard>
          </div>
        </div>
      </main>
    </OjoShell>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: typeof CloudSun;
  text: string;
}) {
  return (
    <div className="flex h-full min-h-[88px] flex-col items-start justify-center gap-2 text-sm text-white/55">
      <Icon className="h-5 w-5 text-cyan-300/70" />
      <p>{text}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number | null;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
      <dt className="text-[11px] uppercase tracking-wide text-white/45">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-white">
        {value == null ? "—" : `${value}${suffix}`}
      </dd>
    </div>
  );
}
