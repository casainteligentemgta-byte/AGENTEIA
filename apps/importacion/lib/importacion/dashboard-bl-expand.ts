/**
 * Mercancía de un BL: por defecto expandida.
 * El set guarda los ids contraídos.
 */
export function toggleCollapsedBlId(
  collapsed: ReadonlySet<string>,
  id: string
): Set<string> {
  const next = new Set(collapsed);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Visible si no está contraído, o si un filtro obliga a mostrar. */
export function blMercanciaExpandida(
  collapsed: ReadonlySet<string>,
  id: string,
  forceExpand = false
): boolean {
  if (forceExpand) return true;
  return !collapsed.has(id);
}
