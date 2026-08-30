const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type TasaBcvLookup = {
  tasa: number;
  fechaConsulta: string;
  fechaVigente: string;
  futura: boolean;
};

function pickUsd(data: unknown): { tasa: number; vigente: string } | null {
  if (!data || typeof data !== "object") return null;
  const row = data as {
    USD?: unknown;
    promedio?: unknown;
    effective_date?: unknown;
    date?: unknown;
    fechaActualizacion?: unknown;
  };
  const raw = row.USD ?? row.promedio;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const vigente =
    typeof row.effective_date === "string" && DATE_RE.test(row.effective_date)
      ? row.effective_date
      : typeof row.date === "string" && DATE_RE.test(row.date)
        ? row.date
        : typeof row.fechaActualizacion === "string"
          ? row.fechaActualizacion.slice(0, 10)
          : "";
  return { tasa: n, vigente };
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function todayYmd(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Tasa oficial BCV (Bs por 1 USD) vigente en esa fecha, o la última publicada. */
export async function lookupTasaBcv(
  fecha: string
): Promise<TasaBcvLookup | null> {
  const day = fecha.trim();
  if (!DATE_RE.test(day)) return null;

  const today = todayYmd();
  const futura = day > today;

  if (!futura) {
    const byDate = pickUsd(
      await fetchJson(`https://bcv.today/api/v1/history/${day}.json`)
    );
    if (byDate) {
      return {
        tasa: byDate.tasa,
        fechaConsulta: day,
        fechaVigente: byDate.vigente || day,
        futura: false,
      };
    }
  }

  const latest =
    pickUsd(await fetchJson("https://bcv.today/api/v1/rate.json")) ??
    pickUsd(await fetchJson("https://ve.dolarapi.com/v1/dolares/oficial"));
  if (!latest) return null;

  return {
    tasa: latest.tasa,
    fechaConsulta: day,
    fechaVigente: latest.vigente || today,
    futura,
  };
}

export function formatTasaBcvInput(tasa: number): string {
  return tasa.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  const month = MESES[Number(m) - 1];
  if (!y || !d || !month) return iso;
  return `${Number(d)} ${month} ${y}`;
}

export function hintTasaBcv(lookup: TasaBcvLookup): string {
  const vigente = formatFechaCorta(lookup.fechaVigente);
  if (lookup.futura) {
    return `Aún no hay tasa del ${formatFechaCorta(lookup.fechaConsulta)}. Se usó la última publicada (${vigente}).`;
  }
  if (lookup.fechaVigente && lookup.fechaVigente !== lookup.fechaConsulta) {
    return `Tasa BCV vigente el ${formatFechaCorta(lookup.fechaConsulta)} (publicada ${vigente}).`;
  }
  return `Tasa BCV oficial del ${vigente}.`;
}
