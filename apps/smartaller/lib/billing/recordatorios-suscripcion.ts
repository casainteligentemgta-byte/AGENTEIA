import { createAdminClient } from "@/lib/supabase/admin";
import { crearNotificacionUsuario } from "@/lib/data/notificaciones";
import { notifyAdminTelegram, sendTelegramMessage } from "@/lib/telegram";
import { isBillingSchemaMissing } from "@/lib/billing/schema";
import { PLANES_PAGO } from "@/lib/billing/plans";
import { AVISO_DIAS_VENCIMIENTO } from "@/lib/billing/periodo";
import { getAppBaseUrl } from "@/lib/app-url";

export type RecordatoriosSuscripcionResult = {
  scanned: number;
  enviados: number;
  skipped: number;
  errors: string[];
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysUntil(vencimientoIso: string, now: Date): number {
  const fin = startOfUtcDay(new Date(vencimientoIso));
  const hoy = startOfUtcDay(now);
  return Math.round((fin.getTime() - hoy.getTime()) / 86_400_000);
}

async function alreadySent(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    userId: string;
    tipoPlan: "b2c" | "taller";
    diasAntes: number;
    vencimiento: string;
  }
): Promise<boolean> {
  const { data, error } = await admin
    .from("suscripcion_recordatorios_enviados")
    .select("id")
    .eq("user_id", params.userId)
    .eq("tipo_plan", params.tipoPlan)
    .eq("dias_antes", params.diasAntes)
    .eq("vencimiento_plan", params.vencimiento)
    .maybeSingle();
  if (error) {
    if (!isBillingSchemaMissing(error)) {
      console.error("alreadySent recordatorio:", error.message);
    }
    return true;
  }
  return Boolean(data);
}

async function markSent(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    userId: string;
    tallerId: string | null;
    tipoPlan: "b2c" | "taller";
    diasAntes: number;
    vencimiento: string;
    canal: string;
  }
): Promise<void> {
  const { error } = await admin.from("suscripcion_recordatorios_enviados").insert({
    user_id: params.userId,
    taller_id: params.tallerId,
    tipo_plan: params.tipoPlan,
    dias_antes: params.diasAntes,
    vencimiento_plan: params.vencimiento,
    canal: params.canal,
  });
  if (error && !isBillingSchemaMissing(error) && error.code !== "23505") {
    console.error("markSent recordatorio:", error.message);
  }
}

export async function procesarRecordatoriosSuscripcion(
  now = new Date()
): Promise<RecordatoriosSuscripcionResult> {
  const result: RecordatoriosSuscripcionResult = {
    scanned: 0,
    enviados: 0,
    skipped: 0,
    errors: [],
  };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Sin cliente admin");
    return result;
  }

  const { data: perfiles, error: perfilesError } = await admin
    .from("perfiles")
    .select("id, suscripcion_activa, vencimiento_plan")
    .eq("suscripcion_activa", true)
    .not("vencimiento_plan", "is", null);

  if (perfilesError) {
    if (!isBillingSchemaMissing(perfilesError)) {
      result.errors.push(perfilesError.message);
    }
  } else {
    for (const perfil of perfiles ?? []) {
      result.scanned += 1;
      const vencimiento = perfil.vencimiento_plan as string;
      const dias = daysUntil(vencimiento, now);
      if (!(AVISO_DIAS_VENCIMIENTO as readonly number[]).includes(dias)) {
        result.skipped += 1;
        continue;
      }
      const sent = await alreadySent(admin, {
        userId: perfil.id,
        tipoPlan: "b2c",
        diasAntes: dias,
        vencimiento,
      });
      if (sent) {
        result.skipped += 1;
        continue;
      }
      const titulo =
        dias === 3
          ? "Tu SmartTaller Pro vence en 3 días"
          : "Tu SmartTaller Pro vence en 7 días";
      const cuerpo = `Renueva con Pago Móvil para no perder el historial independiente. Vence el ${new Date(vencimiento).toLocaleDateString("es-VE")}.`;
      await crearNotificacionUsuario({ userId: perfil.id, titulo, cuerpo });
      await markSent(admin, {
        userId: perfil.id,
        tallerId: null,
        tipoPlan: "b2c",
        diasAntes: dias,
        vencimiento,
        canal: "in_app",
      });
      result.enviados += 1;
    }
  }

  const { data: talleres, error: talleresError } = await admin
    .from("talleres")
    .select("id, nombre, owner_user_id, telegram_chat_id, suscripcion_activa, vencimiento_plan")
    .eq("suscripcion_activa", true)
    .not("vencimiento_plan", "is", null);

  if (talleresError) {
    if (isBillingSchemaMissing(talleresError)) {
      result.errors.push("Migración de pagos no aplicada; se omite el cron de talleres.");
    } else {
      result.errors.push(talleresError.message);
    }
    return result;
  }

  for (const taller of talleres ?? []) {
    result.scanned += 1;
    const vencimiento = taller.vencimiento_plan as string;
    const dias = daysUntil(vencimiento, now);
    if (!(AVISO_DIAS_VENCIMIENTO as readonly number[]).includes(dias)) {
      result.skipped += 1;
      continue;
    }
    const sent = await alreadySent(admin, {
      userId: taller.owner_user_id,
      tipoPlan: "taller",
      diasAntes: dias,
      vencimiento,
    });
    if (sent) {
      result.skipped += 1;
      continue;
    }

    const fecha = new Date(vencimiento).toLocaleDateString("es-VE");
    const titulo =
      dias === 3
        ? `El plan del taller vence en 3 días`
        : `El plan del taller vence en 7 días`;
    const cuerpo = `${taller.nombre}: ${PLANES_PAGO.taller.nombre} vence el ${fecha}. Renueva con Pago Móvil (${getAppBaseUrl()}/dashboard).`;
    await crearNotificacionUsuario({
      userId: taller.owner_user_id,
      titulo,
      cuerpo,
    });

    let canal = "in_app";
    if (typeof taller.telegram_chat_id === "number") {
      try {
        await sendTelegramMessage(taller.telegram_chat_id, `⏰ ${cuerpo}`);
        canal = "in_app+telegram";
      } catch (err) {
        result.errors.push(
          `telegram ${taller.id}: ${err instanceof Error ? err.message : "falló"}`
        );
      }
    }

    await markSent(admin, {
      userId: taller.owner_user_id,
      tallerId: taller.id,
      tipoPlan: "taller",
      diasAntes: dias,
      vencimiento,
      canal,
    });
    result.enviados += 1;
  }

  if (result.enviados > 0) {
    await notifyAdminTelegram(
      `⏰ Recordatorios de suscripción enviados: ${result.enviados} (escaneados ${result.scanned}).`
    );
  }

  return result;
}
