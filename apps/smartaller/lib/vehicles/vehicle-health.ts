import type {
  MantenimientoHistorial,
  RecordatorioUsuario,
  ResumenTallerVehiculo,
} from "@/lib/data/vehicle-history";
import {
  CATEGORIAS_SALUD,
  type CategoriaSaludId,
  type EstadoSalud,
  parseDetalleRevision,
} from "@/lib/validations/detalle-revision";
import { palabrasParaCategoria } from "@/lib/vehicles/module-keywords";
import type { ConfigTipoVehiculo, TipoVehiculo } from "@/lib/vehicles/types";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";

const KM_ATENCION = 5000;
const KM_CRITICO = 7500;
const DIAS_ATENCION = 30;

export type FuenteEstadoSalud =
  | "categorias"
  | "legacy"
  | "recordatorio"
  | "heuristica"
  | null;

export type CategoriaSaludResumen = {
  id: CategoriaSaludId;
  label: string;
  estado: EstadoSalud | null;
  fechaRevision: string | null;
  notas: string | null;
  fuente: FuenteEstadoSalud;
};

export type VehicleHealthSummary = {
  categorias: CategoriaSaludResumen[];
  peorEstado: EstadoSalud | null;
  recordatoriosUrgentes: number;
};

const ETIQUETAS: Record<CategoriaSaludId, string> = {
  bateria: "Batería",
  neumaticos: "Neumáticos",
  aceite: "Aceite",
  general: "Revisión general",
};

const ORDEN_ESTADO: Record<EstadoSalud, number> = {
  critico: 3,
  atencion: 2,
  bien: 1,
};

function peorDe(...estados: (EstadoSalud | null | undefined)[]): EstadoSalud | null {
  const validos = estados.filter((e): e is EstadoSalud => e != null);
  if (validos.length === 0) return null;
  return validos.reduce((peor, actual) =>
    ORDEN_ESTADO[actual] > ORDEN_ESTADO[peor] ? actual : peor
  );
}

function estadoDesdeFecha(fechaIso: string): EstadoSalud {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaIso);
  fecha.setHours(0, 0, 0, 0);
  const diffDias = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return "critico";
  if (diffDias <= DIAS_ATENCION) return "atencion";
  return "bien";
}

function estadoDesdeKm(ultimoKm: number, actualKm: number): EstadoSalud | null {
  const diff = actualKm - ultimoKm;
  if (diff >= KM_CRITICO) return "critico";
  if (diff >= KM_ATENCION) return "atencion";
  if (diff >= 0) return "bien";
  return null;
}

function estadoDesdeVoltaje(voltaje: number): EstadoSalud {
  if (voltaje < 11.8) return "critico";
  if (voltaje < 12.4) return "atencion";
  return "bien";
}

function buscarUltimoMantenimientoCategoria(
  categoria: CategoriaSaludId,
  historial: MantenimientoHistorial[]
): MantenimientoHistorial | null {
  const palabras = palabrasParaCategoria(categoria);
  for (const m of historial) {
    const texto = `${m.descripcion ?? ""} ${m.descripcion_servicio ?? ""}`.toLowerCase();
    if (palabras.some((p) => texto.includes(p))) return m;
  }
  return null;
}

function buscarCategoriaEnHistorial(
  categoria: CategoriaSaludId,
  historial: MantenimientoHistorial[]
): { estado: EstadoSalud; fechaRevision: string | null; notas: string | null } | null {
  for (const m of historial) {
    const detalle = parseDetalleRevision(m.detalle_revision);
    const cat = detalle.categorias?.[categoria];
    if (cat?.estado) {
      return {
        estado: cat.estado,
        fechaRevision: cat.fecha_revision ?? m.created_at,
        notas: cat.notas ?? null,
      };
    }
  }
  return null;
}

function estadoLegacyBateria(historial: MantenimientoHistorial[]): {
  estado: EstadoSalud;
  notas: string | null;
} | null {
  for (const m of historial) {
    const detalle = parseDetalleRevision(m.detalle_revision);
    if (typeof detalle.voltaje_bateria === "number") {
      return {
        estado: estadoDesdeVoltaje(detalle.voltaje_bateria),
        notas: `${detalle.voltaje_bateria} V`,
      };
    }
  }
  return null;
}

function estadoDesdeRecordatorio(
  recordatorios: RecordatorioUsuario[]
): { estado: EstadoSalud; fechaRevision: string } | null {
  const pendientes = recordatorios
    .filter((r) => r.estado === "pendiente" || r.estado === "enviado")
    .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));

  const proximo = pendientes[0];
  if (!proximo) return null;

  return {
    estado: estadoDesdeFecha(proximo.fecha_programada),
    fechaRevision: proximo.fecha_programada,
  };
}

function estadoHeuristico(
  categoria: CategoriaSaludId,
  historial: MantenimientoHistorial[],
  kmActual: number | null
): { estado: EstadoSalud; fechaRevision: string | null } | null {
  const ultimo = buscarUltimoMantenimientoCategoria(categoria, historial);
  if (!ultimo) return null;

  if (kmActual != null && ultimo.kilometraje != null && categoria === "aceite") {
    const porKm = estadoDesdeKm(ultimo.kilometraje, kmActual);
    if (porKm) {
      return { estado: porKm, fechaRevision: ultimo.created_at };
    }
  }

  return { estado: "bien", fechaRevision: ultimo.created_at };
}

function categoriaAplicaATipo(categoria: CategoriaSaludId, tipo: TipoVehiculo): boolean {
  const config = getConfigTipoVehiculo(tipo);
  const modulosIds = config.modulos.map((m) => m.id);

  switch (categoria) {
    case "bateria":
      return modulosIds.includes("bateria");
    case "neumaticos":
      return modulosIds.includes("neumaticos");
    case "aceite":
      return modulosIds.includes("aceite");
    case "general":
      return true;
  }
}

function resolverCategoria(
  categoria: CategoriaSaludId,
  historial: MantenimientoHistorial[],
  recordatorios: RecordatorioUsuario[],
  kmActual: number | null
): CategoriaSaludResumen {
  const desdeJson = buscarCategoriaEnHistorial(categoria, historial);
  if (desdeJson) {
    return {
      id: categoria,
      label: ETIQUETAS[categoria],
      estado: desdeJson.estado,
      fechaRevision: desdeJson.fechaRevision,
      notas: desdeJson.notas,
      fuente: "categorias",
    };
  }

  if (categoria === "bateria") {
    const legacy = estadoLegacyBateria(historial);
    if (legacy) {
      return {
        id: categoria,
        label: ETIQUETAS[categoria],
        estado: legacy.estado,
        fechaRevision: null,
        notas: legacy.notas,
        fuente: "legacy",
      };
    }
  }

  if (categoria === "general") {
    const desdeRecordatorio = estadoDesdeRecordatorio(recordatorios);
    if (desdeRecordatorio) {
      return {
        id: categoria,
        label: ETIQUETAS[categoria],
        estado: desdeRecordatorio.estado,
        fechaRevision: desdeRecordatorio.fechaRevision,
        notas: null,
        fuente: "recordatorio",
      };
    }
  }

  const heuristico = estadoHeuristico(categoria, historial, kmActual);
  if (heuristico) {
    return {
      id: categoria,
      label: ETIQUETAS[categoria],
      estado: heuristico.estado,
      fechaRevision: heuristico.fechaRevision,
      notas: null,
      fuente: "heuristica",
    };
  }

  return {
    id: categoria,
    label: ETIQUETAS[categoria],
    estado: null,
    fechaRevision: null,
    notas: null,
    fuente: null,
  };
}

export function buildVehicleHealthSummary(
  tipoVehiculo: TipoVehiculo,
  resumen: ResumenTallerVehiculo,
  kmActual: number | null
): VehicleHealthSummary {
  const categoriasAplicables = CATEGORIAS_SALUD.filter((c) =>
    categoriaAplicaATipo(c, tipoVehiculo)
  );

  const categorias = categoriasAplicables.map((c) =>
    resolverCategoria(c, resumen.mantenimientos, resumen.recordatoriosPendientes, kmActual)
  );

  const peorEstado = peorDe(...categorias.map((c) => c.estado));

  const recordatoriosUrgentes = resumen.recordatoriosPendientes.filter((r) => {
    if (r.estado !== "pendiente" && r.estado !== "enviado") return false;
    const estado = estadoDesdeFecha(r.fecha_programada);
    return estado === "critico" || estado === "atencion";
  }).length;

  return { categorias, peorEstado, recordatoriosUrgentes };
}

export function getConfigParaSalud(tipoVehiculo: TipoVehiculo): ConfigTipoVehiculo {
  return getConfigTipoVehiculo(tipoVehiculo);
}

export function formatEstadoSalud(estado: EstadoSalud | null): string {
  switch (estado) {
    case "bien":
      return "Bien";
    case "atencion":
      return "Atención";
    case "critico":
      return "Crítico";
    default:
      return "Sin datos";
  }
}
