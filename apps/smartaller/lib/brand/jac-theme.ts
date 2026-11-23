export const JAC_SERVICE_THEME = {
  aceite: { bg: "#fff3d8", fg: "#c48412", bar: "#c48412" },
  neumaticos: { bg: "#e8eefe", fg: "#3b5bdb", barAlert: "#c45a12" },
  cauchos: { bg: "#e8eefe", fg: "#3b5bdb", barAlert: "#c45a12" },
  frenos: { bg: "#fde8ea", fg: "#c8141c", bar: "#c8141c" },
  bateria: { bg: "#e6f6ec", fg: "#1f8a4c", bar: "#1f8a4c" },
  alineacion: { bg: "#eee8fe", fg: "#5b3fd6", bar: "#5b3fd6" },
  fluidos: { bg: "#e5f5f6", fg: "#0e7c86", bar: "#0e7c86" },
  general: { bg: "#eceef3", fg: "#5b5b66", bar: "#5b5b66" },
} as const;

export type JacServiceId = keyof typeof JAC_SERVICE_THEME;

export const JAC_STATUS = {
  bien: { color: "#2f7d4a", labelKey: "bien" as const },
  atencion: { color: "#3b5bdb", labelKey: "atencion" as const },
  critico: { color: "#c45a12", labelKey: "critico" as const },
} as const;

export const JAC_CHIPS = {
  bahia: { bg: "#e6f6ec", fg: "#1f8a4c" },
  esperando: { bg: "#fff3d8", fg: "#9a5b00" },
  confirmada: { bg: "#e8eefe", fg: "#3b5bdb" },
  porConfirmar: { bg: "#eceef3", fg: "#5b5b66" },
} as const;

export const JAC_SERVICE_ORDER = [
  "aceite",
  "neumaticos",
  "frenos",
  "bateria",
  "alineacion",
  "fluidos",
] as const;

export function getJacServiceTheme(id: string) {
  if (id in JAC_SERVICE_THEME) {
    return JAC_SERVICE_THEME[id as JacServiceId];
  }
  return JAC_SERVICE_THEME.general;
}
