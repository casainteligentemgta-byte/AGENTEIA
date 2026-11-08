import { GARMIN_ALLOW_HOSTS } from "../config";
import { configuredSecret } from "../access";
import { SafeFetchError, safeFetch, type FetchLike } from "../safe-fetch";
import type { GarminSection } from "../types";

function garminSection(
  status: GarminSection["status"],
  message: string | null,
  extras: Partial<GarminSection> = {}
): GarminSection {
  return {
    id: "garmin",
    label: "Salud Garmin",
    status,
    fetchedAt: status === "ok" ? new Date().toISOString() : null,
    sourceName: "Garmin Wellness API",
    sourceUrl: "https://developer.garmin.com/",
    message,
    steps: null,
    restingHeartRate: null,
    sleepScore: null,
    bodyBattery: null,
    ...extras,
  };
}

export function garminNotConnected(message = "No conectado"): GarminSection {
  return garminSection("needsAuth", message);
}

function startOfUtcDaySeconds(now = Date.now()): number {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

export async function fetchGarmin(options: {
  allowed: boolean;
  fetchImpl?: FetchLike;
}): Promise<GarminSection> {
  if (!options.allowed) return garminNotConnected("No conectado");
  const token = configuredSecret(process.env.GARMIN_ACCESS_TOKEN);
  if (!token) return garminNotConnected("No conectado");

  const start = startOfUtcDaySeconds();
  const end = start + 24 * 60 * 60 - 1;
  const url =
    `https://apis.garmin.com/wellness-api/rest/dailies` +
    `?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${end}`;

  try {
    const res = await safeFetch(url, {
      allowHosts: GARMIN_ALLOW_HOSTS,
      fetchImpl: options.fetchImpl,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      return garminSection("needsAuth", "No conectado");
    }
    if (!res.ok) {
      return garminSection("error", "Garmin no devolvió datos de salud.");
    }
    const payload = JSON.parse(res.text) as unknown;
    const rows = Array.isArray(payload) ? payload : [];
    const latest = rows[0] as
      | {
          steps?: number;
          restingHeartRateInBeatsPerMinute?: number;
          averageStressLevel?: number;
          bodyBatteryChargedValue?: number;
        }
      | undefined;
    if (!latest) {
      return garminSection("unavailable", "No hay resumen de salud para hoy.");
    }
    const steps = typeof latest.steps === "number" ? latest.steps : null;
    const restingHeartRate =
      typeof latest.restingHeartRateInBeatsPerMinute === "number"
        ? latest.restingHeartRateInBeatsPerMinute
        : null;
    const bodyBattery =
      typeof latest.bodyBatteryChargedValue === "number" ? latest.bodyBatteryChargedValue : null;
    if (steps == null && restingHeartRate == null && bodyBattery == null) {
      return garminSection("unavailable", "La API no trajo métricas confirmadas.");
    }
    return garminSection("ok", null, {
      steps,
      restingHeartRate,
      sleepScore: null,
      bodyBattery,
      message: null,
    });
  } catch (error) {
    if (error instanceof SafeFetchError && error.code === "ssrf") throw error;
    return garminSection("error", "No se pudo consultar Garmin.");
  }
}
