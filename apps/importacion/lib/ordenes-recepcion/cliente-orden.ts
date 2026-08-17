/** Valores válidos para Zod cuando el vehículo no tiene contacto completo en BD */
export function datosClienteOrdenRecepcion(
  nombre: string | null | undefined,
  telefono: string | null | undefined
): { clienteNombre: string; clienteTelefono: string } {
  const clienteNombre = nombre?.trim() || "Cliente";
  const digits = (telefono ?? "").replace(/\D/g, "");
  const clienteTelefono = digits.length >= 7 ? digits.slice(0, 20) : "0000000";
  return { clienteNombre, clienteTelefono };
}
