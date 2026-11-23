import type { BrandTelegramCopy } from "@/lib/brand/types";

const HELP =
  "Comandos disponibles:\n\n" +
  "📷 /recepcion — foto frontal del vehículo (lee placa y abre inspección)\n" +
  "🔍 /inspeccion PLACA — abre planilla por placa escrita\n" +
  "📷 Foto de placa + pie de foto: inspeccion\n\n" +
  "🔗 Vincular taller: /vincular TU_CODIGO\n" +
  "(Código en Dashboard → Configuración)";

const INSPECCION_HINT =
  "Escribe la placa del vehículo:\n/inspeccion ABC123\n\n" +
  "O envía foto de la placa con pie de foto: inspeccion\n\n" +
  "Para foto frontal del vehículo usa: /recepcion";

const RECEPCION_PROMPT =
  "📷 Recepción de vehículo\n\n" +
  "Envía la foto frontal del vehículo (parachoques o portaplacas visible).\n\n" +
  "La IA leerá la placa y te enviará el enlace para completar la hoja de inspección en la app (fotos restantes + checklist).\n\n" +
  "Tienes 15 minutos para enviar la foto.";

export function smarttallerTelegramCopy(): BrandTelegramCopy {
  return {
    help: HELP,
    inspeccionHint: INSPECCION_HINT,
    recepcionPrompt: RECEPCION_PROMPT,
    vinculado: (tallerNombre) =>
      `✅ Taller "${tallerNombre}" vinculado correctamente.\n\n` +
      "• Recepción: /recepcion — envía foto frontal del vehículo\n" +
      "• Inspección rápida: /inspeccion PLACA",
    botLabel: "SmartTaller Bot",
  };
}

export function jacTelegramCopy(): BrandTelegramCopy {
  return {
    help:
      "JAC Taller\n\n" +
      "📷 /recepcion — foto de frente del carro (lee la placa y abre la inspección)\n" +
      "🔍 /inspeccion PLACA — abre la planilla con la placa escrita\n" +
      "📷 Foto de la placa + pie: inspeccion\n\n" +
      "🔗 Vincular taller: /vincular TU_CODIGO\n" +
      "(El código está en Configuración)",
    inspeccionHint:
      "Escribe la placa del carro:\n/inspeccion ABC123\n\n" +
      "O manda la foto de la placa con pie: inspeccion\n\n" +
      "Para la foto de frente usa: /recepcion",
    recepcionPrompt:
      "📷 Recepción del JAC\n\n" +
      "Manda la foto de frente del carro (parachoques o portaplacas a la vista).\n\n" +
      "Leemos la placa y te pasamos el enlace para terminar la hoja en la app.\n\n" +
      "Tienes 15 minutos.",
    vinculado: (tallerNombre) =>
      `✅ Taller "${tallerNombre}" ya está vinculado a JAC Taller.\n\n` +
      "• Recepción: /recepcion — foto de frente del carro\n" +
      "• Inspección rápida: /inspeccion PLACA",
    botLabel: "JAC Taller Bot",
  };
}
