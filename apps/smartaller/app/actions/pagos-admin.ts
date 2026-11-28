"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMasterVerTodo } from "@/lib/portal/roles";
import { crearNotificacionUsuario } from "@/lib/data/notificaciones";
import { calcularPeriodoRenovacion } from "@/lib/billing/periodo";
import { isBillingSchemaMissing } from "@/lib/billing/schema";
import { PLANES_PAGO } from "@/lib/billing/plans";
import {
  rechazarReporteSchema,
  revisarReporteSchema,
} from "@/lib/validations/reporte-pago";
import {
  crearExoneracionSchema,
  revocarExoneracionSchema,
} from "@/lib/validations/exoneracion";

export type AdminPagoResult = { ok: true } | { ok: false; error: string };

function revalidateAdminPagos() {
  revalidatePath("/portales/master");
  revalidatePath("/portales/master/pagos");
  revalidatePath("/app");
  revalidatePath("/dashboard");
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return { ok: false, error: error.message };
    const users = data.users ?? [];
    const found = users.find((user) => user.email?.toLowerCase() === normalized);
    if (found) return { ok: true, userId: found.id };
    if (users.length < perPage) {
      return {
        ok: false,
        error: "Ese correo no tiene cuenta. La persona debe registrarse primero.",
      };
    }
  }
  return { ok: false, error: "No se encontró el correo en las cuentas registradas." };
}

async function ensurePerfilRow(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<AdminPagoResult> {
  const { error } = await admin.from("perfiles").upsert(
    { id: userId, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function aprobarReportePagoAction(
  input: { reporteId: string; notas?: string }
): Promise<AdminPagoResult> {
  const gate = await requireMasterVerTodo();
  if (!gate.ok) return gate;

  const parsed = revisarReporteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reporte inválido" };

  const admin = createAdminClient();
  const { data: reporte, error: findError } = await admin
    .from("reportes_pago")
    .select(
      "id, user_id, tipo_plan, taller_id, estado, periodo_inicio, periodo_fin"
    )
    .eq("id", parsed.data.reporteId)
    .maybeSingle();

  if (findError) {
    if (isBillingSchemaMissing(findError)) {
      return { ok: false, error: "Aplica la migración de pagos en Supabase." };
    }
    return { ok: false, error: findError.message };
  }
  if (!reporte) return { ok: false, error: "No encontramos ese reporte" };
  if (reporte.estado !== "pendiente") {
    return { ok: false, error: "Ese reporte ya no está pendiente" };
  }

  const now = new Date();
  let vencimientoActual: string | null = null;

  if (reporte.tipo_plan === "b2c") {
    await ensurePerfilRow(admin, reporte.user_id);
    const { data: perfil } = await admin
      .from("perfiles")
      .select("vencimiento_plan")
      .eq("id", reporte.user_id)
      .maybeSingle();
    vencimientoActual = (perfil?.vencimiento_plan as string | null) ?? null;
  } else {
    if (!reporte.taller_id) {
      return { ok: false, error: "El reporte de taller no tiene taller asociado" };
    }
    const { data: taller } = await admin
      .from("talleres")
      .select("vencimiento_plan")
      .eq("id", reporte.taller_id)
      .maybeSingle();
    vencimientoActual = (taller?.vencimiento_plan as string | null) ?? null;
  }

  const periodo = calcularPeriodoRenovacion(vencimientoActual, now);
  const notas = parsed.data.notas?.trim() || null;

  if (reporte.tipo_plan === "b2c") {
    const { error } = await admin
      .from("perfiles")
      .update({
        tipo_plan: "premium",
        suscripcion_activa: true,
        vencimiento_plan: periodo.fin.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", reporte.user_id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin
      .from("talleres")
      .update({
        plan_suscripcion: "pro",
        suscripcion_activa: true,
        vencimiento_plan: periodo.fin.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", reporte.taller_id);
    if (error) return { ok: false, error: error.message };
  }

  const { error: updateError } = await admin
    .from("reportes_pago")
    .update({
      estado: "aprobado",
      revisado_por: gate.access.userId,
      revisado_at: now.toISOString(),
      notas,
      periodo_inicio: periodo.inicio.toISOString(),
      periodo_fin: periodo.fin.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", reporte.id)
    .eq("estado", "pendiente");

  if (updateError) return { ok: false, error: updateError.message };

  const planNombre =
    reporte.tipo_plan === "b2c" ? PLANES_PAGO.b2c.nombre : PLANES_PAGO.taller.nombre;
  await crearNotificacionUsuario({
    userId: reporte.user_id,
    titulo: "Pago confirmado",
    cuerpo: `Activamos ${planNombre} hasta el ${periodo.fin.toLocaleDateString("es-VE")}.`,
  });

  revalidateAdminPagos();
  return { ok: true };
}

export async function rechazarReportePagoAction(
  input: { reporteId: string; notas: string }
): Promise<AdminPagoResult> {
  const gate = await requireMasterVerTodo();
  if (!gate.ok) return gate;

  const parsed = rechazarReporteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Motivo inválido" };
  }

  const admin = createAdminClient();
  const { data: reporte, error: findError } = await admin
    .from("reportes_pago")
    .select("id, user_id, estado, tipo_plan")
    .eq("id", parsed.data.reporteId)
    .maybeSingle();

  if (findError) {
    if (isBillingSchemaMissing(findError)) {
      return { ok: false, error: "Aplica la migración de pagos en Supabase." };
    }
    return { ok: false, error: findError.message };
  }
  if (!reporte) return { ok: false, error: "No encontramos ese reporte" };
  if (reporte.estado !== "pendiente") {
    return { ok: false, error: "Ese reporte ya no está pendiente" };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("reportes_pago")
    .update({
      estado: "rechazado",
      revisado_por: gate.access.userId,
      revisado_at: now,
      notas: parsed.data.notas,
      updated_at: now,
    })
    .eq("id", reporte.id)
    .eq("estado", "pendiente");

  if (error) return { ok: false, error: error.message };

  await crearNotificacionUsuario({
    userId: reporte.user_id,
    titulo: "Pago no confirmado",
    cuerpo: parsed.data.notas,
  });

  revalidateAdminPagos();
  return { ok: true };
}

export async function crearExoneracionAction(input: unknown): Promise<AdminPagoResult> {
  const gate = await requireMasterVerTodo();
  if (!gate.ok) return gate;

  const parsed = crearExoneracionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();
  let perfilId: string | null = null;
  let tallerId: string | null = null;

  if (parsed.data.tipo === "perfil") {
    const found = await findAuthUserIdByEmail(admin, parsed.data.email ?? "");
    if (!found.ok) return found;
    const ensured = await ensurePerfilRow(admin, found.userId);
    if (!ensured.ok) return ensured;
    perfilId = found.userId;
  } else {
    tallerId = parsed.data.tallerId ?? null;
    if (!tallerId) return { ok: false, error: "Selecciona el taller" };
  }

  const vigenteHasta =
    parsed.data.vigenteHasta && parsed.data.vigenteHasta.length > 0
      ? `${parsed.data.vigenteHasta}T23:59:59-04:00`
      : null;

  const { error } = await admin.from("exoneraciones_suscripcion").insert({
    created_by: gate.access.userId,
    tipo: parsed.data.tipo,
    perfil_id: perfilId,
    taller_id: tallerId,
    vigente_hasta: vigenteHasta,
    notas: parsed.data.notas?.trim() || null,
    activa: true,
  });

  if (error) {
    if (isBillingSchemaMissing(error)) {
      return { ok: false, error: "Aplica la migración de pagos en Supabase." };
    }
    if (error.code === "23505") {
      return { ok: false, error: "Ya hay una exoneración activa para ese destino." };
    }
    return { ok: false, error: error.message };
  }

  if (perfilId) {
    await crearNotificacionUsuario({
      userId: perfilId,
      titulo: "Acceso exonerado",
      cuerpo: "Tu cuenta quedó exonerada del plan SmartTaller Pro.",
    });
  }

  revalidateAdminPagos();
  return { ok: true };
}

export async function revocarExoneracionAction(
  exoneracionId: string
): Promise<AdminPagoResult> {
  const gate = await requireMasterVerTodo();
  if (!gate.ok) return gate;

  const parsed = revocarExoneracionSchema.safeParse({ exoneracionId });
  if (!parsed.success) return { ok: false, error: "Exoneración inválida" };

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("exoneraciones_suscripcion")
    .update({
      activa: false,
      revoked_at: now,
      revoked_by: gate.access.userId,
    })
    .eq("id", parsed.data.exoneracionId)
    .eq("activa", true);

  if (error) {
    if (isBillingSchemaMissing(error)) {
      return { ok: false, error: "Aplica la migración de pagos en Supabase." };
    }
    return { ok: false, error: error.message };
  }

  revalidateAdminPagos();
  return { ok: true };
}

export async function listExoneracionesAction(): Promise<
  | {
      ok: true;
      rows: Array<{
        id: string;
        createdAt: string;
        tipo: string;
        perfilId: string | null;
        tallerId: string | null;
        tallerNombre: string | null;
        vigenteHasta: string | null;
        notas: string | null;
        activa: boolean;
      }>;
    }
  | { ok: false; error: string }
> {
  const gate = await requireMasterVerTodo();
  if (!gate.ok) return gate;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("exoneraciones_suscripcion")
    .select("id, created_at, tipo, perfil_id, taller_id, vigente_hasta, notas, activa")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isBillingSchemaMissing(error)) {
      return { ok: false, error: "Aplica la migración de pagos en Supabase." };
    }
    return { ok: false, error: error.message };
  }

  const tallerIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.taller_id)
        .filter((id): id is string => typeof id === "string")
    ),
  ];
  const nombres = new Map<string, string>();
  if (tallerIds.length > 0) {
    const { data: talleres } = await admin
      .from("talleres")
      .select("id, nombre")
      .in("id", tallerIds);
    for (const t of talleres ?? []) {
      nombres.set(t.id, t.nombre);
    }
  }

  return {
    ok: true,
    rows: (data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      tipo: row.tipo,
      perfilId: row.perfil_id,
      tallerId: row.taller_id,
      tallerNombre: row.taller_id ? nombres.get(row.taller_id) ?? null : null,
      vigenteHasta: row.vigente_hasta,
      notas: row.notas,
      activa: Boolean(row.activa),
    })),
  };
}
