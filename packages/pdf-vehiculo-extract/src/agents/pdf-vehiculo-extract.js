/**
 * Agente: extracción PDF de vehículos (factura) + certificados de origen.
 *
 * Uso típico desde SmartTaller / Importación:
 *   import { runPdfVehiculoExtractAgent } from "@agenteia/pdf-vehiculo-extract/agents/pdf-vehiculo-extract";
 *
 * El OCR pesado vive en la app Next (`extractVehiculosFromPdfs`). Aquí se
 * valida el contrato Zod, se refuerza el match VIN factura↔cert y opcionalmente
 * se persiste un resumen en Supabase.
 */

import {
  computeValidationStatus,
  isVinValid,
  normalizeVin,
  parsePdfExtractResult,
  safeParsePdfExtractResult,
} from "../schemas/vehicles.js";
import {
  createSupabaseClient,
  isSupabaseConfigured,
} from "../config/supabase.js";

/**
 * @typedef {import("../schemas/vehicles.js").Vehicle} Vehicle
 * @typedef {import("../schemas/vehicles.js").Certificado} Certificado
 * @typedef {import("../schemas/vehicles.js").PdfExtractResult} PdfExtractResult
 */

/**
 * Empareja VIN con tolerancia OCR (prefijos LVV).
 * @param {string} needle
 * @param {string[]} haystack
 */
function matchVinAmong(needle, haystack) {
  const n = normalizeVin(needle);
  if (!n) return null;
  if (haystack.includes(n)) return n;
  for (const h of haystack) {
    if (h.length >= 11 && n.length >= 11 && (h.includes(n) || n.includes(h))) {
      return h;
    }
  }
  return null;
}

/**
 * Refuerza errores y semáforo cuando hay factura + certificados.
 * @param {PdfExtractResult} result
 * @returns {PdfExtractResult}
 */
export function reinforceVinValidation(result) {
  const errores = [...result.errores];
  const vehicleKeys = result.vehicles.map((v) => normalizeVin(v.vin)).filter(Boolean);
  const certKeys = result.certificados
    .map((c) => normalizeVin(c.vin))
    .filter(Boolean);

  const vehicles = result.vehicles.map((v) => {
    let validationStatus = v.validationStatus || computeValidationStatus(v);
    const vin = normalizeVin(v.vin);

    if (certKeys.length > 0 && isVinValid(vin)) {
      const match = matchVinAmong(vin, certKeys);
      if (!match) {
        errores.push(
          `VIN de factura ${vin} sin certificado de origen emparejado`
        );
        validationStatus = "rojo";
      }
    }

    return { ...v, vin, validationStatus };
  });

  for (const c of result.certificados) {
    const vin = normalizeVin(c.vin);
    if (!vin) {
      errores.push(
        `Certificado ${c.numerocertificado || "(sin nº)"}: sin VIN para emparejar`
      );
      continue;
    }
    if (vehicleKeys.length > 0 && !matchVinAmong(vin, vehicleKeys)) {
      errores.push(
        `VIN del certificado ${vin} no coincide con ningún VIN de la factura`
      );
    }
  }

  const uniqueErrores = [...new Set(errores)];
  return parsePdfExtractResult({
    ...result,
    vehicles,
    errores: uniqueErrores,
  });
}

/**
 * Persiste un log ligero de la extracción (tabla opcional `pdf_extract_runs`).
 * No falla el agente si la tabla no existe.
 *
 * @param {object} opts
 * @param {PdfExtractResult} opts.result
 * @param {string} [opts.tallerId]
 * @param {string} [opts.fuente]
 * @param {import("@supabase/supabase-js").SupabaseClient} [opts.supabase]
 */
export async function persistExtractRun({
  result,
  tallerId,
  fuente = "pdf-vehiculo-extract-agent",
  supabase,
}) {
  if (!tallerId) return { saved: false, reason: "sin tallerId" };
  if (!supabase && !isSupabaseConfigured()) {
    return { saved: false, reason: "supabase no configurado" };
  }

  const client = supabase || createSupabaseClient();
  const { error } = await client.from("pdf_extract_runs").insert({
    taller_id: tallerId,
    fuente,
    status: result.status,
    vehicle_count: result.vehicles.length,
    certificado_count: result.certificados.length,
    errores: result.errores,
    payload: result,
  });

  if (error) {
    return { saved: false, reason: error.message };
  }
  return { saved: true };
}

/**
 * Ejecuta el agente sobre un resultado ya extraído (p. ej. por Next Server Action)
 * o sobre una función `extractFn` inyectada.
 *
 * @param {object} input
 * @param {PdfExtractResult | unknown} [input.rawResult] — salida del extractor Next
 * @param {() => Promise<unknown>} [input.extractFn] — extractor inyectable (buffers→JSON)
 * @param {string} [input.tallerId]
 * @param {boolean} [input.persist=false]
 * @param {import("@supabase/supabase-js").SupabaseClient} [input.supabase]
 * @returns {Promise<PdfExtractResult & { persist?: { saved: boolean, reason?: string } }>}
 */
export async function runPdfVehiculoExtractAgent(input = {}) {
  let raw = input.rawResult;

  if (raw == null && typeof input.extractFn === "function") {
    raw = await input.extractFn();
  }

  if (raw == null) {
    return parsePdfExtractResult({
      status: "error",
      vehicles: [],
      certificados: [],
      errores: [
        "Sin rawResult ni extractFn: pasa la salida de extractVehiculosFromPdfs o una función de OCR",
      ],
    });
  }

  const parsed = safeParsePdfExtractResult(raw);
  if (!parsed.success) {
    return parsePdfExtractResult({
      status: "error",
      vehicles: [],
      certificados: [],
      errores: [
        `Contrato JSON inválido: ${parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      ],
    });
  }

  const reinforced = reinforceVinValidation(parsed.data);

  /** @type {PdfExtractResult & { persist?: { saved: boolean, reason?: string } }} */
  const out = { ...reinforced };

  if (input.persist) {
    out.persist = await persistExtractRun({
      result: reinforced,
      tallerId: input.tallerId,
      supabase: input.supabase,
    });
  }

  return out;
}

export { parsePdfExtractResult, safeParsePdfExtractResult };
