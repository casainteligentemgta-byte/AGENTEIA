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
  tipo_vehiculo: string | null;
  unidad_odometro: string | null;
  kilometraje_ultimo: number | null;
  horas_motor_ultimo: number | null;
  serial_motor: string | null;
  serial_carroceria: string | null;
  cedula_propietario: string | null;
  email_propietario: string | null;
  fecha_nacimiento_propietario: string | null;
  documentos: Record<string, unknown> | null;
  recepcion_inicial: Record<string, unknown> | null;
  ultima_orden_recepcion_id: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
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
