import { createAdminClient } from "@/lib/supabase/admin";
import {
  lookupTasaBcv,
  todayYmdCaracas,
  type TasaBcvLookup,
} from "@/lib/importacion/tasa-bcv";
import { isBillingSchemaMissing } from "@/lib/billing/schema";

export type TasaBcvDelDia = {
  tasa: number;
  fecha: string;
  fechaVigente: string;
  fuente: "tabla" | "api" | "fallback";
  etiqueta: string;
};

function etiquetaTasa(fecha: string, fuente: TasaBcvDelDia["fuente"]): string {
  const [y, m, d] = fecha.split("-");
  const visible = y && m && d ? `${d}/${m}/${y}` : fecha;
  if (fuente === "fallback") {
    return `Tasa BCV de referencia (${visible})`;
  }
  return `Tasa BCV del día (${visible})`;
}

async function readTabla(
  admin: ReturnType<typeof createAdminClient>,
  fecha: string
): Promise<{ tasa: number; fecha: string } | null> {
  const { data, error } = await admin
    .from("tasas_cambio_bcv")
    .select("fecha, tasa")
    .eq("fecha", fecha)
    .maybeSingle();
  if (error) {
    if (!isBillingSchemaMissing(error)) {
      console.error("tasas_cambio_bcv read:", error.message);
    }
    return null;
  }
  if (!data || typeof data.tasa !== "number" || data.tasa <= 0) return null;
  return { tasa: Number(data.tasa), fecha: String(data.fecha) };
}

async function readUltimaTabla(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ tasa: number; fecha: string } | null> {
  const { data, error } = await admin
    .from("tasas_cambio_bcv")
    .select("fecha, tasa")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || typeof data.tasa !== "number" || data.tasa <= 0) {
    return null;
  }
  return { tasa: Number(data.tasa), fecha: String(data.fecha) };
}

export async function persistirTasaBcv(
  lookup: TasaBcvLookup,
  fuente = "bcv"
): Promise<void> {
  try {
    const admin = createAdminClient();
    const fecha = lookup.fechaVigente || lookup.fechaConsulta;
    const { error } = await admin.from("tasas_cambio_bcv").upsert(
      {
        fecha,
        tasa: lookup.tasa,
        fuente,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fecha" }
    );
    if (error && !isBillingSchemaMissing(error)) {
      console.error("tasas_cambio_bcv upsert:", error.message);
    }
  } catch (err) {
    console.error("persistirTasaBcv:", err);
  }
}

/** Tasa BCV del día: tabla → API (bcv.today) → última fila como fallback. */
export async function getTasaBcvDelDia(now = new Date()): Promise<TasaBcvDelDia | null> {
  const hoy = todayYmdCaracas(now);
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  if (admin) {
    const cached = await readTabla(admin, hoy);
    if (cached) {
      return {
        tasa: cached.tasa,
        fecha: hoy,
        fechaVigente: cached.fecha,
        fuente: "tabla",
        etiqueta: etiquetaTasa(cached.fecha, "tabla"),
      };
    }
  }

  const api = await lookupTasaBcv(hoy);
  if (api) {
    await persistirTasaBcv(api);
    return {
      tasa: api.tasa,
      fecha: hoy,
      fechaVigente: api.fechaVigente || hoy,
      fuente: "api",
      etiqueta: etiquetaTasa(api.fechaVigente || hoy, "api"),
    };
  }

  if (admin) {
    const fallback = await readUltimaTabla(admin);
    if (fallback) {
      return {
        tasa: fallback.tasa,
        fecha: hoy,
        fechaVigente: fallback.fecha,
        fuente: "fallback",
        etiqueta: etiquetaTasa(fallback.fecha, "fallback"),
      };
    }
  }

  return null;
}
