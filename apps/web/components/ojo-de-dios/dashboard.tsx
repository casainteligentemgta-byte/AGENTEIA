"use client";

import { useState } from "react";
import Link from "next/link";
import {
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
import { SourceCard } from "./source-card";
import type { OjoDeDiosSnapshot } from "@/lib/ojo-de-dios/types";

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

export function OjoDeDiosDashboard({ initial }: { initial: OjoDeDiosSnapshot }) {
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

  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/agente"
              className="mb-3 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al panel
            </Link>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Personal
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
              Ojo de Dios
            </h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Panel privado de clima, titulares, salud y cartelera. Las fuentes sin
              credenciales aparecen como no conectadas; nunca se inventan datos.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Actualizar
          </button>
        </header>

        {refreshError ? (
          <p className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
            {refreshError}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <SourceCard meta={snapshot.weather}>
            {snapshot.weather.cities.length === 0 ? (
              <EmptyState icon={CloudSun} text={snapshot.weather.message ?? "Sin clima."} />
            ) : (
              <ul className="space-y-3">
                {snapshot.weather.cities.map((city) => (
                  <li
                    key={city.cityId}
                    className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{city.cityName}</p>
                      <p className="text-xs text-zinc-500">{city.weatherLabel}</p>
                    </div>
                    <p className="text-lg font-semibold tabular-nums text-zinc-50">
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

          <SourceCard meta={snapshot.news}>
            {snapshot.news.feeds.length === 0 ? (
              <EmptyState icon={Newspaper} text={snapshot.news.message ?? "Sin titulares."} />
            ) : (
              <div className="space-y-4">
                {snapshot.news.feeds.map((feed) => (
                  <div key={feed.id}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                      {feed.label}
                    </h3>
                    {feed.items.length === 0 ? (
                      <p className="text-xs text-zinc-500">{feed.message ?? "Sin titulares."}</p>
                    ) : (
                      <ul className="space-y-2">
                        {feed.items.map((item) => (
                          <li key={item.url}>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="block text-sm text-zinc-200 hover:text-blue-300"
                            >
                              {item.title}
                            </a>
                            <p className="text-[11px] text-zinc-500">
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

          {snapshot.x.status !== "hidden" ? (
            <SourceCard meta={snapshot.x}>
              {snapshot.x.trends.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  text={snapshot.x.message ?? "Sin tendencias."}
                />
              ) : (
                <ul className="space-y-2">
                  {snapshot.x.trends.map((trend) => (
                    <li key={trend.name} className="text-sm text-zinc-200">
                      {trend.url ? (
                        <a
                          href={trend.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="hover:text-blue-300"
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
          ) : null}

          <SourceCard meta={snapshot.garmin}>
            {snapshot.garmin.status !== "ok" ? (
              <EmptyState
                icon={HeartPulse}
                text={snapshot.garmin.message ?? "No conectado"}
              />
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
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

          <SourceCard meta={snapshot.gmail}>
            {snapshot.gmail.status !== "ok" ? (
              <EmptyState icon={Mail} text={snapshot.gmail.message ?? "No conectado"} />
            ) : snapshot.gmail.items.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {snapshot.gmail.message ?? "No hay correos importantes sin leer."}
              </p>
            ) : (
              <ul className="space-y-3">
                {snapshot.gmail.items.map((item) => (
                  <li key={item.id} className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
                    <p className="text-sm font-medium text-zinc-100">{item.subject}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{item.from}</p>
                    {item.snippet ? (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{item.snippet}</p>
                    ) : null}
                    {formatWhen(item.receivedAt) ? (
                      <p className="mt-1 text-[11px] text-zinc-600">{formatWhen(item.receivedAt)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SourceCard>

          <SourceCard meta={snapshot.cinema}>
            <p className="mb-3 text-xs text-zinc-500">{snapshot.cinema.venue}</p>
            {snapshot.cinema.movies.length === 0 ? (
              <EmptyState icon={Film} text={snapshot.cinema.message ?? "Cartelera no disponible."} />
            ) : (
              <ul className="space-y-3">
                {snapshot.cinema.movies.map((movie) => (
                  <li key={movie.title}>
                    <p className="text-sm font-medium text-zinc-100">{movie.title}</p>
                    <p className="text-xs text-zinc-500">{movie.times.join(" · ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </SourceCard>
        </div>
      </div>
    </div>
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
    <div className="flex h-full min-h-[88px] flex-col items-start justify-center gap-2 text-sm text-zinc-500">
      <Icon className="h-5 w-5 text-zinc-600" />
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
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-zinc-100">
        {value == null ? "—" : `${value}${suffix}`}
      </dd>
    </div>
  );
}
