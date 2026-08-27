import { z } from "zod";
import { PORTAL_ROLES, ROLES_CON_ALCANCE } from "@/lib/portal/catalog";
import { TIPOS_INDUSTRIA } from "@/lib/platform/types";

export { ROLES_CON_ALCANCE };

export const portalRoleSchema = z.enum(PORTAL_ROLES);

export const upsertPortalAccesoSchema = z.object({
  userId: z.string().uuid("Usuario inválido"),
  roles: z.array(portalRoleSchema).min(1, "Elige al menos un rol"),
  verTodo: z.boolean(),
  tallerIds: z.array(z.string().uuid()),
  orgNombre: z
    .string()
    .trim()
    .max(80, "Máximo 80 caracteres")
    .nullable(),
});

export const crearPortalAccesoPorEmailSchema = upsertPortalAccesoSchema
  .omit({ userId: true })
  .extend({
    email: z.string().trim().email("Correo inválido").max(254),
  });

export const updateTallerEtiquetaSchema = z.object({
  tallerId: z.string().uuid("Taller inválido"),
  tipoIndustria: z.enum(TIPOS_INDUSTRIA),
});

export type UpsertPortalAccesoInput = z.infer<typeof upsertPortalAccesoSchema>;
export type CrearPortalAccesoPorEmailInput = z.infer<
  typeof crearPortalAccesoPorEmailSchema
>;

export function mensajeAlcanceInsuficiente(
  roles: readonly string[],
  verTodo: boolean,
  tallerIds: readonly string[]
): string | null {
  const necesitaAlcance = roles.some((role) =>
    (ROLES_CON_ALCANCE as readonly string[]).includes(role)
  );
  if (necesitaAlcance && !verTodo && tallerIds.length === 0) {
    return "Master, administrador o aduanera necesitan ver_todo o al menos un taller asignado.";
  }
  return null;
}
