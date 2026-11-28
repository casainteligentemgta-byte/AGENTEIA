import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import {
  getOrEnsurePerfil,
  usuarioTieneVehiculoTaller,
} from "@/lib/data/perfil";
import type { PerfilUsuario } from "@/lib/platform/types";
import {
  diasRestantesVencimiento,
  suscripcionEstaVigente,
} from "@/lib/billing/periodo";
import { isBillingSchemaMissing } from "@/lib/billing/schema";

export type AccesoB2c = {
  perfil: PerfilUsuario | null;
  suscripcionPagada: boolean;
  exonerado: boolean;
  vinculadoTaller: boolean;
  permitido: boolean;
  vencimiento: string | null;
  diasRestantes: number | null;
};

export type AccesoTaller = {
  tallerId: string | null;
  suscripcionPagada: boolean;
  exonerado: boolean;
  permitido: boolean;
  schemaReady: boolean;
  vencimiento: string | null;
  diasRestantes: number | null;
};

async function perfilExonerado(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("exoneraciones_suscripcion")
      .select("id, vigente_hasta")
      .eq("tipo", "perfil")
      .eq("perfil_id", userId)
      .eq("activa", true)
      .maybeSingle();
    if (error) {
      if (!isBillingSchemaMissing(error)) {
        console.error("perfilExonerado:", error.message);
      }
      return false;
    }
    if (!data) return false;
    if (!data.vigente_hasta) return true;
    return new Date(data.vigente_hasta) > new Date();
  } catch {
    return false;
  }
}

async function tallerClientesExonerado(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: vehiculos, error: vehiculosError } = await admin
      .from("vehiculos")
      .select("taller_id")
      .eq("user_id", userId)
      .not("taller_id", "is", null);
    if (vehiculosError || !vehiculos?.length) return false;
    const tallerIds = [
      ...new Set(
        vehiculos
          .map((row) => row.taller_id)
          .filter((id): id is string => typeof id === "string")
      ),
    ];
    if (tallerIds.length === 0) return false;
    const { data, error } = await admin
      .from("exoneraciones_suscripcion")
      .select("id, vigente_hasta")
      .eq("tipo", "taller_clientes")
      .eq("activa", true)
      .in("taller_id", tallerIds);
    if (error) {
      if (!isBillingSchemaMissing(error)) {
        console.error("tallerClientesExonerado:", error.message);
      }
      return false;
    }
    return (data ?? []).some((row) => {
      if (!row.vigente_hasta) return true;
      return new Date(row.vigente_hasta) > new Date();
    });
  } catch {
    return false;
  }
}

export async function getAccesoB2c(): Promise<AccesoB2c> {
  const [perfil, vinculadoTaller, user] = await Promise.all([
    getOrEnsurePerfil(),
    usuarioTieneVehiculoTaller(),
    getUser(),
  ]);
  const suscripcionPagada = perfil
    ? suscripcionEstaVigente(perfil.suscripcion_activa, perfil.vencimiento_plan)
    : false;
  let exonerado = false;
  if (user) {
    const [perfilEx, tallerEx] = await Promise.all([
      perfilExonerado(user.id),
      tallerClientesExonerado(user.id),
    ]);
    exonerado = perfilEx || tallerEx;
  }
  const permitido = vinculadoTaller || suscripcionPagada || exonerado;
  const vencimiento = suscripcionPagada ? perfil?.vencimiento_plan ?? null : null;
  return {
    perfil,
    suscripcionPagada,
    exonerado,
    vinculadoTaller,
    permitido,
    vencimiento,
    diasRestantes: diasRestantesVencimiento(vencimiento),
  };
}

async function tallerExonerado(tallerId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("exoneraciones_suscripcion")
      .select("id, vigente_hasta")
      .eq("tipo", "taller")
      .eq("taller_id", tallerId)
      .eq("activa", true)
      .maybeSingle();
    if (error) {
      if (!isBillingSchemaMissing(error)) {
        console.error("tallerExonerado:", error.message);
      }
      return false;
    }
    if (!data) return false;
    if (!data.vigente_hasta) return true;
    return new Date(data.vigente_hasta) > new Date();
  } catch {
    return false;
  }
}

export async function getAccesoTaller(tallerId: string | null): Promise<AccesoTaller> {
  const empty: AccesoTaller = {
    tallerId,
    suscripcionPagada: false,
    exonerado: false,
    permitido: false,
    schemaReady: false,
    vencimiento: null,
    diasRestantes: null,
  };
  if (!tallerId) return empty;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("talleres")
      .select("id, suscripcion_activa, vencimiento_plan")
      .eq("id", tallerId)
      .maybeSingle();

    if (error) {
      if (isBillingSchemaMissing(error)) {
        return { ...empty, permitido: true, schemaReady: false };
      }
      console.error("getAccesoTaller:", error.message);
      return empty;
    }
    if (!data) return empty;

    const suscripcionPagada = suscripcionEstaVigente(
      Boolean(data.suscripcion_activa),
      data.vencimiento_plan as string | null
    );
    const exonerado = await tallerExonerado(tallerId);
    const vencimiento = (data.vencimiento_plan as string | null) ?? null;
    return {
      tallerId,
      suscripcionPagada,
      exonerado,
      permitido: suscripcionPagada || exonerado,
      schemaReady: true,
      vencimiento: suscripcionPagada || exonerado ? vencimiento : vencimiento,
      diasRestantes: diasRestantesVencimiento(vencimiento),
    };
  } catch {
    return { ...empty, permitido: true, schemaReady: false };
  }
}
