import {
  hasPortalRole,
  type PortalAccess,
  type PortalRole,
} from "@/lib/portal/roles";

/** Roles con acceso al módulo /smartimport. */
export const IMPORTACION_ROLES: PortalRole[] = [
  "master",
  "admin",
  "aduanera",
  "taller",
  "concesionario",
  "usuario",
];

/** Puede entrar al módulo (tras login). */
export function canAccessImportacion(access: PortalAccess | null): boolean {
  if (!access) return false;
  return IMPORTACION_ROLES.some((role) => hasPortalRole(access, role));
}

/**
 * Administrador máster: ve/modifica todo y supervisa (logs).
 * Requiere rol master + ver_todo (alcance global explícito).
 */
export function isMasterAdmin(access: PortalAccess): boolean {
  return hasPortalRole(access, "master") && access.verTodo;
}

/**
 * Administrador: ve y modifica toda la data (sin logs).
 * Alcance global con ver_todo, o talleres en taller_ids.
 */
export function isDataAdmin(access: PortalAccess): boolean {
  if (!hasPortalRole(access, "admin")) return false;
  return access.verTodo || access.tallerIds.length > 0;
}

/** Puede consultar el registro de ingresos (solo máster). */
export function canViewLoginLogs(access: PortalAccess | null): boolean {
  if (!access) return false;
  return isMasterAdmin(access);
}

/** Puede ver/modificar data de cualquier taller (máster o admin global). */
export function canAccessAllImportacionData(access: PortalAccess): boolean {
  if (isMasterAdmin(access)) return true;
  if (hasPortalRole(access, "admin") && access.verTodo) return true;
  if (hasPortalRole(access, "aduanera") && access.verTodo) return true;
  return false;
}

/**
 * Taller / concesionario: solo data de sus clientes (taller_ids).
 * No ven clientes de otros talleres o concesionarios.
 */
export function isTallerOrConcesionario(access: PortalAccess): boolean {
  return (
    hasPortalRole(access, "taller") || hasPortalRole(access, "concesionario")
  );
}

/** Puede cargar/modificar expedientes (no solo lectura de usuario). */
export function canMutateImportacionData(access: PortalAccess): boolean {
  if (isMasterAdmin(access) || isDataAdmin(access)) return true;
  if (hasPortalRole(access, "aduanera") && access.verTodo) return false;
  return isTallerOrConcesionario(access) && access.tallerIds.length > 0;
}

/**
 * Forzar avance de Fase 2 sin OCR de impronta (`no_leido`).
 * Misma barra que mutar data: admin/taller/concesionario — nunca usuario ni aduanera solo-lectura.
 * Debe aplicarse en Server Action; la UI solo oculta el checkbox.
 */
export function canForzarImprontaSinVerificar(access: PortalAccess): boolean {
  return canMutateImportacionData(access);
}

/** Usuario final: solo vehículos propios o compartidos. */
export function isImportacionUsuarioOnly(access: PortalAccess): boolean {
  if (isMasterAdmin(access) || isDataAdmin(access)) return false;
  if (isTallerOrConcesionario(access)) return false;
  if (hasPortalRole(access, "aduanera")) return false;
  return hasPortalRole(access, "usuario");
}

/** IDs de taller visibles en el módulo Importación. */
export function resolveImportacionTallerScope(access: PortalAccess): {
  all: boolean;
  ids: string[];
  usuarioOnly: boolean;
} {
  if (canAccessAllImportacionData(access)) {
    return { all: true, ids: [], usuarioOnly: false };
  }
  if (hasPortalRole(access, "admin") || hasPortalRole(access, "aduanera")) {
    return { all: false, ids: access.tallerIds, usuarioOnly: false };
  }
  if (isTallerOrConcesionario(access)) {
    return { all: false, ids: access.tallerIds, usuarioOnly: false };
  }
  return { all: false, ids: [], usuarioOnly: true };
}
