/**
 * Mientras la app está en construcción, SENIAT y «por nacionalizar»
 * abren la planilla aunque falten recaudos.
 * Poner en `false` para volver al flujo anterior:
 * SENIAT → /nacionalizar · nacionalizar no abre la planilla si faltan recaudos.
 */
export const PLANILLA_PREVIEW_EN_CONSTRUCCION = true;

export function hrefPlanillaPreview(vehiculoId: string): string {
  return `/smartimport/${vehiculoId.trim()}/planilla?preview=1`;
}

export function hrefPresentacionSeniat(vehiculoId: string): string {
  const id = vehiculoId.trim();
  if (PLANILLA_PREVIEW_EN_CONSTRUCCION) {
    return hrefPlanillaPreview(id);
  }
  return `/smartimport/${id}/nacionalizar`;
}

export function seniatAccionLabel(): "Previsualizar" | "Gestionar" {
  return PLANILLA_PREVIEW_EN_CONSTRUCCION ? "Previsualizar" : "Gestionar";
}

export function hrefNacionalizar(vehiculoId: string): string {
  const id = vehiculoId.trim();
  if (PLANILLA_PREVIEW_EN_CONSTRUCCION) {
    return hrefPlanillaPreview(id);
  }
  return `/smartimport/${id}/nacionalizar`;
}

export function nacionalizarAccionLabel(): "Previsualizar" | "Nacionalizar" {
  return PLANILLA_PREVIEW_EN_CONSTRUCCION ? "Previsualizar" : "Nacionalizar";
}
