export const DIAGNOSTICOS_BUCKET = "diagnosticos";
export const RECEPCION_ESTADO_VISUAL_BUCKET = "recepcion-estado-visual";
export const VEHICULOS_DOCUMENTOS_BUCKET = "vehiculos-documentos";

export const PRIVATE_STORAGE_BUCKETS = [
  DIAGNOSTICOS_BUCKET,
  RECEPCION_ESTADO_VISUAL_BUCKET,
  VEHICULOS_DOCUMENTOS_BUCKET,
] as const;

export type PrivateStorageBucket = (typeof PRIVATE_STORAGE_BUCKETS)[number];

export function isPrivateStorageBucket(value: string): value is PrivateStorageBucket {
  return (PRIVATE_STORAGE_BUCKETS as readonly string[]).includes(value);
}
