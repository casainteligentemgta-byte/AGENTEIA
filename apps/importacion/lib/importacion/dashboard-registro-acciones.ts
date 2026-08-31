export type DashboardAccionTone = "cyan" | "red" | "sky" | "amber" | "green";

export type DashboardRegistroAccion = {
  label: string;
  href: string;
  tone: DashboardAccionTone;
};

function datoRegistroLleno(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return Boolean(v) && !/^POR-COMPLETAR$/i.test(v);
}

export function registroDatosCompletos(input: {
  completitudDatos?: "rojo" | "ambar" | "verde" | null;
  datosPendientes?: string[];
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
}): boolean {
  if (input.completitudDatos === "verde") return true;
  if (input.completitudDatos === "rojo" || input.completitudDatos === "ambar") {
    return false;
  }
  if ((input.datosPendientes ?? []).length > 0) return false;
  return (
    datoRegistroLleno(input.marca) &&
    datoRegistroLleno(input.modelo) &&
    datoRegistroLleno(input.color)
  );
}

/** Semáforo de Completar cuando aún faltan datos de registro. */
export function tonoCompletarRegistro(
  completitudDatos: "rojo" | "ambar" | "verde" | null | undefined
): DashboardAccionTone {
  if (completitudDatos === "rojo") return "red";
  if (completitudDatos === "ambar") return "amber";
  return "cyan";
}

/**
 * Fase 1: si los datos del vehículo están verdes no hace falta «Completar».
 * Registrar (fase 1) en verde y Embarque (fase 2) en rojo.
 */
export function accionesRegistroDashboard(params: {
  vehiculoId: string;
  completitudDatos?: "rojo" | "ambar" | "verde" | null;
  datosPendientes?: string[];
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
}): DashboardRegistroAccion[] {
  const id = params.vehiculoId;
  if (registroDatosCompletos(params)) {
    return [
      {
        label: "Registrar",
        href: `/smartimport/${id}/planilla?fase=1`,
        tone: "green",
      },
      {
        label: "Embarque",
        href: `/smartimport/${id}/planilla?fase=2`,
        tone: "red",
      },
    ];
  }
  return [
    {
      label: "Completar",
      href: `/smartimport/${id}/planilla?fase=1`,
      tone: tonoCompletarRegistro(params.completitudDatos),
    },
  ];
}
