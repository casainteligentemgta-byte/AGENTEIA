"use server";

import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { isLlmConfigured, formatLlmAuthError } from "@/lib/ai/openai-config";
import {
  assertLlmBudgetAllows,
  bindLlmUsageContext,
} from "@/lib/ai/llm-usage";
import { resolveImageMimeType } from "@/lib/mime-image";
import {
  blToFormFields,
  countFilledFields,
  extractBlFromDocument,
  extractCertificadoOrigenMultiFromDocument,
  extractFacturaMultiFromDocument,
  extractPolizaTransporteFromDocument,
  mergeScanFields,
  polizaToFormFields,
  type PuertoLibreRegistroScanFields,
} from "@/lib/extract-puerto-libre-docs";
import {
  emptyCargaMasivaRow,
  type CargaMasivaRow,
} from "@/lib/importacion/carga-masiva-template";
import { validateVehiculoDocumentoFile } from "@/lib/vehiculos/upload-documento";

export const maxDuration = 300;

export type ExtractPuertoLibreDocResult =
  | {
      success: true;
      tipo:
        | "factura_comercial"
        | "bl_guia"
        | "certificado_origen"
        | "poliza_transporte";
      fields: PuertoLibreRegistroScanFields;
      filledCount: number;
      /** Factura con varias unidades (hoja anexa / carátula multi). */
      multi?: false;
      warning?: string;
    }
  | {
      success: true;
      tipo: "factura_comercial";
      fields: PuertoLibreRegistroScanFields;
      filledCount: number;
      multi: true;
      rows: CargaMasivaRow[];
      vehicleCount: number;
      warning?: string;
    }
  | {
      success: true;
      tipo: "certificado_origen";
      fields: PuertoLibreRegistroScanFields;
      filledCount: number;
      multi?: false;
      warning?: string;
    }
  | {
      success: true;
      tipo: "certificado_origen";
      fields: PuertoLibreRegistroScanFields;
      filledCount: number;
      multi: true;
      rows: CargaMasivaRow[];
      vehicleCount: number;
      warning?: string;
    }
  | { success: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024;

function resolveDocMime(file: File, buffer: Buffer): string {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return "application/pdf";
  }
  return (
    resolveImageMimeType({
      declaredMime: file.type,
      fileName: file.name,
      buffer,
    }) ?? "image/jpeg"
  );
}

function scanFieldsToRow(
  fields: PuertoLibreRegistroScanFields,
  fuente: string
): CargaMasivaRow {
  const serial = fields.serialCarroceria ?? fields.vin ?? "";
  const vin = fields.vin ?? serial;
  return emptyCargaMasivaRow({
    marca: fields.marca ?? "",
    modelo: fields.modelo ?? "",
    color: fields.color ?? "",
    anio: fields.anio ?? "",
    serialMotor: fields.serialMotor ?? "",
    vin,
    serialCarroceria: serial || vin,
    kilometraje: fields.kilometraje ?? "0",
    condicion: fields.condicion ?? "nuevo",
    esSubasta:
      fields.esSubasta === "true" ? "si" : fields.esSubasta === "false" ? "no" : "",
    partidaArancelaria: fields.partidaArancelaria ?? "",
    cilindradaCc: fields.cilindradaCc ?? "",
    tipoCombustible: fields.tipoCombustible ?? "",
    fechaLlegadaBuque: fields.fechaLlegadaBuque ?? "",
    importadorNombre: fields.importadorNombre ?? "",
    importadorDocumento: fields.importadorDocumento ?? "",
    importadorTelefono: fields.importadorTelefono ?? "",
    importadorEmail: fields.importadorEmail ?? "",
    importadorDireccion: fields.importadorDireccion ?? "",
    aduana: fields.aduana ?? "",
    numeroBl: fields.numeroBl ?? "",
    paisOrigen: fields.paisOrigen ?? "",
    valorCif: fields.valorCif ?? "",
    tasaCambioBcv: fields.tasaCambioBcv ?? "",
    numeroExpedienteSeniat: fields.numeroExpedienteSeniat ?? "",
    numeroDav: fields.numeroDav ?? "",
    numeroCertificadoOrigen: fields.numeroCertificadoOrigen ?? "",
    numeroListaEmpaque: fields.numeroListaEmpaque ?? "",
    numeroPolizaTransporte: fields.numeroPolizaTransporte ?? "",
    observaciones: fields.observaciones ?? "",
    fuente,
  });
}

export async function extractPuertoLibreDocumentoAction(
  formData: FormData
): Promise<ExtractPuertoLibreDocResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const taller = await getMyTaller();
  if (!taller) return { success: false, error: "No se encontró tu taller" };

  if (!isLlmConfigured()) {
    return {
      success: false,
      error: "Falta GEMINI_API_KEY (gratis) u OPENAI_API_KEY para leer documentos con IA.",
    };
  }

  const budget = await assertLlmBudgetAllows(taller.id);
  if (!budget.ok) return { success: false, error: budget.error };

  const tipoRaw = String(formData.get("tipo") ?? "").trim();
  bindLlmUsageContext({
    action: `ocr_${tipoRaw || "doc"}`,
    tallerId: taller.id,
    userId: user.id,
  });

  if (
    tipoRaw !== "factura_comercial" &&
    tipoRaw !== "bl_guia" &&
    tipoRaw !== "certificado_origen" &&
    tipoRaw !== "poliza_transporte"
  ) {
    return { success: false, error: "Tipo de documento inválido" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Selecciona una foto o un PDF del documento" };
  }

  if (file.size > MAX_BYTES) {
    return { success: false, error: "El archivo supera 10 MB" };
  }

  const validationError = validateVehiculoDocumentoFile(file);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = resolveDocMime(file, buffer);

    if (tipoRaw === "factura_comercial") {
      const extracted = await extractFacturaMultiFromDocument(buffer, mimeType);
      if (extracted.vehiculos.length > 1) {
        const rows = extracted.vehiculos.map((v, i) => {
          const merged = mergeScanFields(extracted.shared, v);
          if (v.valorCif) merged.valorCif = v.valorCif;
          else delete merged.valorCif;
          return scanFieldsToRow(
            merged,
            `Hoja anexa · unidad ${i + 1} · ${file.name}`
          );
        });
        const first = mergeScanFields(
          extracted.shared,
          extracted.vehiculos[0] ?? {}
        );
        return {
          success: true,
          tipo: "factura_comercial",
          multi: true,
          rows,
          vehicleCount: rows.length,
          fields: first,
          filledCount: rows.length,
        };
      }

      const only = extracted.vehiculos[0];
      const fields = only
        ? mergeScanFields(extracted.shared, only)
        : extracted.shared;
      const filledCount = countFilledFields(fields);
      if (filledCount === 0) {
        return {
          success: true,
          tipo: "factura_comercial",
          fields,
          filledCount: 0,
          multi: false,
          warning:
            "No se pudieron leer VIN ni datos de la factura. Reintenta con una foto más nítida o abre la planilla de varios vehículos.",
        };
      }
      return {
        success: true,
        tipo: "factura_comercial",
        fields,
        filledCount,
        multi: false,
      };
    }

    if (tipoRaw === "certificado_origen") {
      const extracted = await extractCertificadoOrigenMultiFromDocument(
        buffer,
        mimeType
      );
      if (extracted.vehiculos.length > 1) {
        const rows = extracted.vehiculos.map((v, i) => {
          const merged = mergeScanFields(extracted.shared, v);
          return scanFieldsToRow(
            merged,
            `Certificado origen · unidad ${i + 1} · ${file.name}`
          );
        });
        const first = mergeScanFields(
          extracted.shared,
          extracted.vehiculos[0] ?? {}
        );
        return {
          success: true,
          tipo: "certificado_origen",
          multi: true,
          rows,
          vehicleCount: rows.length,
          fields: first,
          filledCount: rows.length,
        };
      }

      const first = extracted.vehiculos[0] ?? {};
      const fields = mergeScanFields(extracted.shared, first);
      const filledCount = countFilledFields(fields);
      if (filledCount === 0) {
        return {
          success: true,
          tipo: "certificado_origen",
          fields,
          filledCount: 0,
          multi: false,
          warning:
            "No se pudieron leer datos del certificado. El archivo se guarda igual: reintenta o ábrelo en la planilla de varios vehículos.",
        };
      }
      return {
        success: true,
        tipo: "certificado_origen",
        fields,
        filledCount,
        multi: false,
      };
    }

    if (tipoRaw === "poliza_transporte") {
      const extracted = await extractPolizaTransporteFromDocument(
        buffer,
        mimeType
      );
      const fields = polizaToFormFields(extracted);
      const filledCount = countFilledFields(fields);
      if (filledCount === 0) {
        return {
          success: false,
          error:
            "No se pudieron leer datos de la póliza de transporte. Prueba con una foto más nítida o completa los campos a mano.",
        };
      }
      return { success: true, tipo: "poliza_transporte", fields, filledCount };
    }

    const extracted = await extractBlFromDocument(buffer, mimeType);
    const fields = blToFormFields(extracted);
    const filledCount = countFilledFields(fields);
    if (filledCount === 0) {
      return {
        success: false,
        error:
          "No se pudieron leer datos del BL. Prueba con una foto más nítida o completa los campos a mano.",
      };
    }
    return { success: true, tipo: "bl_guia", fields, filledCount };
  } catch (err) {
    return { success: false, error: formatLlmAuthError(err) };
  }
}
