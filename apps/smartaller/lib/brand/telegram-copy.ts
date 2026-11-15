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
    help: `JAC Taller\n\n${HELP}`,
    inspeccionHint: INSPECCION_HINT,
    recepcionPrompt: RECEPCION_PROMPT,
    vinculado: (tallerNombre) =>
      `✅ Taller "${tallerNombre}" vinculado a JAC Taller.\n\n` +
      "• Recepción: /recepcion — envía foto frontal del vehículo\n" +
      "• Inspección rápida: /inspeccion PLACA",
    botLabel: "JAC Taller Bot",
  };
}
