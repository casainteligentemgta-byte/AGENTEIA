import type { EstadoVisualVista } from "@/lib/schemas/estado-visual-recepcion";

export type InspeccionFotoPasoId = EstadoVisualVista;

export type InspeccionFotoPasoConfig = {
  id: InspeccionFotoPasoId;
  titulo: string;
  instruccion: string;
  escanearPlaca?: boolean;
  extraerKilometraje?: boolean;
  permitirAnotaciones?: boolean;
};

export const INSPECCION_FOTO_PASOS: InspeccionFotoPasoConfig[] = [
  {
    id: "frontal",
    titulo: "Foto frontal",
    instruccion:
      "Enfoca el parachoques o portaplacas frontal. La placa debe verse clara; evita logos y stickers. La IA la leerá para confirmar el vehículo.",
    escanearPlaca: true,
    permitirAnotaciones: true,
  },
  {
    id: "trasero",
    titulo: "Parte trasera",
    instruccion: "Fotografía la parte trasera del vehículo.",
    permitirAnotaciones: true,
  },
  {
    id: "lateral_izquierdo",
    titulo: "Lateral izquierdo",
    instruccion: "Fotografía el lado izquierdo completo.",
    permitirAnotaciones: true,
  },
  {
    id: "lateral_derecho",
    titulo: "Lateral derecho",
    instruccion: "Fotografía el lado derecho completo.",
    permitirAnotaciones: true,
  },
  {
    id: "tablero",
    titulo: "Tablero encendido",
    instruccion:
      "Enciende el motor y las luces. Fotografía el tablero con el kilometraje visible.",
    extraerKilometraje: true,
    permitirAnotaciones: false,
  },
];

export const PASO_PROTOCOLO = {
  id: "protocolo" as const,
  titulo: "Protocolo de inspección",
  instruccion: "Completa el checklist técnico, autorización y firmas según la hoja de inspección.",
};

export type InspeccionPasoId = InspeccionFotoPasoId | typeof PASO_PROTOCOLO.id;

export const TOTAL_PASOS = INSPECCION_FOTO_PASOS.length + 1;
