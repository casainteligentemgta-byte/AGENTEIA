export type MantenimientoExtraido = {
  placa: string | null;
  kilometraje: number | null;
  descripcion_servicio: string | null;
  costo: number | null;
};

export type MantenimientoInsert = MantenimientoExtraido & {
  telegram_chat_id?: number;
  telegram_message_id?: number;
  telegram_file_id?: string;
};

const SYSTEM_PROMPT = `Eres un asistente especializado en leer facturas y órdenes de servicio de talleres mecánicos en español.

Analiza la imagen y extrae ÚNICAMENTE un objeto JSON con estas claves:
- placa: string con la placa del vehículo (mayúsculas, sin espacios extra). null si no aparece.
- kilometraje: número entero del odómetro/kilometraje. null si no aparece.
- descripcion_servicio: string resumiendo el servicio o repuestos realizados. null si no se puede determinar.
- costo: número decimal del total a pagar (solo el número, sin símbolo de moneda). null si no aparece.

Reglas:
- Responde solo con JSON válido, sin markdown ni texto adicional.
- Si un campo no está visible o es ilegible, usa null.
- Para costo, usa punto como separador decimal (ej. 125000.50).
- Normaliza la placa al formato visible en el documento.`;

export async function extractMantenimientoFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<MantenimientoExtraido> {
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
    max_tokens: 500,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI no devolvió contenido");
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;

  return {
    placa: typeof parsed.placa === "string" ? parsed.placa.trim() || null : null,
    kilometraje:
      typeof parsed.kilometraje === "number"
        ? Math.round(parsed.kilometraje)
        : typeof parsed.kilometraje === "string"
          ? parseInt(parsed.kilometraje.replace(/\D/g, ""), 10) || null
          : null,
    descripcion_servicio:
      typeof parsed.descripcion_servicio === "string"
        ? parsed.descripcion_servicio.trim() || null
        : null,
    costo:
      typeof parsed.costo === "number"
        ? parsed.costo
        : typeof parsed.costo === "string"
          ? parseFloat(parsed.costo.replace(/[^\d.,]/g, "").replace(",", ".")) || null
          : null,
  };
}
