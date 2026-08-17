"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import {
  crearOrdenRecepcionSchema,
  ordenRecepcionAltaSchema,
  tieneDatosOrdenRecepcion,
} from "@/lib/schemas/orden-recepcion";
import { persistOrdenRecepcion } from "@/lib/ordenes-recepcion/persist";
import { datosClienteOrdenRecepcion } from "@/lib/ordenes-recepcion/cliente-orden";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import type { TipoVehiculo } from "@/lib/vehicles/types";

const createOrdenRecepcionActionSchema = ordenRecepcionAltaSchema.extend({
  vehiculoId: z.string().uuid("Vehículo inválido"),
});

export type CreateOrdenRecepcionResult =
  | { ok: true; ordenId: string }
  | { ok: false; error: string };

export async function createOrdenRecepcionAction(
  raw: unknown
): Promise<CreateOrdenRecepcionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { ok: false, error: "No se encontró tu taller" };

  const parsed = createOrdenRecepcionActionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const { vehiculoId, ...ordenFields } = parsed.data;

  if (!tieneDatosOrdenRecepcion(ordenFields)) {
    return { ok: false, error: "Completa al menos un campo de la inspección" };
  }

  const supabase = createAdminClient();
  const { data: vehiculo, error: vehiculoError } = await supabase
    .from("vehiculos")
    .select(
      "id, placa, marca, modelo, color, serial_carroceria, nombre_cliente, telefono_cliente, tipo_vehiculo, taller_id"
    )
    .eq("id", vehiculoId)
    .eq("taller_id", taller.id)
    .maybeSingle();

  if (vehiculoError || !vehiculo) {
    return { ok: false, error: "Vehículo no encontrado" };
  }

  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);
  const { clienteNombre, clienteTelefono } = datosClienteOrdenRecepcion(
    vehiculo.nombre_cliente,
    vehiculo.telefono_cliente
  );

  const payloadResult = crearOrdenRecepcionSchema.safeParse({
    ...ordenFields,
    fechaIngreso: ordenFields.fechaIngreso || today,
    horaIngreso: ordenFields.horaIngreso || nowTime,
    vehiculoId,
    clienteNombre,
    clienteTelefono,
    placa: vehiculo.placa,
    modelo: vehiculo.modelo ?? "",
    color: vehiculo.color ?? "",
    chasis: vehiculo.serial_carroceria ?? "",
  });

  if (!payloadResult.success) {
    return {
      ok: false,
      error: payloadResult.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const payload = payloadResult.data;

  try {
    const { ordenId } = await persistOrdenRecepcion(supabase, {
      tallerId: taller.id,
      userId: user.id,
      orden: payload,
    });

    if (payload.kilometraje != null) {
      const config = getConfigTipoVehiculo(vehiculo.tipo_vehiculo as TipoVehiculo);
      await supabase
        .from("vehiculos")
        .update({
          ...(config.unidadOdometro === "km"
            ? { kilometraje_ultimo: payload.kilometraje }
            : { horas_motor_ultimo: payload.kilometraje }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", vehiculoId);
    }

    revalidatePath(`/dashboard/vehiculos/${vehiculoId}`);
    revalidatePath(`/dashboard/vehiculos/${vehiculoId}/inspeccion`);
    revalidatePath("/dashboard/vehiculos");

    return { ok: true, ordenId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo guardar la inspección";
    return { ok: false, error: message };
  }
}
