import { extractVinStringsFromText } from "@/lib/importacion/vin-text";

function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
}

function stripTrailingCommas(json: string): string {
  return json.replace(/,\s*(?=[}\]])/g, "");
}

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    try {
      return JSON.parse(stripTrailingCommas(text)) as unknown;
    } catch {
      return undefined;
    }
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (Array.isArray(value) && value[0] && typeof value[0] === "object") {
    return value[0] as Record<string, unknown>;
  }
  return null;
}

function extractBalancedJson(
  text: string
): { raw: string; truncated: boolean } | null {
  const startObj = text.indexOf("{");
  const startArr = text.indexOf("[");
  if (startObj === -1 && startArr === -1) return null;
  const start =
    startArr === -1 || (startObj !== -1 && startObj < startArr)
      ? startObj
      : startArr;

  const stack: Array<"{" | "["> = [];
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) {
        return { raw: text.slice(start, i + 1), truncated: false };
      }
    }
  }

  if (stack.length > 0) {
    return { raw: text.slice(start), truncated: true };
  }
  return null;
}

function repairTruncatedJson(raw: string): string {
  let s = raw.trim();
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    }
  }
  if (inString) s += '"';
  s = stripTrailingCommas(s);

  const closers: string[] = [];
  inString = false;
  escape = false;
  for (const ch of s) {
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") closers.push("}");
    else if (ch === "[") closers.push("]");
    else if (ch === "}" || ch === "]") closers.pop();
  }
  while (closers.length > 0) {
    s += closers.pop();
  }
  return s;
}

/**
 * Gemini (sin JSON mode) a menudo envuelve, trunca o pone comas finales.
 * Recupera el primer objeto JSON usable.
 */
export function parseLlmJsonObject(raw: string): Record<string, unknown> | null {
  const text = stripJsonFence(raw);
  const direct = asObject(tryParse(text));
  if (direct) return direct;

  const extracted = extractBalancedJson(text);
  if (!extracted) return null;

  const complete = asObject(tryParse(extracted.raw));
  if (complete) return complete;

  return asObject(tryParse(repairTruncatedJson(extracted.raw)));
}

export function parseJsonOrSalvageVins(raw: string): Record<string, unknown> {
  const parsed = parseLlmJsonObject(raw);
  if (parsed) return parsed;
  const vins = extractVinStringsFromText(raw);
  if (vins.length === 0) {
    throw new Error("La IA no devolvió JSON válido");
  }
  return {
    vehiculos: vins.map((vin) => ({
      serial_carroceria: vin,
      condicion: "nuevo",
      kilometraje: 0,
    })),
  };
}
