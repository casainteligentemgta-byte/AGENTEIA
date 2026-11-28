"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getOrEnsurePerfil } from "@/lib/data/perfil";
import { ensureTallerForUser } from "@/lib/taller";
import { notifyAdminTelegram } from "@/lib/telegram";
import { getAppBaseUrl } from "@/lib/app-url";
import { getBrand } from "@/lib/brand";
import { PAGO_MOVIL } from "@/lib/billing/pago-movil";
import { PLANES_PAGO, formatUsd, type TipoPlanPago } from "@/lib/billing/plans";
import { isBillingSchemaMissing } from "@/lib/billing/schema";
import {
  comprobanteStoragePath,
  COMPROBANTES_PAGO_BUCKET,
  resolveComprobanteMime,
  validateComprobantePagoFile,
} from "@/lib/billing/comprobante";
import { reportePagoSchema, cancelarReporteSchema } from "@/lib/validations/reporte-pago";

export type PagoActionResult =
  | { success: true }
  | { success: false; error: string };

function revalidatePagos() {
  revalidatePath("/app");
  revalidatePath("/dashboard");
  revalidatePath("/portales/master/pagos");
}

async function uploadComprobante(
  userId: string,
  file: File
): Promise<{ path: string } | { error: string }> {
  const validation = validateComprobantePagoFile(file);
  if (validation) return { error: validation };
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = resolveComprobanteMime(file, buffer);
  if ("error" in mime) return { error: mime.error };
  const path = comprobanteStoragePath(userId, mime.ext);
  const admin = createAdminClient();
  const { error } = await admin.storage.from(COMPROBANTES_PAGO_BUCKET).upload(path, buffer, {
    contentType: mime.mime,
    upsert: false,
  });
  if (error) {
    if (isBillingSchemaMissing(error) || /bucket|not found/i.test(error.message)) {
      return { error: "El módulo de pagos aún no está activo. Avisa al administrador." };
    }
    return { error: error.message };
  }
  return { path };
}

export async function reportarPagoAction(formData: FormData): Promise<PagoActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Debes iniciar sesión" };

  const parsed = reportePagoSchema.safeParse({
    tipoPlan: formData.get("tipoPlan"),
    monto: formData.get("monto"),
    moneda: formData.get("moneda"),
    referencia: formData.get("referencia"),
    fechaPago: formData.get("fechaPago"),
  });
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message =
      first.monto?.[0] ??
      first.referencia?.[0] ??
      first.fechaPago?.[0] ??
      first.moneda?.[0] ??
      first.tipoPlan?.[0] ??
      parsed.error.issues[0]?.message ??
      "Revisa los datos del reporte";
    return { success: false, error: message };
  }

  const tipoPlan: TipoPlanPago = parsed.data.tipoPlan;
  let tallerId: string | null = null;
  if (tipoPlan === "taller") {
    const { taller, error } = await ensureTallerForUser(user.id);
    if (!taller) {
      return { success: false, error: error ?? "No se encontró tu taller" };
    }
    tallerId = taller.id;
  } else {
    await getOrEnsurePerfil();
  }

  const file = formData.get("comprobante");
  let comprobantePath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadComprobante(user.id, file);
    if ("error" in uploaded) return { success: false, error: uploaded.error };
    comprobantePath = uploaded.path;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("reportes_pago").insert({
    user_id: user.id,
    tipo_plan: tipoPlan,
    taller_id: tallerId,
    monto: parsed.data.monto,
    moneda: parsed.data.moneda,
    referencia: parsed.data.referencia,
    fecha_pago: parsed.data.fechaPago,
    comprobante_path: comprobantePath,
    estado: "pendiente",
  });

  if (error) {
    if (isBillingSchemaMissing(error)) {
      return {
        success: false,
        error: "El módulo de pagos aún no está activo. Avisa al administrador.",
      };
    }
    if (error.code === "23505") {
      return {
        success: false,
        error: "Ya tienes un reporte pendiente. Espera la revisión o cancélalo para enviar otro.",
      };
    }
    return { success: false, error: error.message };
  }

  const plan = PLANES_PAGO[tipoPlan];
  const text = [
    "💳 Nuevo reporte de Pago Móvil",
    `📦 ${plan.nombre} (${tipoPlan === "b2c" ? "dueño" : "taller"})`,
    `👤 ${user.email ?? user.id}`,
    `💰 ${parsed.data.monto} ${parsed.data.moneda} (plan ${formatUsd(plan.usdPorMes)}/mes)`,
    `🔖 Ref. ${parsed.data.referencia}`,
    `📅 ${parsed.data.fechaPago}`,
    `🏦 ${PAGO_MOVIL.banco} · ${PAGO_MOVIL.telefono} · ${PAGO_MOVIL.cedula}`,
    comprobantePath ? "📎 Comprobante adjunto" : "📎 Sin comprobante",
    `🔗 ${getAppBaseUrl()}/portales/master/pagos`,
    `🤖 ${getBrand().copy.telegram.botLabel}`,
  ].join("\n");
  await notifyAdminTelegram(text);

  revalidatePagos();
  return { success: true };
}

export async function cancelarReportePagoAction(reporteId: string): Promise<PagoActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Debes iniciar sesión" };

  const parsed = cancelarReporteSchema.safeParse({ reporteId });
  if (!parsed.success) return { success: false, error: "Reporte inválido" };

  const admin = createAdminClient();
  const { data, error: findError } = await admin
    .from("reportes_pago")
    .select("id, user_id, estado")
    .eq("id", parsed.data.reporteId)
    .maybeSingle();

  if (findError) {
    if (isBillingSchemaMissing(findError)) {
      return { success: false, error: "El módulo de pagos aún no está activo." };
    }
    return { success: false, error: findError.message };
  }
  if (!data || data.user_id !== user.id) {
    return { success: false, error: "No encontramos ese reporte" };
  }
  if (data.estado !== "pendiente") {
    return { success: false, error: "Solo puedes cancelar un reporte pendiente" };
  }

  const { error } = await admin
    .from("reportes_pago")
    .update({ estado: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.reporteId)
    .eq("user_id", user.id)
    .eq("estado", "pendiente");

  if (error) return { success: false, error: error.message };

  revalidatePagos();
  return { success: true };
}

export async function marcarNotificacionLeidaAction(
  notificacionId: string
): Promise<PagoActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Debes iniciar sesión" };
  if (!/^[0-9a-f-]{36}$/i.test(notificacionId)) {
    return { success: false, error: "Aviso inválido" };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("notificaciones_usuario")
    .update({ leida: true, leida_at: new Date().toISOString() })
    .eq("id", notificacionId)
    .eq("user_id", user.id);
  if (error && !isBillingSchemaMissing(error)) {
    return { success: false, error: error.message };
  }
  revalidatePath("/app");
  revalidatePath("/dashboard");
  return { success: true };
}
