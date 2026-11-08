import { FETCH_MAX_BYTES, FETCH_TIMEOUT_MS, OJO_DE_DIOS_USER_AGENT } from "./config";

export class SafeFetchError extends Error {
  readonly code: "ssrf" | "timeout" | "size" | "network";

  constructor(code: SafeFetchError["code"], message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

export type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export type SafeFetchOptions = {
  allowHosts: readonly string[];
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  fetchImpl?: FetchLike;
};

const PRIVATE_IPV4 =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return true;
  if (PRIVATE_IPV4.test(host)) return true;
  return false;
}

export function parseAllowlistedHttpsUrl(
  urlString: string,
  allowHosts: readonly string[]
): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new SafeFetchError("ssrf", "URL inválida");
  }
  if (url.protocol !== "https:") {
    throw new SafeFetchError("ssrf", "Solo se permiten URLs https");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("ssrf", "URL con credenciales bloqueada");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new SafeFetchError("ssrf", "Host interno bloqueado");
  }
  const allowed = allowHosts.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
  );
  if (!allowed) {
    throw new SafeFetchError("ssrf", "Host no permitido");
  }
  return url;
}

export async function safeFetch(
  urlString: string,
  options: SafeFetchOptions
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? FETCH_MAX_BYTES;
  const fetchImpl = options.fetchImpl ?? fetch;
  let current = urlString;

  for (let hop = 0; hop < 5; hop++) {
    const url = parseAllowlistedHttpsUrl(current, options.allowHosts);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: options.method ?? "GET",
        body: options.body,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "application/json, application/rss+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
          "User-Agent": OJO_DE_DIOS_USER_AGENT,
          ...(options.headers ?? {}),
        },
      });
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new SafeFetchError(aborted ? "timeout" : "network", aborted ? "Tiempo de espera agotado" : "Error de red");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new SafeFetchError("network", `Redirección ${res.status} sin Location`);
      }
      current = new URL(location, url).toString();
      continue;
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new SafeFetchError("size", "Respuesta demasiado grande");
    }
    return {
      ok: res.ok,
      status: res.status,
      text: new TextDecoder("utf-8", { fatal: false }).decode(buffer),
      finalUrl: url.toString(),
    };
  }

  throw new SafeFetchError("ssrf", "Demasiadas redirecciones");
}
