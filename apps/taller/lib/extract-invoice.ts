export type FacturaExtraida = {
  placa: string | null;
  kilometraje: number | null;
  descripcion: string | null;
  costo: number | null;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
};

const SYSTEM_PROMPT = `Eres un asistente especializado en leer facturas y órdenes de servicio de talleres mecánicos en español.

Analiza la imagen y extrae ÚNICAMENTE un objeto JSON con estas claves:
- placa: string con la placa del vehículo (mayúsculas, sin espacios extra). null si no aparece.
- kilometraje: número entero del odómetro/kilometraje. null si no aparece.
- descripcion: string resumiendo el servicio o repuestos realizados. null si no se puede determinar.
- costo: número decimal del total a pagar (solo el número, sin símbolo de moneda). null si no aparece.
- nombre_cliente: string con el nombre del propietario o cliente. null si no aparece.
- telefono_cliente: string con el teléfono del cliente (solo dígitos, con indicativo de país si está visible). null si no aparece.

Reglas:
- Responde solo con JSON válido, sin markdown ni texto adicional.
- Si un campo no está visible o es ilegible, usa null.
- Para costo, usa punto como separador decimal (ej. 125000.50).
- Normaliza la placa al formato visible en el documento.`;

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function parseKilometraje(value: unknown): number | null {
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "string") {
    const n = parseInt(value.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseCosto(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function extractMantenimientoFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<FacturaExtraida> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY en las variables de entorno");
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });

  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extrae los datos de esta factura u orden de mantenimiento vehicular.",
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 600,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI no devolvió contenido");
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;

  return {
    placa: parseString(parsed.placa)?.toUpperCase() ?? null,
    kilometraje: parseKilometraje(parsed.kilometraje),
    descripcion:
      parseString(parsed.descripcion) ??
      parseString(parsed.descripcion_servicio),
    costo: parseCosto(parsed.costo),
    nombre_cliente: parseString(parsed.nombre_cliente),
    telefono_cliente: parseString(parsed.telefono_cliente),
  };
}
