export const TIPOS_INDUSTRIA = ["concesionario", "bicicletas", "constructora"] as const;
export type TipoIndustria = (typeof TIPOS_INDUSTRIA)[number];

export const TIPOS_ACTIVO = ["carro", "bici", "maquinaria"] as const;
export type TipoActivo = (typeof TIPOS_ACTIVO)[number];

export const TIPOS_PLAN = ["free", "premium"] as const;
export type TipoPlan = (typeof TIPOS_PLAN)[number];

export const DESGASTE_CADENA_OPCIONES = [
  { value: "lt_0.5", label: "< 0.5%" },
  { value: "0.5_0.75", label: "0.5% – 0.75%" },
  { value: "gt_0.75", label: "> 0.75%" },
] as const;

export type DesgasteCadena = (typeof DESGASTE_CADENA_OPCIONES)[number]["value"];

export const ESTADO_MANGUERAS_OPCIONES = [
  { value: "ok", label: "OK" },
  { value: "desgaste", label: "Desgaste visible" },
  { value: "fuga", label: "Fuga / reemplazo urgente" },
] as const;

export type EstadoMangueras = (typeof ESTADO_MANGUERAS_OPCIONES)[number]["value"];

export type PerfilUsuario = {
  id: string;
  tipo_plan: TipoPlan;
  suscripcion_activa: boolean;
  vencimiento_plan: string | null;
  created_at: string;
  updated_at: string;
};

export const INDUSTRIA_LABELS: Record<TipoIndustria, string> = {
  concesionario: "Concesionario",
  bicicletas: "Tienda de bicicletas",
  constructora: "Constructora / maquinaria",
};
