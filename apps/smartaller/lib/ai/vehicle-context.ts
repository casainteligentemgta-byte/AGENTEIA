import { getUserVehiculoById } from "@/lib/data/user-vehicles";
import { getResumenTallerVehiculo, type ResumenTallerVehiculo } from "@/lib/data/vehicle-history";
import {
  formatOdometro,
  getEtiquetaTipo,
  getEtiquetaVehiculo,
  getSubtituloVehiculo,
  getValorOdometro,
} from "@/lib/vehicles/format";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { buildVehicleHealthSummary, formatEstadoSalud } from "@/lib/vehicles/vehicle-health";
import type { VehiculoUsuario } from "@/lib/vehicles/types";

export type VehicleChatContext = {
  vehiculo: VehiculoUsuario;
  titulo: string;
  subtitulo: string | null;
  tipoLabel: string;
  odometroTexto: string;
  modulos: string[];
  resumen: ResumenTallerVehiculo;
  salud: ReturnType<typeof buildVehicleHealthSummary>;
};

function formatRecordatorio(
  fecha: string,
  kmObjetivo: number | null
): string {
  const fechaFmt = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(fecha));

  if (kmObjetivo != null) {
    return `${fechaFmt} · ${kmObjetivo.toLocaleString("es-CO")} km`;
  }
  return fechaFmt;
}

function formatHistorialResumido(resumen: ResumenTallerVehiculo): string {
  if (resumen.mantenimientos.length === 0) {
    return "Sin visitas registradas en taller vinculado.";
  }

  const lineas = resumen.mantenimientos.slice(0, 8).map((m, i) => {
    const fecha = new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(new Date(m.created_at));
    const servicio = m.descripcion_servicio || m.descripcion || "Servicio";
    const centro = m.taller_nombre ? ` · ${m.taller_nombre}` : "";
    const km = m.kilometraje != null ? ` · ${m.kilometraje.toLocaleString("es-CO")} km` : "";
    return `${i + 1}. ${fecha} — ${servicio}${centro}${km}`;
  });

  if (resumen.mantenimientos.length > 8) {
    lineas.push(`… y ${resumen.mantenimientos.length - 8} visita(s) más`);
  }

  return lineas.join("\n");
}

export async function buildVehicleChatContext(
  vehiculoId: string
): Promise<VehicleChatContext | null> {
  const vehiculo = await getUserVehiculoById(vehiculoId);
  if (!vehiculo) return null;

  const resumen = await getResumenTallerVehiculo(vehiculoId, vehiculo.placa);
  const config = getConfigTipoVehiculo(vehiculo.tipo_vehiculo);
  const odometro = getValorOdometro(vehiculo);
  const salud = buildVehicleHealthSummary(vehiculo.tipo_vehiculo, resumen, odometro);

  return {
    vehiculo,
    titulo: getEtiquetaVehiculo(vehiculo),
    subtitulo: getSubtituloVehiculo(vehiculo),
    tipoLabel: getEtiquetaTipo(vehiculo.tipo_vehiculo),
    odometroTexto: formatOdometro(odometro, vehiculo.unidad_odometro),
    modulos: config.modulos.map((m) => m.label),
    resumen,
    salud,
  };
}

export function formatVehicleContextBlock(context: VehicleChatContext): string {
  const { vehiculo, resumen } = context;
  const color = vehiculo.color?.trim() || "No registrado";
  const marca = vehiculo.marca?.trim() || "No registrada";
  const modelo = vehiculo.modelo?.trim() || "No registrado";
  const nick = vehiculo.nick?.trim() || "Sin apodo";

  const vinculacion = resumen.vinculado
    ? `Sincronizado con taller · ${resumen.totalVisitas} visita(s)`
    : "Sin historial de taller vinculado por placa";

  const ultimaVisita =
    resumen.ultimaVisita && resumen.ultimoCentro
      ? `${resumen.ultimaVisita} en ${resumen.ultimoCentro}${
          resumen.ultimaVisitaKm != null
            ? ` · ${resumen.ultimaVisitaKm.toLocaleString("es-CO")} km`
            : ""
        }`
      : "Sin visitas registradas";

  const recordatorio = resumen.proximoRecordatorio
    ? formatRecordatorio(
        resumen.proximoRecordatorio.fecha_programada,
        resumen.proximoRecordatorio.kilometraje_objetivo
      )
    : "Ninguno programado";

  const lineasSalud = context.salud.categorias
    .filter((c) => c.estado != null)
    .map((c) => `${c.label}: ${formatEstadoSalud(c.estado)}`);

  return [
    `Nombre / apodo: ${nick}`,
    `Tipo: ${context.tipoLabel}`,
    `Placa: ${vehiculo.placa}`,
    `Marca: ${marca}`,
    `Modelo: ${modelo}`,
    `Color: ${color}`,
    `Odómetro actual: ${context.odometroTexto}`,
    `Módulos de mantenimiento: ${context.modulos.join(", ")}`,
    `Estado taller: ${vinculacion}`,
    `Última visita: ${ultimaVisita}`,
    `Próximo recordatorio: ${recordatorio}`,
    lineasSalud.length > 0
      ? `Estado por categoría: ${lineasSalud.join("; ")}`
      : "Estado por categoría: sin datos suficientes",
    "",
    "Historial reciente:",
    formatHistorialResumido(resumen),
  ].join("\n");
}
