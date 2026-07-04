import type { TipoVehiculo, UnidadOdometro, VehiculoUsuario } from "@/lib/vehicles/types";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";

export function formatOdometro(
  valor: number | null,
  unidad: UnidadOdometro
): string {
  if (valor == null) return "—";
  if (unidad === "horas") {
    return `${valor.toLocaleString("es-CO")} h`;
  }
  return `${valor.toLocaleString("es-CO")} km`;
}

export function getEtiquetaVehiculo(vehiculo: Pick<VehiculoUsuario, "nick" | "tipo_vehiculo" | "placa">): string {
  if (vehiculo.nick?.trim()) return vehiculo.nick.trim();
  const config = getConfigTipoVehiculo(vehiculo.tipo_vehiculo);
  return `${config.labelCorto} ${vehiculo.placa}`;
}

export function getSubtituloVehiculo(
  vehiculo: Pick<VehiculoUsuario, "marca" | "modelo" | "color">
): string | null {
  const partes = [vehiculo.marca, vehiculo.modelo].filter(Boolean);
  const base = partes.join(" — ");
  if (base && vehiculo.color) return `${base} · ${vehiculo.color}`;
  return base || vehiculo.color || null;
}

export function getValorOdometro(vehiculo: Pick<VehiculoUsuario, "kilometraje_ultimo" | "horas_motor_ultimo" | "unidad_odometro">): number | null {
  if (vehiculo.unidad_odometro === "horas") {
    return vehiculo.horas_motor_ultimo;
  }
  return vehiculo.kilometraje_ultimo;
}

export function getEtiquetaTipo(tipo: TipoVehiculo): string {
  return getConfigTipoVehiculo(tipo).label;
}
