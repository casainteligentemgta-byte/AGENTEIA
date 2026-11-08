/** Contratos del panel personal Ojo de Dios. Sin secretos ni cuerpos de correo. */

export type ProviderStatus = "ok" | "needsAuth" | "error" | "unavailable" | "hidden";

export type ProviderMeta = {
  id: string;
  label: string;
  status: ProviderStatus;
  fetchedAt: string | null;
  sourceName: string;
  sourceUrl: string | null;
  /** Mensaje seguro para UI. Nunca tokens, cuerpos de correo ni PII extra. */
  message: string | null;
};

export type WeatherCityReading = {
  cityId: string;
  cityName: string;
  temperatureC: number;
  weatherLabel: string;
  humidityPercent: number | null;
  windKmh: number | null;
  observedAt: string | null;
};

export type WeatherSection = ProviderMeta & {
  cities: WeatherCityReading[];
};

export type NewsItem = {
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: string | null;
};

export type NewsFeed = {
  id: string;
  label: string;
  items: NewsItem[];
  status: ProviderStatus;
  fetchedAt: string | null;
  sourceUrl: string;
  message: string | null;
};

export type NewsSection = ProviderMeta & {
  feeds: NewsFeed[];
};

export type XTrend = {
  name: string;
  url: string | null;
};

export type XSection = ProviderMeta & {
  placeLabel: string | null;
  trends: XTrend[];
};

export type GarminSection = ProviderMeta & {
  steps: number | null;
  restingHeartRate: number | null;
  sleepScore: number | null;
  bodyBattery: number | null;
};

export type GmailItem = {
  id: string;
  from: string;
  subject: string;
  receivedAt: string | null;
  /** Recorte corto; nunca el cuerpo completo. */
  snippet: string | null;
};

export type GmailSection = ProviderMeta & {
  items: GmailItem[];
};

export type CinemaShow = {
  title: string;
  times: string[];
  format: string | null;
};

export type CinemaSection = ProviderMeta & {
  venue: string;
  movies: CinemaShow[];
};

export type OjoDeDiosSnapshot = {
  generatedAt: string;
  weather: WeatherSection;
  news: NewsSection;
  x: XSection;
  garmin: GarminSection;
  gmail: GmailSection;
  cinema: CinemaSection;
};

export type OjoDeDiosAccess =
  | { ok: true; userId: string | null; email: string | null }
  | { ok: false; status: 401 | 404 };
