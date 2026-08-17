import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend-client";
import { buildAlertaDeadlineNacionalizacionEmail } from "@/lib/email/templates/alerta-deadline-nacionalizacion";
import { buildAlertaVencimientoSeguroEmail } from "@/lib/email/templates/alerta-vencimiento-seguro";
import {
  diasHasta,
  parseImportacion,
  parseSeguro,
  serializeImportacion,
  type ImportacionData,
} from "@/lib/schemas/vehiculo-documentos";
import {
  placaRealVisible,
  resolveCodigoExpediente,
} from "@/lib/importacion/expediente";

const DEADLINE_VENTANA_DIAS = 90;
const SEGURO_VENTANA_DIAS = 30;
/** No reenviar la misma alerta si ya se envió en los últimos N días. */
const COOLDOWN_DIAS = 30;

export type AlertasVencimientoResult = {
  scanned: number;
  deadlineSent: number;
  seguroSent: number;
  skipped: number;
  errors: string[];
};

function daysSinceIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    const now = Date.now();
    return Math.floor((now - t) / 86_400_000);
  }
  const then = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - then) / 86_400_000);
}

function canSendAgain(lastSent: string | null | undefined): boolean {
  const since = daysSinceIso(lastSent);
  if (since == null) return true;
  return since >= COOLDOWN_DIAS;
}

function collectRecipients(imp: ImportacionData, tallerEmail: string | null): string[] {
  const out: string[] = [];
  const importador = imp.importadorEmail?.trim();
  if (importador && importador.includes("@")) out.push(importador);
  if (tallerEmail && tallerEmail.includes("@") && !out.includes(tallerEmail)) {
    out.push(tallerEmail);
  }
  return out;
}

/**
 * Escanea vehículos PL y envía alertas de deadline (90d) y seguro (30d).
 * Usa service role (cron). Marca timestamps en JSONB importacion para cooldown.
 */
export async function procesarAlertasVencimientoImportacion(): Promise<AlertasVencimientoResult> {
  const admin = createAdminClient();
  const result: AlertasVencimientoResult = {
    scanned: 0,
    deadlineSent: 0,
    seguroSent: 0,
    skipped: 0,
    errors: [],
  };

  const { data, error } = await admin
    .from("vehiculos")
    .select(
      "id, placa, serial_carroceria, taller_id, importacion, seguro, nombre_cliente"
    )
    .not("importacion", "is", null)
    .limit(2000);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const tallerIds = [
    ...new Set(
      (data ?? [])
        .map((r) => r.taller_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const tallerEmailById = new Map<string, string | null>();
  if (tallerIds.length > 0) {
    const { data: talleres } = await admin
      .from("talleres")
      .select("id, owner_user_id")
      .in("id", tallerIds);

    const ownerIds = [
      ...new Set(
        (talleres ?? [])
          .map((t) => t.owner_user_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const emailByUser = new Map<string, string>();
    for (const uid of ownerIds) {
      try {
        const { data: userData, error: userErr } =
          await admin.auth.admin.getUserById(uid);
        if (userErr) continue;
        const email = userData.user?.email?.trim() ?? null;
        if (email) emailByUser.set(uid, email);
      } catch {
        // Sin acceso Admin Auth API: solo email de importador.
      }
    }

    for (const t of talleres ?? []) {
      const tid = t.id as string;
      const oid = t.owner_user_id as string | null;
      tallerEmailById.set(tid, oid ? emailByUser.get(oid) ?? null : null);
    }
  }

  const nowIso = new Date().toISOString();

  for (const row of data ?? []) {
    result.scanned += 1;
    const id = row.id as string;
    const tallerId = row.taller_id as string | null;
    const imp = parseImportacion(row.importacion);
    const seg = parseSeguro(row.seguro);
    const codigo = resolveCodigoExpediente({
      codigoExpediente: imp.codigoExpediente,
      placa: row.placa as string | null,
    });
    const placa =
      placaRealVisible(row.placa as string | null, codigo) ??
      (row.placa as string | null) ??
      "";

    const recipients = collectRecipients(
      imp,
      tallerId ? tallerEmailById.get(tallerId) ?? null : null
    );

    let nextImp: ImportacionData = { ...imp };
    let dirty = false;

    // 1) Deadline nacionalización
    const estadoNac = imp.estadoNacionalizacion ?? "pendiente";
    const diasDeadline = diasHasta(imp.fechaLimiteNacionalizacion);
    const deadlineEligible =
      estadoNac !== "nacionalizado" &&
      estadoNac !== "no_aplica" &&
      diasDeadline != null &&
      diasDeadline <= DEADLINE_VENTANA_DIAS &&
      canSendAgain(imp.ultimaAlertaDeadlineEnviada);

    if (deadlineEligible && recipients.length > 0 && imp.fechaLimiteNacionalizacion) {
      const email = buildAlertaDeadlineNacionalizacionEmail({
        destinatarioNombre: imp.importadorNombre ?? row.nombre_cliente,
        placa,
        codigoExpediente: codigo,
        serialCarroceria: (row.serial_carroceria as string | null) ?? null,
        fechaLimite: imp.fechaLimiteNacionalizacion.slice(0, 10),
        diasRestantes: diasDeadline!,
        vehiculoId: id,
      });
      const sent = await sendResendEmail({
        to: recipients,
        subject: email.subject,
        html: email.html,
      });
      if (sent.ok) {
        nextImp = {
          ...nextImp,
          ultimaAlertaDeadlineEnviada: nowIso,
        };
        dirty = true;
        result.deadlineSent += 1;
      } else if (sent.skipped) {
        result.skipped += 1;
      } else {
        result.errors.push(`${id} deadline: ${sent.error}`);
      }
    }

    // 2) Seguro vigencia
    const diasSeguro = diasHasta(seg.vigenciaHasta);
    const seguroEligible =
      diasSeguro != null &&
      diasSeguro <= SEGURO_VENTANA_DIAS &&
      canSendAgain(imp.ultimaAlertaSeguroEnviada);

    if (seguroEligible && recipients.length > 0 && seg.vigenciaHasta) {
      const email = buildAlertaVencimientoSeguroEmail({
        destinatarioNombre: imp.importadorNombre ?? row.nombre_cliente,
        placa,
        codigoExpediente: codigo,
        vigenciaHasta: seg.vigenciaHasta.slice(0, 10),
        diasRestantes: diasSeguro!,
        vehiculoId: id,
        aseguradora: seg.aseguradora,
      });
      const sent = await sendResendEmail({
        to: recipients,
        subject: email.subject,
        html: email.html,
      });
      if (sent.ok) {
        nextImp = {
          ...nextImp,
          ultimaAlertaSeguroEnviada: nowIso,
        };
        dirty = true;
        result.seguroSent += 1;
      } else if (sent.skipped) {
        result.skipped += 1;
      } else {
        result.errors.push(`${id} seguro: ${sent.error}`);
      }
    }

    if (dirty) {
      const { error: updErr } = await admin
        .from("vehiculos")
        .update({
          importacion: serializeImportacion(nextImp),
          updated_at: nowIso,
        })
        .eq("id", id);
      if (updErr) {
        result.errors.push(`${id} persist: ${updErr.message}`);
      }
    }
  }

  return result;
}
