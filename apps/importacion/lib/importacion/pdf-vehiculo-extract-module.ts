/**
 * Módulo de extracción de datos de PDFs automotrices (factura + certificado).
 * Orquesta los extractores existentes de Puerto Libre y devuelve un DTO estable.
 *
 * RLS / auth: este módulo es puro (buffers in → JSON out). La Server Action
 * que lo invoca debe autenticar taller y comprobar presupuesto LLM.
 */

import {
  extractCertificadoOrigenMultiFromDocument,
  extractFacturaMultiFromDocument,
  extractFacturaVinsStageFromDocument,
  enrichFacturaRowsStageFromDocument,
  mergeScanFields,
  type DocMultiExtracted,
} from "@/lib/extract-puerto-libre-docs";
import {
  computeCompletitudDatos,
  isVinRegistrable,
  normalizeVinKey,
} from "@/lib/importacion/completitud-datos";
import {
  matchSerialKeyAmong,
  normalizeSerialKey,
} from "@/lib/importacion/carga-masiva-ui";
import type { PuertoLibreRegistroScanFields } from "@/lib/importacion/scan-fields";
import { formatLlmAuthError, isLlmConfigured } from "@/lib/ai/openai-config";

export type PdfExtractStatus = "success" | "processing" | "error";

export type PdfVehicleValidationStatus = "verde" | "ambar" | "rojo";

export type PdfExtractedVehicle = {
  vin: string;
  marca: string;
  modelo: string;
  año: number | null;
  color: string;
  numeroMotor: string;
  /** Placa/matrícula: rara en factura de importación; suele ir null. */
  numeroPlaca: string | null;
  precio: number | null;
  validationStatus: PdfVehicleValidationStatus;
};

export type PdfExtractedCertificado = {
  vin: string;
  paisOrigen: string;
  fechaEmision: string | null;
  autoridadEmisora: string | null;
  tipoCertificado: string | null;
  numerocertificado: string;
  estado: string | null;
};

export type PdfVehiculoExtractResult = {
  status: PdfExtractStatus;
  vehicles: PdfExtractedVehicle[];
  certificados: PdfExtractedCertificado[];
  errores: string[];
};

export type PdfDocInput = {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
};

export type PdfVehiculoExtractInput = {
  factura?: PdfDocInput | null;
  certificados?: PdfDocInput[];
};

function parsePrecio(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseAnio(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(String(raw).replace(/\D/g, "").slice(0, 4));
  if (!Number.isFinite(n) || n < 1980 || n > 2100) return null;
  return n;
}

function vinOf(fields: PuertoLibreRegistroScanFields): string {
  return normalizeVinKey(fields.serialCarroceria || fields.vin || "");
}

function toVehicleDto(
  fields: PuertoLibreRegistroScanFields
): PdfExtractedVehicle {
  const vin = vinOf(fields);
  const completitud = computeCompletitudDatos({
    marca: fields.marca,
    modelo: fields.modelo,
    color: fields.color,
    anio: fields.anio,
    serialMotor: fields.serialMotor,
    vin: fields.vin,
    serialCarroceria: fields.serialCarroceria,
  });
  return {
    vin,
    marca: fields.marca?.trim() || "",
    modelo: fields.modelo?.trim() || "",
    año: parseAnio(fields.anio),
    color: fields.color?.trim() || "",
    numeroMotor: fields.serialMotor?.trim() || "",
    numeroPlaca: null,
    precio: parsePrecio(fields.valorCif),
    validationStatus: completitud.nivel,
  };
}

function toCertDto(
  fields: PuertoLibreRegistroScanFields,
  shared: PuertoLibreRegistroScanFields
): PdfExtractedCertificado | null {
  const vin = vinOf(fields) || vinOf(shared);
  if (!vin && !shared.numeroCertificadoOrigen && !fields.numeroCertificadoOrigen) {
    return null;
  }
  const estado =
    fields.estadoCertificadoOrigen ||
    shared.estadoCertificadoOrigen ||
    shared.observaciones?.match(/Cert:\s*([^·]+)/i)?.[1]?.trim() ||
    null;
  return {
    vin,
    paisOrigen: (fields.paisOrigen || shared.paisOrigen || "").trim(),
    fechaEmision:
      fields.fechaCertificadoOrigen || shared.fechaCertificadoOrigen || null,
    autoridadEmisora:
      fields.autoridadCertificadoOrigen ||
      shared.autoridadCertificadoOrigen ||
      null,
    tipoCertificado:
      fields.tipoCertificadoOrigen || shared.tipoCertificadoOrigen || "origen",
    numerocertificado: (
      fields.numeroCertificadoOrigen ||
      shared.numeroCertificadoOrigen ||
      ""
    ).trim(),
    estado,
  };
}

function mergeByVin(
  base: Map<string, PuertoLibreRegistroScanFields>,
  incoming: PuertoLibreRegistroScanFields[]
): void {
  const keys = [...base.keys()];
  for (const fields of incoming) {
    const vin = vinOf(fields);
    if (!vin) continue;
    const matched = matchSerialKeyAmong(vin, keys) ?? vin;
    const prev = base.get(matched);
    if (!prev) {
      base.set(matched.length === 17 ? matched : vin, { ...fields });
      keys.push(matched.length === 17 ? matched : vin);
      continue;
    }
    base.set(matched, mergeScanFields(prev, fields));
  }
}

async function extractFacturaVehicles(
  doc: PdfDocInput,
  errores: string[]
): Promise<PuertoLibreRegistroScanFields[]> {
  const label = doc.fileName || "factura";
  try {
    let extracted: DocMultiExtracted = await extractFacturaVinsStageFromDocument(
      doc.buffer,
      doc.mimeType
    );
    const knownVins = extracted.vehiculos
      .map((v) => vinOf(v))
      .filter((v) => v.length >= 11);

    if (knownVins.length > 0) {
      try {
        const enriched = await enrichFacturaRowsStageFromDocument(
          doc.buffer,
          doc.mimeType,
          knownVins
        );
        const byVin = new Map<string, PuertoLibreRegistroScanFields>();
        for (const v of extracted.vehiculos) {
          const key = vinOf(v);
          if (key) byVin.set(key, mergeScanFields(extracted.shared, v));
        }
        for (const v of enriched.vehiculos) {
          const key = vinOf(v) || normalizeSerialKey(v.serialCarroceria || v.vin || "");
          if (!key) continue;
          const matched = matchSerialKeyAmong(key, [...byVin.keys()]) ?? key;
          const prev = byVin.get(matched) ?? extracted.shared;
          byVin.set(matched, mergeScanFields(prev, mergeScanFields(enriched.shared, v)));
        }
        return [...byVin.values()];
      } catch (err) {
        errores.push(
          `${label}: enriquecimiento parcial — ${formatLlmAuthError(err)}`
        );
        return extracted.vehiculos.map((v) =>
          mergeScanFields(extracted.shared, v)
        );
      }
    }

    extracted = await extractFacturaMultiFromDocument(doc.buffer, doc.mimeType);
    if (extracted.vehiculos.length === 0) {
      errores.push(`${label}: no se detectaron VIN ni datos de vehículos`);
      return [];
    }
    return extracted.vehiculos.map((v) =>
      mergeScanFields(extracted.shared, v)
    );
  } catch (err) {
    errores.push(`${label}: ${formatLlmAuthError(err)}`);
    return [];
  }
}

async function extractCertVehicles(
  docs: PdfDocInput[],
  errores: string[]
): Promise<{
  vehicles: PuertoLibreRegistroScanFields[];
  certificados: PdfExtractedCertificado[];
}> {
  const vehicles: PuertoLibreRegistroScanFields[] = [];
  const certificados: PdfExtractedCertificado[] = [];

  for (const doc of docs) {
    const label = doc.fileName || "certificado";
    try {
      const extracted = await extractCertificadoOrigenMultiFromDocument(
        doc.buffer,
        doc.mimeType,
        { rapido: true }
      );
      if (extracted.vehiculos.length === 0) {
        const dto = toCertDto({}, extracted.shared);
        if (dto?.numerocertificado || dto?.paisOrigen) {
          certificados.push({ ...dto, vin: dto.vin || "" });
        } else {
          errores.push(`${label}: certificado sin VIN ni datos legibles`);
        }
        continue;
      }
      for (const v of extracted.vehiculos) {
        const merged = mergeScanFields(extracted.shared, v);
        vehicles.push(merged);
        const dto = toCertDto(merged, extracted.shared);
        if (dto) certificados.push(dto);
      }
    } catch (err) {
      errores.push(`${label}: ${formatLlmAuthError(err)}`);
    }
  }

  return { vehicles, certificados };
}

function markRojo(vehicle: PdfExtractedVehicle): void {
  vehicle.validationStatus = "rojo";
}

function validateVinMatches(
  vehicles: PdfExtractedVehicle[],
  certificados: PdfExtractedCertificado[],
  errores: string[]
): void {
  if (vehicles.length === 0 || certificados.length === 0) return;
  const vehicleKeys = vehicles.map((v) => v.vin).filter(Boolean);
  const certKeys = certificados.map((c) => c.vin).filter(Boolean);

  for (const c of certificados) {
    if (!c.vin) {
      errores.push(
        `Certificado ${c.numerocertificado || "(sin nº)"}: sin VIN para emparejar`
      );
      continue;
    }
    const match = matchSerialKeyAmong(c.vin, vehicleKeys);
    if (!match) {
      errores.push(
        `VIN del certificado ${c.vin} no coincide con ningún VIN de la factura`
      );
    }
  }

  for (const v of vehicles) {
    if (!isVinRegistrable(v.vin)) continue;
    const match = matchSerialKeyAmong(v.vin, certKeys);
    if (!match && certKeys.length > 0) {
      errores.push(
        `VIN de factura ${v.vin} sin certificado de origen emparejado`
      );
      markRojo(v);
    }
  }
}

/**
 * Extrae vehículos y certificados desde PDFs/fotos.
 * Usa OCR local (Tesseract) + LLM de visión cuando hay clave configurada.
 */
export async function extractVehiculosFromPdfs(
  input: PdfVehiculoExtractInput
): Promise<PdfVehiculoExtractResult> {
  const errores: string[] = [];

  if (!input.factura && !(input.certificados && input.certificados.length > 0)) {
    return {
      status: "error",
      vehicles: [],
      certificados: [],
      errores: ["Selecciona una factura y/o al menos un certificado PDF"],
    };
  }

  if (!isLlmConfigured()) {
    errores.push(
      "Sin GEMINI_API_KEY / OPENAI_API_KEY: la cosecha de VIN usará OCR local si es posible; el enriquecimiento puede quedar incompleto."
    );
  }

  const byVin = new Map<string, PuertoLibreRegistroScanFields>();

  if (input.factura) {
    const fromFactura = await extractFacturaVehicles(input.factura, errores);
    mergeByVin(byVin, fromFactura);
  }

  let certificados: PdfExtractedCertificado[] = [];
  if (input.certificados && input.certificados.length > 0) {
    const fromCert = await extractCertVehicles(input.certificados, errores);
    mergeByVin(byVin, fromCert.vehicles);
    certificados = fromCert.certificados;
  }

  const vehicles = [...byVin.values()]
    .map(toVehicleDto)
    .filter((v) => v.vin.length > 0 || v.marca || v.modelo);

  validateVinMatches(vehicles, certificados, errores);

  if (vehicles.length === 0 && certificados.length === 0) {
    return {
      status: "error",
      vehicles: [],
      certificados: [],
      errores:
        errores.length > 0
          ? errores
          : ["No se pudieron extraer vehículos ni certificados del PDF"],
    };
  }

  return {
    status: "success",
    vehicles,
    certificados,
    errores,
  };
}
