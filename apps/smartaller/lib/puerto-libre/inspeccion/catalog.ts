export type TransportistaSeccion =
  | "datos_recepcion"
  | "estado_exterior"
  | "inventario"
  | "evidencia"
  | "observaciones";

export type TransportistaChecklistItem = {
  id: string;
  seccion: TransportistaSeccion;
  etiqueta: string;
  orden: number;
  /** Si true, es campo de texto libre en la planilla digital */
  esTexto?: boolean;
};

export const TRANSPORTISTA_SECCION_LABELS: Record<TransportistaSeccion, string> = {
  datos_recepcion: "Datos de recepción (transportista)",
  estado_exterior: "Estado exterior al recibir",
  inventario: "Inventario / elementos entregados",
  evidencia: "Evidencia fotográfica / verificación",
  observaciones: "Observaciones",
};

/**
 * Planilla de inspección al recibir el vehículo en la transportista (Puerto Libre).
 * Distinta de la inspección de ingreso al taller.
 */
export const TRANSPORTISTA_CHECKLIST: TransportistaChecklistItem[] = [
  // Datos recepción — textos en form, ticks aquí como verificación
  { id: "rec_guia_bl", seccion: "datos_recepcion", etiqueta: "Coincide guía / BL con el vehículo", orden: 10 },
  { id: "rec_placa_vin", seccion: "datos_recepcion", etiqueta: "Placa / VIN verificados vs documentos", orden: 20 },
  { id: "rec_precintos", seccion: "datos_recepcion", etiqueta: "Precintos / sellos íntegros (si aplica)", orden: 30 },
  { id: "rec_hora_llegada", seccion: "datos_recepcion", etiqueta: "Hora de llegada registrada", orden: 40 },

  // Estado exterior
  { id: "ext_frontal", seccion: "estado_exterior", etiqueta: "Frontal sin daños nuevos visibles", orden: 10 },
  { id: "ext_trasero", seccion: "estado_exterior", etiqueta: "Trasero sin daños nuevos visibles", orden: 20 },
  { id: "ext_lat_izq", seccion: "estado_exterior", etiqueta: "Lateral izquierdo OK", orden: 30 },
  { id: "ext_lat_der", seccion: "estado_exterior", etiqueta: "Lateral derecho OK", orden: 40 },
  { id: "ext_techo", seccion: "estado_exterior", etiqueta: "Techo / capot OK", orden: 50 },
  { id: "ext_cristales", seccion: "estado_exterior", etiqueta: "Cristales / parabrisas OK", orden: 60 },
  { id: "ext_llantas", seccion: "estado_exterior", etiqueta: "Llantas / rines OK", orden: 70 },
  { id: "ext_luces", seccion: "estado_exterior", etiqueta: "Luces exteriores OK", orden: 80 },
  { id: "ext_fuga", seccion: "estado_exterior", etiqueta: "Sin fugas visibles de fluidos", orden: 90 },

  // Inventario
  { id: "inv_llaves", seccion: "inventario", etiqueta: "Llaves entregadas", orden: 10 },
  { id: "inv_control", seccion: "inventario", etiqueta: "Control / alarma", orden: 20 },
  { id: "inv_manuales", seccion: "inventario", etiqueta: "Manuales", orden: 30 },
  { id: "inv_repuesto", seccion: "inventario", etiqueta: "Goma de repuesto", orden: 40 },
  { id: "inv_gato", seccion: "inventario", etiqueta: "Gato / herramientas", orden: 50 },
  { id: "inv_triangulo", seccion: "inventario", etiqueta: "Triángulo / kit seguridad", orden: 60 },
  { id: "inv_documentos", seccion: "inventario", etiqueta: "Documentos del vehículo en carpeta", orden: 70 },
  { id: "inv_accesorios", seccion: "inventario", etiqueta: "Accesorios declarados presentes", orden: 80 },

  // Evidencia
  { id: "evi_frontal", seccion: "evidencia", etiqueta: "Foto frontal tomada", orden: 10 },
  { id: "evi_trasera", seccion: "evidencia", etiqueta: "Foto trasera tomada", orden: 20 },
  { id: "evi_laterales", seccion: "evidencia", etiqueta: "Fotos laterales tomadas", orden: 30 },
  { id: "evi_vin", seccion: "evidencia", etiqueta: "Foto VIN / chasis tomada", orden: 40 },
  { id: "evi_odometro", seccion: "evidencia", etiqueta: "Foto odómetro / tablero tomada", orden: 50 },
  { id: "evi_danos", seccion: "evidencia", etiqueta: "Daños existentes fotografiados (si hay)", orden: 60 },
];

export function transportistaPorSeccion(seccion: TransportistaSeccion) {
  return TRANSPORTISTA_CHECKLIST.filter((i) => i.seccion === seccion).sort(
    (a, b) => a.orden - b.orden
  );
}

export const TRANSPORTISTA_SECCIONES: TransportistaSeccion[] = [
  "datos_recepcion",
  "estado_exterior",
  "inventario",
  "evidencia",
];
