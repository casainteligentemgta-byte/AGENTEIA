/**
 * Destinos de los relojes y colas SENIAT / nacionalizar.
 * La planilla en preview queda solo como atajo interno.
 */
export const PLANILLA_PREVIEW_EN_CONSTRUCCION = false;

export function hrefPlanillaPreview(vehiculoId: string): string {
  return `/smartimport/${vehiculoId.trim()}/planilla?preview=1`;
}

export function hrefPresentacionSeniat(vehiculoId: string): string {
  return `/smartimport/${vehiculoId.trim()}/seniat`;
}

export function seniatAccionLabel(): "Previsualizar" | "Gestionar" {
  return "Gestionar";
}

export function hrefNacionalizar(vehiculoId: string): string {
  return `/smartimport/${vehiculoId.trim()}/nacionalizar`;
}

export function nacionalizarAccionLabel(): "Previsualizar" | "Nacionalizar" {
  return "Nacionalizar";
}
