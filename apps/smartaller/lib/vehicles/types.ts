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

export type VehiculoUsuario = {
  id: string;
  tipo_vehiculo: TipoVehiculo;
  nick: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  placa: string;
  kilometraje_ultimo: number | null;
  horas_motor_ultimo: number | null;
  unidad_odometro: UnidadOdometro;
  created_at: string;
};
