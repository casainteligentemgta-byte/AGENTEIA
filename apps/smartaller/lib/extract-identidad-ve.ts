import { createDocumentJsonCompletion } from "@/lib/ai/document-json-completion";
import { isValidCedula, normalizeCedula } from "@/lib/validations/cedula";
import { isValidRif, normalizeRif } from "@/lib/validations/rif";
import type { ImportadorTipo } from "@/lib/schemas/importador";

export type RifExtraidoVe = {
  rif: string | null;
  tipoPersona: ImportadorTipo | null;
  /** Persona natural o razón social. */
  nombre: string | null;
  denominacionComercial: string | null;
  razonSocial: string | null;
  domicilio: string | null;
  telefono: string | null;
  email: string | null;
  repLegalNombre: string | null;
  repLegalCedula: string | null;
};

export type CedulaExtraidaVe = {
  cedula: string | null;
  nombreCompleto: string | null;
  fechaNacimiento: string | null;
};

/** Campos del formulario de importador que puede rellenar el OCR. */
export type ImportadorScanFields = {
  tipo?: ImportadorTipo;
  nombresApellidos?: string;
  rif?: string;
  cedula?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  denominacionComercial?: string;
  razonSocial?: string;
  repLegalNombre?: string;
  repLegalCedula?: string;
  repLegalEmail?: string;
  repLegalTelefono?: string;
  empresaTelefono?: string;
  empresaEmail?: string;
  empresaDomicilio?: string;
};

const RIF_PROMPT = `Analiza este documento RIF venezolano (carnet SENIAT, comprobante de información fiscal o cédula RIF).
Extrae SOLO un JSON con estas claves (string o null):
- rif: número RIF en formato letra-########-# (letra J, V, E, G, P o C). Ejemplo: J-12345678-9 o V-00123456-7.
- tipo_persona: "natural" si es persona natural (V/E) o "juridica" si es empresa/organización (J/G/C/P).
- nombre: nombres y apellidos si es persona natural; null si es jurídica.
- razon_social: razón social completa si es jurídica; null si es natural.
- denominacion_comercial: nombre comercial / fantasia si aparece; null si no.
- domicilio: dirección fiscal o domicilio si aparece.
- telefono: teléfono si aparece.
- email: correo si aparece.
- rep_legal_nombre: nombre del representante legal si aparece en el documento.
- rep_legal_cedula: cédula del representante (V-######## o E-########) si aparece.
Si un dato no se lee con claridad, usa null. No inventes. Responde únicamente JSON.`;

const CEDULA_PROMPT = `Analiza esta cédula de identidad venezolana (laminada o foto).
Extrae SOLO un JSON con estas claves (string o null):
- numero_cedula: formato V-######## o E-######## (con guion). Si solo hay dígitos y nacionalidad venezolana, antepone V-.
- nombres: nombres de pila.
- apellidos: apellidos.
- nombre_completo: nombres y apellidos juntos en el orden habitual.
- fecha_nacimiento: YYYY-MM-DD si aparece.
Si un dato no se lee con claridad, usa null. No inventes. Responde únicamente JSON.`;

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function parseTipoPersona(value: unknown, rif: string | null): ImportadorTipo | null {
  const raw = parseString(value)?.toLowerCase();
  if (raw === "natural" || raw === "juridica") return raw;
  if (!rif) return null;
  const letra = rif[0];
  if (letra === "V" || letra === "E") return "natural";
  if (letra === "J" || letra === "G" || letra === "C" || letra === "P") {
    return "juridica";
  }
  return null;
}

function parseRifValue(value: unknown): string | null {
  const raw = parseString(value);
  if (!raw) return null;
  // Intentar normalizar variantes comunes: J123456789, J-12345678-9, etc.
  let cleaned = raw.toUpperCase().replace(/\s+/g, "");
  const compact = cleaned.match(/^([JVEGPC])-?(\d{7,9})-?(\d)?$/);
  if (compact) {
    const [, letra, body, check] = compact;
    const digits = body.padStart(8, "0").slice(-8);
    cleaned = check != null ? `${letra}-${digits}-${check}` : `${letra}-${digits}-0`;
  }
  const normalized = normalizeRif(cleaned);
  return isValidRif(normalized) ? normalized : normalized || null;
}

function parseCedulaValue(value: unknown): string | null {
  const raw = parseString(value);
  if (!raw) return null;
  const normalized = normalizeCedula(raw);
  return isValidCedula(normalized) ? normalized : normalized || null;
}

function joinNombre(
  completo: string | null,
  nombres: string | null,
  apellidos: string | null
): string | null {
  if (completo) return completo;
  const parts = [nombres, apellidos].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

export async function extractRifFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<RifExtraidoVe> {
  const parsed = await createDocumentJsonCompletion({
    prompt: RIF_PROMPT,
    buffer,
    mimeType,
    maxTokens: 700,
  });

  const rif = parseRifValue(parsed.rif);
  return {
    rif,
    tipoPersona: parseTipoPersona(parsed.tipo_persona, rif),
    nombre: parseString(parsed.nombre),
    denominacionComercial: parseString(parsed.denominacion_comercial),
    razonSocial: parseString(parsed.razon_social),
    domicilio: parseString(parsed.domicilio),
    telefono: parseString(parsed.telefono),
    email: parseString(parsed.email),
    repLegalNombre: parseString(parsed.rep_legal_nombre),
    repLegalCedula: parseCedulaValue(parsed.rep_legal_cedula),
  };
}

export async function extractCedulaVeFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<CedulaExtraidaVe> {
  const parsed = await createDocumentJsonCompletion({
    prompt: CEDULA_PROMPT,
    buffer,
    mimeType,
    maxTokens: 500,
  });

  return {
    cedula: parseCedulaValue(parsed.numero_cedula),
    nombreCompleto: joinNombre(
      parseString(parsed.nombre_completo),
      parseString(parsed.nombres),
      parseString(parsed.apellidos)
    ),
    fechaNacimiento: parseString(parsed.fecha_nacimiento),
  };
}

export function rifToImportadorFields(
  data: RifExtraidoVe
): ImportadorScanFields {
  const fields: ImportadorScanFields = {};
  if (data.tipoPersona) fields.tipo = data.tipoPersona;
  if (data.rif) fields.rif = data.rif;

  const tipo = data.tipoPersona ?? fields.tipo;
  if (tipo === "juridica") {
    if (data.razonSocial) fields.razonSocial = data.razonSocial;
    if (data.denominacionComercial) {
      fields.denominacionComercial = data.denominacionComercial;
    } else if (data.razonSocial) {
      fields.denominacionComercial = data.razonSocial;
    } else if (data.nombre) {
      fields.razonSocial = data.nombre;
      fields.denominacionComercial = data.nombre;
    }
    if (data.domicilio) fields.empresaDomicilio = data.domicilio;
    if (data.telefono) fields.empresaTelefono = data.telefono;
    if (data.email) fields.empresaEmail = data.email;
    if (data.repLegalNombre) fields.repLegalNombre = data.repLegalNombre;
    if (data.repLegalCedula) fields.repLegalCedula = data.repLegalCedula;
  } else {
    if (data.nombre) fields.nombresApellidos = data.nombre;
    else if (data.razonSocial) fields.nombresApellidos = data.razonSocial;
    if (data.domicilio) fields.direccion = data.domicilio;
    if (data.telefono) fields.telefono = data.telefono;
    if (data.email) fields.email = data.email;
  }

  return fields;
}

export function cedulaToImportadorFields(
  data: CedulaExtraidaVe,
  tipo: ImportadorTipo
): ImportadorScanFields {
  const fields: ImportadorScanFields = {};
  if (tipo === "juridica") {
    if (data.cedula) fields.repLegalCedula = data.cedula;
    if (data.nombreCompleto) fields.repLegalNombre = data.nombreCompleto;
  } else {
    if (data.cedula) fields.cedula = data.cedula;
    if (data.nombreCompleto) fields.nombresApellidos = data.nombreCompleto;
  }
  return fields;
}

export function countFilledScanFields(fields: ImportadorScanFields): number {
  return Object.values(fields).filter(
    (v) => typeof v === "string" && v.trim().length > 0
  ).length;
}
