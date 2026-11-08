import { OPEN_METEO_HOST, WEATHER_CITIES } from "../config";
import { getPublicCache, setPublicCache } from "../cache";
import { SafeFetchError, safeFetch, type FetchLike } from "../safe-fetch";
import type { WeatherCityReading, WeatherSection } from "../types";

const WMO_LABELS: Record<number, string> = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla con escarcha",
  51: "Llovizna débil",
  53: "Llovizna",
  55: "Llovizna intensa",
  61: "Lluvia débil",
  63: "Lluvia",
  65: "Lluvia intensa",
  71: "Nieve débil",
  73: "Nieve",
  75: "Nieve intensa",
  80: "Chubascos débiles",
  81: "Chubascos",
  82: "Chubascos intensos",
  95: "Tormenta",
  96: "Tormenta con granizo",
  99: "Tormenta fuerte con granizo",
};

export function weatherLabelFromCode(code: number | null | undefined): string {
  if (code == null || !Number.isFinite(code)) return "Condición desconocida";
  return WMO_LABELS[code] ?? `Código WMO ${code}`;
}

type OpenMeteoCurrent = {
  temperature_2m?: number;
  weather_code?: number;
  relative_humidity_2m?: number;
  wind_speed_10m?: number;
  time?: string;
};

function emptyWeather(message: string, status: WeatherSection["status"]): WeatherSection {
  return {
    id: "weather",
    label: "Clima",
    status,
    fetchedAt: new Date().toISOString(),
    sourceName: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    message,
    cities: [],
  };
}

function parseCity(
  city: (typeof WEATHER_CITIES)[number],
  payload: { current?: OpenMeteoCurrent }
): WeatherCityReading | null {
  const current = payload.current;
  const temperature = current?.temperature_2m;
  if (typeof temperature !== "number" || !Number.isFinite(temperature)) return null;
  return {
    cityId: city.id,
    cityName: city.name,
    temperatureC: Math.round(temperature * 10) / 10,
    weatherLabel: weatherLabelFromCode(current?.weather_code),
    humidityPercent:
      typeof current?.relative_humidity_2m === "number" ? current.relative_humidity_2m : null,
    windKmh: typeof current?.wind_speed_10m === "number" ? current.wind_speed_10m : null,
    observedAt: typeof current?.time === "string" ? current.time : null,
  };
}

export async function fetchWeather(fetchImpl?: FetchLike): Promise<WeatherSection> {
  const cached = getPublicCache<WeatherSection>("weather");
  if (cached) return cached;

  const fetchedAt = new Date().toISOString();
  const cities: WeatherCityReading[] = [];
  const failures: string[] = [];

  await Promise.all(
    WEATHER_CITIES.map(async (city) => {
      const url =
        `https://${OPEN_METEO_HOST}/v1/forecast` +
        `?latitude=${city.latitude}&longitude=${city.longitude}` +
        `&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m` +
        `&timezone=${encodeURIComponent(city.timezone)}`;
      try {
        const res = await safeFetch(url, {
          allowHosts: [OPEN_METEO_HOST],
          fetchImpl,
        });
        if (!res.ok) {
          failures.push(city.name);
          return;
        }
        const payload = JSON.parse(res.text) as { current?: OpenMeteoCurrent };
        const reading = parseCity(city, payload);
        if (reading) cities.push(reading);
        else failures.push(city.name);
      } catch (error) {
        if (error instanceof SafeFetchError && error.code === "ssrf") throw error;
        failures.push(city.name);
      }
    })
  );

  const order: string[] = WEATHER_CITIES.map((city) => city.id);
  cities.sort((a, b) => order.indexOf(a.cityId) - order.indexOf(b.cityId));

  if (cities.length === 0) {
    return emptyWeather("No se pudo obtener el clima ahora mismo.", "error");
  }

  const section: WeatherSection = {
    id: "weather",
    label: "Clima",
    status: "ok",
    fetchedAt,
    sourceName: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    message:
      failures.length > 0
        ? `Sin datos para: ${failures.join(", ")}`
        : null,
    cities,
  };
  return setPublicCache("weather", section);
}
