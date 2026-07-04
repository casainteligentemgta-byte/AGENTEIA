import { createClient } from "@/lib/supabase/server";
import type { CentroServicio, ServicioCentroId } from "@/lib/service-centers/types";
import { SERVICIOS_CENTRO } from "@/lib/service-centers/types";

function parseServicios(raw: unknown): ServicioCentroId[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is ServicioCentroId =>
      typeof s === "string" && SERVICIOS_CENTRO.includes(s as ServicioCentroId)
  );
}

export async function getCentrosServicio(): Promise<CentroServicio[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("centros_servicio")
      .select(
        "id, nombre, direccion, ciudad, lat, lng, imagen_url, rating_promedio, rating_cantidad, servicios"
      )
      .eq("activo", true)
      .order("nombre");

    if (error) {
      console.error("getCentrosServicio:", error.message);
      return getCentrosServicioFallback();
    }

    if (!data?.length) return getCentrosServicioFallback();

    return data.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      direccion: row.direccion,
      ciudad: row.ciudad,
      lat: row.lat,
      lng: row.lng,
      imagen_url: row.imagen_url,
      rating_promedio: Number(row.rating_promedio) || 0,
      rating_cantidad: row.rating_cantidad ?? 0,
      servicios: parseServicios(row.servicios),
    }));
  } catch {
    return getCentrosServicioFallback();
  }
}

/** Fallback cuando Supabase no está configurado o la tabla no existe aún */
function getCentrosServicioFallback(): CentroServicio[] {
  return [
    {
      id: "demo-baic-porlamar",
      nombre: "BAIC PORLAMAR",
      direccion:
        "Av. Juan Bautista Arismendi, Edif. Oriental Auto Piso 1, Sector Los Cocos, Porlamar",
      ciudad: "Porlamar",
      lat: 10.9781,
      lng: -63.8487,
      imagen_url: null,
      rating_promedio: 0,
      rating_cantidad: 0,
      servicios: ["aceite", "filtros", "escaner", "limpieza_inyectores"],
    },
    {
      id: "demo-cauchos-sora",
      nombre: "Cauchos Sora C.A.",
      direccion: "Av. 4 de Mayo, Sector El Amparo, Porlamar",
      ciudad: "Porlamar",
      lat: 10.9648,
      lng: -63.8542,
      imagen_url: null,
      rating_promedio: 5,
      rating_cantidad: 6,
      servicios: ["balanceo", "aceite", "neumaticos", "bateria", "alineacion"],
    },
    {
      id: "demo-automotores-universal",
      nombre: "Automotores Universal C.A.",
      direccion: "Av. Rómulo Gallegos, Porlamar",
      ciudad: "Porlamar",
      lat: 10.9712,
      lng: -63.8515,
      imagen_url: null,
      rating_promedio: 4.5,
      rating_cantidad: 12,
      servicios: ["aceite", "filtros", "escaner", "neumaticos", "bateria", "alineacion"],
    },
  ];
}

export async function getCentroServicioById(id: string): Promise<CentroServicio | null> {
  const centros = await getCentrosServicio();
  return centros.find((c) => c.id === id) ?? null;
}
