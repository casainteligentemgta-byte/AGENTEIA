/** El formulario escribe nombre_cliente; en DB también existe dueno_nombre. */
export function propietarioContactoColumns(nombre: string, telefono: string) {
  const nombreTrim = nombre.trim();
  const telefonoTrim = telefono.trim();
  return {
    nombre_cliente: nombreTrim,
    telefono_cliente: telefonoTrim,
    dueno_nombre: nombreTrim,
    dueno_telefono: telefonoTrim,
  };
}

export function anioActualMax(): number {
  return new Date().getFullYear() + 1;
}
