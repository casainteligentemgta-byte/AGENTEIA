/**
 * Fixture de QA: un expediente por fase de planilla (1–10).
 * La fase 3 no lleva BL para no duplicarse en embarque.
 */
import {
  esEnColaEmbarque,
  esPorCompletarEtapa,
  PLANILLA_FASES_PENDIENTES,
  type DashboardClasificacionFuente,
  type PlanillaFasePendiente,
} from "@/lib/importacion/dashboard-clasificacion";
import {
  PLANILLA_ETAPA_LABELS,
  type PlanillaEtapaNumero,
} from "@/lib/importacion/dashboard-completar-etapa";
import { DEMO_VEHICULO } from "@/lib/importacion/demo-plantillas";

export const DEMO_FASES = PLANILLA_FASES_PENDIENTES;

export type DemoFase = PlanillaEtapaNumero;

export const DEMO_FASE_COLORES: Record<DemoFase, string> = {
  1: "Rojo",
  2: "Azul",
  3: "Verde",
  4: "Amarillo",
  5: "Naranja",
  6: "Gris",
  7: "Blanco",
  8: "Negro",
  9: "Plateado",
  10: "Vino",
};

export const DEMO_FASE_FECHA_BUQUE = "2026-07-20";
export const DEMO_FASE_FECHA_INGRESO = "2026-08-15";
export const DEMO_FASE_PARTIDA = "8703.23.91";

function tallerHex(tallerId: string): string {
  return tallerId.replace(/-/g, "").toUpperCase();
}

/** VIN / serial estable por taller y fase (17 caracteres). */
export function demoFaseSerialFromTallerId(
  tallerId: string,
  fase: DemoFase
): string {
  const faseStr = String(fase);
  const hexLen = 13 - faseStr.length;
  const hex = tallerHex(tallerId).slice(0, hexLen).padEnd(hexLen, "0");
  return `FASE${hex}${faseStr}`;
}

export function demoFaseMotorFromTallerId(
  tallerId: string,
  fase: DemoFase
): string {
  const hex = tallerHex(tallerId).slice(0, 9).padEnd(9, "0");
  return `FSM${hex}${fase}`;
}

/** Solo embarque lleva BL, para no mezclar llegada con esa cola. */
export function demoFaseNumeroBlFromTallerId(
  tallerId: string,
  fase: DemoFase
): string | null {
  if (fase !== 2) return null;
  const hex = tallerHex(tallerId).slice(0, 6).padEnd(6, "0");
  return `FASE2${hex}`;
}

export type DemoFaseSpec = {
  fase: DemoFase;
  etiqueta: string;
  color: string;
  marca: string;
  modelo: string;
  anio: number;
  planillaFase: DemoFase;
  completitudDatos: "ambar" | "verde";
  datosPendientes: string[];
  registroCompleto: boolean;
  numeroBl: string | null;
  fechaLlegadaBuque: string | null;
  fechaIngreso: string | null;
  partidaArancelaria: string | null;
  observaciones: string;
};

export function demoFaseSpec(tallerId: string, fase: DemoFase): DemoFaseSpec {
  const etiqueta = PLANILLA_ETAPA_LABELS[fase];
  const enRegistro = fase === 1;
  return {
    fase,
    etiqueta,
    color: DEMO_FASE_COLORES[fase],
    marca: DEMO_VEHICULO.marca,
    modelo: DEMO_VEHICULO.modelo,
    anio: DEMO_VEHICULO.anio,
    planillaFase: fase,
    completitudDatos: enRegistro ? "ambar" : "verde",
    datosPendientes: enRegistro ? ["factura", "certificado"] : [],
    registroCompleto: false,
    numeroBl: demoFaseNumeroBlFromTallerId(tallerId, fase),
    fechaLlegadaBuque: fase >= 2 ? DEMO_FASE_FECHA_BUQUE : null,
    fechaIngreso: fase >= 3 ? DEMO_FASE_FECHA_INGRESO : null,
    partidaArancelaria: fase >= 3 ? DEMO_FASE_PARTIDA : null,
    observaciones: `Demo fase ${fase} — ${etiqueta}. Un expediente por cola; no mezclar con carga real.`,
  };
}

export function demoFaseSpecs(tallerId: string): DemoFaseSpec[] {
  return DEMO_FASES.map((fase) => demoFaseSpec(tallerId, fase));
}

export function dashboardFuenteDeDemoFase(
  spec: DemoFaseSpec
): DashboardClasificacionFuente {
  return {
    planillaFase: spec.planillaFase,
    fechaIngreso: spec.fechaIngreso,
    completitudDatos: spec.completitudDatos,
    registroCompleto: spec.registroCompleto,
    numeroBl: spec.numeroBl,
  };
}

/** Colas del dashboard donde aparece el expediente (misma lógica que la home). */
export function colasDashboardDe(
  v: DashboardClasificacionFuente
): PlanillaFasePendiente[] {
  const colas: PlanillaFasePendiente[] = [];
  if (esPorCompletarEtapa(v, 1)) colas.push(1);
  if (esEnColaEmbarque(v)) colas.push(2);
  for (const fase of [3, 4, 5, 6, 7, 8, 9, 10] as const) {
    if (esPorCompletarEtapa(v, fase)) colas.push(fase);
  }
  return colas;
}

