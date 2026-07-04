export const TIPOS_VEHICULO = [
  "auto",
  "moto",
  "bicicleta",
  "patinete",
  "tractor",
  "maquinaria_pesada",
  "jumbo",
] as const;

export type TipoVehiculo = (typeof TIPOS_VEHICULO)[number];

export type UnidadOdometro = "km" | "horas";

export type ModuloMantenimientoId =
  | "aceite"
  | "neumaticos"
  | "balanceo"
  | "rotacion"
  | "alineacion"
  | "bateria"
  | "fluidos"
  | "cadena"
  | "frenos"
  | "hidraulico"
  | "filtros"
  | "orugas";

export type ModuloMantenimiento = {
  id: ModuloMantenimientoId;
  label: string;
  descripcion?: string;
  disponibleDesdeVisita?: number;
};

export type ConfigTipoVehiculo = {
  tipo: TipoVehiculo;
  label: string;
  labelCorto: string;
  unidadOdometro: UnidadOdometro;
  ruedas: number;
  incluyeRepuesto: boolean;
  modulos: ModuloMantenimiento[];
};

export type TipoActivo = "carro" | "bici" | "maquinaria";

export type VehiculoUsuario = {
  id: string;
  tipo_vehiculo: TipoVehiculo;
  tipo_activo: TipoActivo | null;
  serial_alternativo: string | null;
  nick: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  placa: string;
  kilometraje_ultimo: number | null;
  horas_motor_ultimo: number | null;
  horometro_actual: number | null;
  unidad_odometro: UnidadOdometro;
  taller_id: string | null;
  created_at: string;
};
