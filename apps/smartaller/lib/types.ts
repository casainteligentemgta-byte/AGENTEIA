export type Mantenimiento = {
  id: string;
  created_at: string;
  placa: string | null;
  kilometraje: number | null;
  descripcion: string | null;
  descripcion_servicio: string | null;
  costo: number | null;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  vehiculo_id: string | null;
  detalle_revision?: Record<string, unknown> | null;
};

export type Vehiculo = {
  id: string;
  placa: string;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  kilometraje_ultimo: number | null;
  created_at: string;
  updated_at: string;
};

export type Recordatorio = {
  id: string;
  vehiculo_id: string;
  mantenimiento_id: string | null;
  fecha_programada: string;
  kilometraje_objetivo: number | null;
  estado: "pendiente" | "enviado" | "completado" | "cancelado";
  created_at: string;
};

export type VehiculoConHistorial = Vehiculo & {
  mantenimientos: Mantenimiento[];
  recordatorios: Recordatorio[];
};

export type PresidenciaStats = {
  serviciosHoy: number;
  serviciosMes: number;
  vehiculosRegistrados: number;
  recordatoriosPendientes: number;
};

export type RecordatorioConPlaca = Recordatorio & {
  placa: string;
  nombre_cliente: string | null;
};
