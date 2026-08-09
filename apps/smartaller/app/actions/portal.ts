"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { parseImportacion } from "@/lib/schemas/vehiculo-documentos";
import {
  resolvePortalAccess,
  requirePortalRole,
  resolveVisibleTallerIds,
  type PortalRole,
} from "@/lib/portal/roles";
import {
  placaRealVisible,
  resolveCodigoExpediente,
} from "@/lib/importacion/expediente";

export type PortalTallerRow = {
  id: string;
  nombre: string;
  tipo_industria: string | null;
  owner_user_id: string;
  vehiculosCount: number;
};

export type PortalVehiculoRow = {
  id: string;
  tallerId: string | null;
  tallerNombre: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serialCarroceria: string | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  codigoExpediente: string | null;
  planillaFase: number | null;
  regimen: string | null;
  numeroBl: string | null;
  fechaLlegadaBuque: string | null;
  createdAt: string;
};

async function loadTalleresMap(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[] | "all"
): Promise<Map<string, { nombre: string; tipo_industria: string | null }>> {
  let query = admin.from("talleres").select("id, nombre, tipo_industria");
  if (ids !== "all") {
    if (ids.length === 0) return new Map();
    query = query.in("id", ids);
  }
  const { data } = await query;
  const map = new Map<string, { nombre: string; tipo_industria: string | null }>();
  for (const row of data ?? []) {
    map.set(row.id as string, {
      nombre: String(row.nombre ?? "Taller"),
      tipo_industria: (row.tipo_industria as string | null) ?? null,
    });
  }
  return map;
}

export async function listPortalTalleresAction(
  role: PortalRole
): Promise<
  | { success: true; talleres: PortalTallerRow[]; verTodo: boolean }
  | { success: false; error: string }
> {
  const access = await resolvePortalAccess();
  const gate = requirePortalRole(access, role);
  if (!gate.ok) return { success: false, error: gate.error };

  const scope = resolveVisibleTallerIds(gate.access, role);
  const admin = createAdminClient();

  let talleresQuery = admin
    .from("talleres")
    .select("id, nombre, tipo_industria, owner_user_id")
    .order("nombre");
  if (!scope.all) {
    if (scope.ids.length === 0) {
      return { success: true, talleres: [], verTodo: false };
    }
    talleresQuery = talleresQuery.in("id", scope.ids);
  }

  const { data: talleres, error } = await talleresQuery;
  if (error) return { success: false, error: error.message };

  const ids = (talleres ?? []).map((t) => t.id as string);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: vehs } = await admin
      .from("vehiculos")
      .select("taller_id")
      .in("taller_id", ids);
    for (const v of vehs ?? []) {
      const tid = v.taller_id as string | null;
      if (!tid) continue;
      counts.set(tid, (counts.get(tid) ?? 0) + 1);
    }
  }

  return {
    success: true,
    verTodo: scope.all,
    talleres: (talleres ?? []).map((t) => ({
      id: t.id as string,
      nombre: String(t.nombre ?? "Taller"),
      tipo_industria: (t.tipo_industria as string | null) ?? null,
      owner_user_id: t.owner_user_id as string,
      vehiculosCount: counts.get(t.id as string) ?? 0,
    })),
  };
}

export async function listPortalVehiculosAction(
  role: PortalRole
): Promise<
  | { success: true; vehiculos: PortalVehiculoRow[]; verTodo: boolean }
  | { success: false; error: string }
> {
  const access = await resolvePortalAccess();
  const gate = requirePortalRole(access, role);
  if (!gate.ok) return { success: false, error: gate.error };

  const scope = resolveVisibleTallerIds(gate.access, role);
  const admin = createAdminClient();

  if (!scope.all && scope.ids.length === 0) {
    return { success: true, vehiculos: [], verTodo: false };
  }

  let query = admin
    .from("vehiculos")
    .select(
      "id, taller_id, placa, marca, modelo, color, serial_carroceria, nombre_cliente, telefono_cliente, importacion, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (!scope.all) {
    query = query.in("taller_id", scope.ids);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const tallerIds = [
    ...new Set(
      (data ?? [])
        .map((r) => r.taller_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const talleres = await loadTalleresMap(
    admin,
    scope.all ? "all" : tallerIds.length ? tallerIds : []
  );

  let rows: PortalVehiculoRow[] = (data ?? []).map((row) => {
    const imp = parseImportacion(row.importacion);
    const codigoExpediente = resolveCodigoExpediente({
      codigoExpediente: imp.codigoExpediente,
      placa: row.placa as string | null,
    });
    const placaReal = placaRealVisible(
      row.placa as string | null,
      codigoExpediente
    );

    return {
      id: row.id as string,
      tallerId: (row.taller_id as string | null) ?? null,
      tallerNombre: row.taller_id
        ? talleres.get(row.taller_id as string)?.nombre ?? null
        : null,
      placa: placaReal,
      marca: (row.marca as string | null) ?? null,
      modelo: (row.modelo as string | null) ?? null,
      color: (row.color as string | null) ?? null,
      serialCarroceria: (row.serial_carroceria as string | null) ?? null,
      nombreCliente: (row.nombre_cliente as string | null) ?? null,
      telefonoCliente: (row.telefono_cliente as string | null) ?? null,
      codigoExpediente,
      planillaFase: imp.planillaFase ?? null,
      regimen: imp.regimen ?? null,
      numeroBl: imp.numeroBl ?? null,
      fechaLlegadaBuque: imp.fechaLlegadaBuque ?? null,
      createdAt: String(row.created_at ?? ""),
    };
  });

  if (role === "aduanera") {
    rows = rows.filter(
      (v) =>
        Boolean(v.regimen?.toLowerCase().includes("puerto")) ||
        Boolean(v.codigoExpediente) ||
        Boolean(v.numeroBl)
    );
  }

  return { success: true, vehiculos: rows, verTodo: scope.all };
}
