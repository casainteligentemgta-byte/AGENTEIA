/** Datos de la ficha del vehículo precargados en la hoja de inspección */
export type FichaVehiculoInspeccion = {
  placa: string;
  clienteNombre: string;
  clienteTelefono: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  chasis: string | null;
};

export function buildFichaVehiculoInspeccion(vehiculo: {
  placa: string;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serial_carroceria: string | null;
}): FichaVehiculoInspeccion {
  return {
    placa: vehiculo.placa,
    clienteNombre: vehiculo.nombre_cliente?.trim() || "—",
    clienteTelefono: vehiculo.telefono_cliente?.trim() || "—",
    marca: vehiculo.marca?.trim() || null,
    modelo: vehiculo.modelo?.trim() || null,
    color: vehiculo.color?.trim() || null,
    chasis: vehiculo.serial_carroceria?.trim() || null,
  };
}

export function etiquetaModeloVehiculo(ficha: FichaVehiculoInspeccion): string {
  const partes = [ficha.marca, ficha.modelo].filter(Boolean);
  return partes.length > 0 ? partes.join(" ") : "—";
}
