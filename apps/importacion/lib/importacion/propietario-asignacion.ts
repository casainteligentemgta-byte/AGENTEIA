import {
  parseImportacion,
  serializeImportacion,
  type ImportacionData,
} from "@/lib/schemas/vehiculo-documentos";

export type PropietarioDatosAsignacion = {
  nombre: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
};

export type VehiculoPropietarioPatch = {
  propietario_id: string;
  nombre_cliente: string;
  cedula_propietario: string | null;
  telefono_cliente: string | null;
  email_propietario: string | null;
  fecha_nacimiento_propietario: string | null;
  importacion: Record<string, unknown>;
};

/** Copia la ficha del propietario al expediente (sin avanzar la fase). */
export function vehiculoPatchFromPropietario(
  propietarioId: string,
  datos: PropietarioDatosAsignacion,
  importacionRaw: unknown
): VehiculoPropietarioPatch {
  const existing = parseImportacion(importacionRaw);
  const importacion: ImportacionData = {
    ...existing,
    compradorDireccion: datos.direccion ?? existing.compradorDireccion,
  };
  return {
    propietario_id: propietarioId,
    nombre_cliente: datos.nombre.trim(),
    cedula_propietario: datos.cedula,
    telefono_cliente: datos.telefono,
    email_propietario: datos.email,
    fecha_nacimiento_propietario: datos.fechaNacimiento,
    importacion: serializeImportacion(importacion),
  };
}
