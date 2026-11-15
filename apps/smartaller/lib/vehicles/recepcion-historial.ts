export const RECEPCION_HISTORIAL_LABEL = "Recepción / inspección";

const RECEPCION_TIPOS = new Set(["orden_recepcion", "recepcion", "inspeccion"]);

export function isRecepcionMantenimiento(m: {
  descripcion?: string | null;
  detalle_revision?: Record<string, unknown> | null;
}): boolean {
  const tipo = m.detalle_revision?.tipo;
  if (typeof tipo === "string" && RECEPCION_TIPOS.has(tipo)) return true;
  const text = (m.descripcion ?? "").toLowerCase();
  return /acta de recepci[oó]n|ingreso al taller|recepci[oó]n\s*\/\s*inspecci[oó]n/.test(
    text
  );
}

export function etiquetaHistorialMantenimiento(m: {
  descripcion?: string | null;
  detalle_revision?: Record<string, unknown> | null;
}): string {
  if (isRecepcionMantenimiento(m)) return RECEPCION_HISTORIAL_LABEL;
  const desc = m.descripcion?.trim();
  return desc && desc.length > 0 ? desc : "Servicio registrado";
}
