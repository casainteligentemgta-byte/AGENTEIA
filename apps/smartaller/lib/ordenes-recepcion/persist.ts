import type { createAdminClient } from "@/lib/supabase/admin";
import type { CrearOrdenRecepcionInput } from "@/lib/schemas/orden-recepcion";
import { marcaToDbValor } from "@/lib/schemas/orden-recepcion";
import { insertMantenimientoOrdenRecepcion } from "@/lib/ordenes-recepcion/insert-mantenimiento";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function normalizeHora(hora?: string): string | null {
  if (!hora?.trim()) return null;
  const parts = hora.trim().split(":");
  if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
  return hora.trim();
}

export async function persistOrdenRecepcion(
  supabase: SupabaseAdmin,
  params: {
    tallerId: string;
    userId: string | null;
    orden: CrearOrdenRecepcionInput;
  }
): Promise<{ ordenId: string; mantenimientoId: string }> {
  const { orden, tallerId, userId } = params;
  const now = new Date().toISOString();
  const fechaIngreso = orden.fechaIngreso?.trim() || new Date().toISOString().slice(0, 10);

  const { data: ordenRow, error: ordenError } = await supabase
    .from("ordenes_recepcion")
    .insert({
      taller_id: tallerId,
      vehiculo_id: orden.vehiculoId,
      created_by: userId,
      cliente_nombre: orden.clienteNombre.trim(),
      cliente_telefono: orden.clienteTelefono.trim(),
      placa: orden.placa.trim().toUpperCase(),
      modelo: orden.modelo?.trim() || null,
      color: orden.color?.trim() || null,
      chasis: orden.chasis?.trim() || null,
      kilometraje: orden.kilometraje ?? null,
      nivel_combustible: orden.nivelCombustible ?? null,
      fecha_ingreso: fechaIngreso,
      hora_ingreso: normalizeHora(orden.horaIngreso),
      llego_grua: orden.llegoGrua ?? false,
      vehiculo_sucio: orden.vehiculoSucio ?? false,
      estado_ingreso_notas: orden.estadoIngresoNotas?.trim() || null,
      motivo_visita: orden.motivoVisita?.trim() || null,
      autorizacion_propietario: orden.autorizacionPropietario ?? false,
      firma_cliente: orden.firmaCliente?.trim() || null,
      firma_asesor: orden.firmaAsesor?.trim() || null,
      firmado_cliente_at: orden.firmaCliente?.trim() ? now : null,
      firmado_asesor_at: orden.firmaAsesor?.trim() ? now : null,
      esquema_danos_meta: {
        version: 2,
        estadoVisual: orden.estadoVisual ?? { fotos: [] },
      },
      updated_at: now,
    })
    .select("id")
    .single();

  if (ordenError || !ordenRow) {
    throw new Error(ordenError?.message ?? "No se pudo crear la orden de recepción");
  }

  const checklistRows = orden.checklist
    .filter((c) => c.marca || (c.valor && c.valor !== "no_aplica"))
    .map((c) => ({
      orden_recepcion_id: ordenRow.id,
      item_id: c.itemId,
      valor: c.marca ? marcaToDbValor(c.marca) : c.valor!,
      notas: c.notas?.trim() || null,
    }));

  if (checklistRows.length > 0) {
    const { error: checklistError } = await supabase
      .from("orden_recepcion_checklist")
      .insert(checklistRows);
    if (checklistError) {
      throw new Error(checklistError.message);
    }
  }

  if (orden.danos.length > 0) {
    const { error: danosError } = await supabase.from("orden_recepcion_danos").insert(
      orden.danos.map((d) => ({
        orden_recepcion_id: ordenRow.id,
        vista: d.vista,
        zona_id: d.zonaId,
        tipo: d.tipo,
        posicion_x: d.posicionX,
        posicion_y: d.posicionY,
        notas: d.notas?.trim() || null,
      }))
    );
    if (danosError) {
      throw new Error(danosError.message);
    }
  }

  const descripcion =
    orden.motivoVisita?.trim() || "Acta de recepción — ingreso al taller";

  const detalleRevision: Record<string, unknown> = {
    tipo: "orden_recepcion",
    orden_recepcion_id: ordenRow.id,
  };
  if (orden.kilometraje != null) {
    detalleRevision.kilometraje = orden.kilometraje;
  }

  const mantenimientoRow: Record<string, unknown> = {
    taller_id: tallerId,
    vehiculo_id: orden.vehiculoId,
    placa: orden.placa.trim().toUpperCase(),
    descripcion,
    detalle_revision: detalleRevision,
  };

  const mantenimiento = await insertMantenimientoOrdenRecepcion(supabase, [
    { ...mantenimientoRow, kilometraje: orden.kilometraje ?? null },
    mantenimientoRow,
    {
      taller_id: tallerId,
      vehiculo_id: orden.vehiculoId,
      placa: orden.placa.trim().toUpperCase(),
      descripcion,
    },
  ]);

  await supabase
    .from("ordenes_recepcion")
    .update({ mantenimiento_id: mantenimiento.id, updated_at: now })
    .eq("id", ordenRow.id);

  const vehiculoUpdate = await supabase
    .from("vehiculos")
    .update({
      ultima_orden_recepcion_id: ordenRow.id,
      updated_at: now,
    })
    .eq("id", orden.vehiculoId);

  if (
    vehiculoUpdate.error &&
    (vehiculoUpdate.error.message.includes("ultima_orden_recepcion_id") ||
      vehiculoUpdate.error.message.includes("schema cache"))
  ) {
    await supabase
      .from("vehiculos")
      .update({ updated_at: now })
      .eq("id", orden.vehiculoId);
  }

  return { ordenId: ordenRow.id, mantenimientoId: mantenimiento.id };
}
