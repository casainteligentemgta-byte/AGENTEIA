/**
 * OCR local de VIN / filas de factura con Tesseract (sin OpenAI).
 * Cubre Chery (columna Code) y hoja anexa MAV (No. de Chasis), con rotación.
 */

import {
  collectEngineNosFromColumnWords,
  collectEngineNosInOrder,
} from "@/lib/importacion/cert-engine-text";
import { parseCheryInvoiceLineas } from "@/lib/importacion/chery-invoice-lines";
import {
  extractVinStringsFromText,
  normalizeVinLoose,
  salvageCheryVin,
} from "@/lib/importacion/vin-text";

/** Cuerpo Chery completo tras WMI: DC21B5VD713650 / DB21B9VE033518 */
const CHERY_BODY_RE = /D[CB]21[A-HJ-NPR-Z0-9]{2}V[DE][0-9]{6}/gi;

/** Columna Code cortada: 21B5VD713650 / 21B9VE033518 */
const CHERY_SHORT_TAIL_RE = /21[A-HJ-NPR-Z0-9]{2}V[DE][0-9]{6}/gi;

/**
 * WMI frecuentes en importación VE.
 * MF3 = hoja anexa MAV; LVV/LVT/LVD = Chery.
 */
const PLAUSIBLE_VIN_RE =
  /^(MF3|LVV|LVT|LVD|LSG|LFB|LFV|LHG|LDC|LPA|LPB|LPP|WVW|WBA|JTD)/;

/** VIN Chery Arrizo/Tiggo: LVV + DC/DB + 21 + 2 chars + VD/VE + 6 dígitos */
const CHERY_FULL_RE = /^LVVD[CB]21[A-HJ-NPR-Z0-9]{2}V[DE][0-9]{6}$/;

export function isPlausibleOcrVin(vin: string): boolean {
  return vin.length === 17 && PLAUSIBLE_VIN_RE.test(vin);
}

/**
 * Chery export: WMI LVV a menudo sale como LWV/LVW/LYV; índice 7 suele ser B.
 */
export function repairCheryOcrVin(vin: string): string {
  let v = vin.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  // Prefijo WMI mal leído (LWV, LVW, LYV, LYY…)
  if (/^LWV|^LV[WY]|^LYV|^LWW/.test(v)) v = `LVV${v.slice(3)}`;
  if (!CHERY_FULL_RE.test(v)) return v;
  if (v[7] === "B") return v;
  return `${v.slice(0, 7)}B${v.slice(8)}`;
}

/** Elige DC vs DB según el serial visual (713=Arrizo, 602/010/033=Tiggo). */
function cheryPrefixesForTail(tail12: string): string[] {
  const afterPlant = tail12.slice(6);
  if (afterPlant.startsWith("713")) return ["LVVDC"];
  if (
    afterPlant.startsWith("602") ||
    afterPlant.startsWith("010") ||
    afterPlant.startsWith("033")
  ) {
    return ["LVVDB"];
  }
  return ["LVVDC", "LVVDB"];
}

async function upscaleForOcr(imageBuffer: Buffer, minWidth = 720): Promise<Buffer> {
  const { loadImage, createCanvas } = await import("@napi-rs/canvas");
  const img = await loadImage(imageBuffer);
  if (img.width >= minWidth) return imageBuffer;
  const scale = minWidth / img.width;
  const w = Math.max(1, Math.floor(img.width * scale));
  const h = Math.max(1, Math.floor(img.height * scale));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toBuffer("image/png");
}

async function sliceHorizontalBands(
  imageBuffer: Buffer,
  bandCount: number
): Promise<Buffer[]> {
  const { loadImage, createCanvas } = await import("@napi-rs/canvas");
  const img = await loadImage(imageBuffer);
  const bands: Buffer[] = [];
  const overlap = Math.floor(img.height / bandCount / 4);
  for (let i = 0; i < bandCount; i++) {
    const y0 = Math.max(0, Math.floor((img.height * i) / bandCount) - overlap);
    const y1 = Math.min(
      img.height,
      Math.ceil((img.height * (i + 1)) / bandCount) + overlap
    );
    const h = Math.max(1, y1 - y0);
    const canvas = createCanvas(img.width, h);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, img.width, h);
    ctx.drawImage(img, 0, y0, img.width, h, 0, 0, img.width, h);
    bands.push(canvas.toBuffer("image/png"));
  }
  return bands;
}

export function extractVinsFromOcrText(text: string): string[] {
  const found = new Set<string>();

  const add = (raw: string | null | undefined) => {
    let vin = salvageCheryVin(raw) ?? normalizeVinLoose(raw, { strict: true });
    if (!vin || vin.length !== 17 || !isPlausibleOcrVin(vin)) return;
    found.add(vin);
  };

  for (const v of extractVinStringsFromText(text)) add(v);
  for (const row of parseCheryInvoiceLineas(text)) add(row.vin);

  // OCR a menudo pega "00001MF3PB8121TJ219731" sin espacios → buscar WMI embebidos
  const upper = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const wmi of [
    "MF3",
    "LVV",
    "LVT",
    "LVD",
    "LWV",
    "LWD",
    "LVW",
    "LYV",
    "LWW",
    "LSG",
    "LFB",
    "LFV",
    "LHG",
    "LDC",
  ]) {
    let from = 0;
    while (from < upper.length) {
      const idx = upper.indexOf(wmi, from);
      if (idx < 0) break;
      add(upper.slice(idx, idx + 17));
      from = idx + 1;
    }
  }

  for (const line of text.split(/\n+/)) {
    const compact = line.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (compact.length < 12 || compact.length > 64) continue;
    if (compact.length === 17) add(compact);
    for (let i = 0; i + 17 <= compact.length; i++) {
      const slice = compact.slice(i, i + 17);
      if (PLAUSIBLE_VIN_RE.test(slice)) add(slice);
    }
  }

  for (const m of text.toUpperCase().matchAll(CHERY_BODY_RE)) {
    const body = m[0]!.replace(/[^A-Z0-9]/g, "").slice(0, 14);
    if (body.length === 14) add(`LVV${body}`);
  }

  for (const m of text.toUpperCase().matchAll(CHERY_SHORT_TAIL_RE)) {
    const tail = m[0]!.replace(/[^A-Z0-9]/g, "");
    if (tail.length !== 12) continue;
    for (const prefix of cheryPrefixesForTail(tail)) {
      add(`${prefix}${tail}`);
    }
  }

  return [...found];
}

export type TesseractVinResult = {
  vins: string[];
  textSample: string;
  /** Texto OCR concatenado (para parseMavHojaAnexaFromText). */
  fullText: string;
};

type TessWorker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;

const INVOICE_SIGNAL_RE =
  /CONSIGNEE|INVOICE|DESTINATION|IKSAN|TIGGO|ARRIZO|OMODA|CIF|CHERY|RIF|GUAMACHE/i;

const CERT_PAGE2_SIGNAL_RE =
  /ENGINE\s*(NO|SERIAL|NUMBER)|CHASSIS|\bVIN\b|SQRE|C16TD|G4FL/i;

export function scoreCertificatePageOcrText(text: string): number {
  const t = text ?? "";
  return (
    t.length +
    (CERT_PAGE2_SIGNAL_RE.test(t) ? 8000 : 0) +
    ((t.match(/\bENGINE\b/gi) ?? []).length * 400) +
    ((t.match(/SQRE/gi) ?? []).length * 800) +
    ((t.match(/\bLVV/gi) ?? []).length * 200)
  );
}

export function countSqreTokens(text: string): number {
  return (text.match(/S[O0Q]RE/gi) ?? []).length;
}

async function cropPixels(
  imageBuffer: Buffer,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<Buffer> {
  const { loadImage, createCanvas } = await import("@napi-rs/canvas");
  const img = await loadImage(imageBuffer);
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const width = Math.max(1, Math.min(Math.floor(w), img.width - x0));
  const height = Math.max(1, Math.min(Math.floor(h), img.height - y0));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, x0, y0, width, height, 0, 0, width, height);
  return canvas.toBuffer("image/png");
}

async function recognizeCertPage(
  worker: TessWorker,
  image: Buffer,
  psms: unknown[]
): Promise<string> {
  const prepared = await upscaleForOcr(image, 1400);
  const texts: string[] = [];
  for (const psm of psms) {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: psm as never,
    });
    const result = await worker.recognize(prepared);
    texts.push(result.data.text ?? "");
  }
  const ranked = texts
    .map((t) => ({ t, score: scoreCertificatePageOcrText(t) }))
    .sort((a, b) => b.score - a.score);
  return (ranked[0]?.t ?? texts.join("\n")).trim();
}

type TessWord = {
  text?: string;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
};

async function recognizeWords(
  worker: TessWorker,
  image: Buffer
): Promise<{ text: string; words: TessWord[] }> {
  await worker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: "3" as never,
  });
  const result = await worker.recognize(image);
  return {
    text: result.data.text ?? "",
    words: ((result.data as { words?: TessWord[] }).words ?? []).filter(
      (w) => Boolean(w.bbox)
    ),
  };
}

function glyphsFromTessWords(
  words: TessWord[]
): { text: string; x0: number; y0: number; x1: number; y1: number }[] {
  const out: { text: string; x0: number; y0: number; x1: number; y1: number }[] =
    [];
  for (const w of words) {
    if (!w.bbox || !w.text?.trim()) continue;
    out.push({
      text: w.text,
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1,
    });
  }
  return out;
}

function uniqueKeepOrder(motors: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of motors) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

/**
 * Columna ENGINE No completa: todas las cajas de la franja + recorte
 * de la columna + una celda por fila. No se detiene en el primer serial.
 */
async function harvestFullEngineColumn(
  worker: TessWorker,
  psmSingleColumn: unknown,
  imageBuffer: Buffer
): Promise<string[]> {
  const prepared = await upscaleForOcr(imageBuffer, 1600);
  const { loadImage } = await import("@napi-rs/canvas");
  const meta = await loadImage(prepared);
  const page = await recognizeWords(worker, prepared);
  let motors = uniqueKeepOrder([
    ...collectEngineNosFromColumnWords(glyphsFromTessWords(page.words)),
    ...collectEngineNosInOrder(page.text),
  ]);

  const seeds = glyphsFromTessWords(page.words).filter((w) =>
    /S[O0Q]RE|C16TD/i.test(w.text)
  );
  let x0 = Math.floor(meta.width * 0.46);
  let stripW = Math.ceil(meta.width * 0.54);
  if (seeds.length > 0) {
    const xs = seeds.map((s) => (s.x0 + s.x1) / 2).sort((a, b) => a - b);
    const colX = xs[Math.floor(xs.length / 2)]!;
    const w = Math.max(90, ...seeds.map((s) => s.x1 - s.x0));
    x0 = Math.max(0, Math.floor(colX - w));
    stripW = Math.min(meta.width - x0, Math.ceil(w * 2.8));
  }

  const strip = await cropPixels(prepared, x0, 0, stripW, meta.height);
  const stripPass = await recognizeWords(worker, strip);
  motors = uniqueKeepOrder([
    ...motors,
    ...collectEngineNosFromColumnWords(glyphsFromTessWords(stripPass.words)),
    ...collectEngineNosInOrder(stripPass.text),
    ...collectEngineNosInOrder(
      await recognizeCertPage(worker, strip, [psmSingleColumn])
    ),
  ]);
  if (motors.length >= 8) return motors;

  const cells = Math.max(8, motors.length + 2);
  try {
    for (const band of await sliceHorizontalBands(strip, cells)) {
      try {
        motors = uniqueKeepOrder([
          ...motors,
          ...collectEngineNosInOrder(
            await recognizeCertPage(worker, band, [psmSingleColumn])
          ),
        ]);
      } catch {
        // celda vacía
      }
    }
  } catch {
    // sin celdas
  }
  return motors;
}

/**
 * OCR de factura completa (sin whitelist de VIN) para consignatario,
 * destino, nº factura y CIF. La pasada de VIN excluye I/espacios.
 */
export async function extractInvoicePlainTextWithTesseract(
  imageBuffer: Buffer
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => undefined,
  });
  try {
    const prepared = await upscaleForOcr(imageBuffer, 1600);
    const texts: string[] = [];
    for (const psm of [PSM.AUTO, PSM.SPARSE_TEXT]) {
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: psm as never,
      });
      const result = await worker.recognize(prepared);
      texts.push(result.data.text ?? "");
    }
    const ranked = texts
      .map((t) => ({
        t,
        score: t.length + (INVOICE_SIGNAL_RE.test(t) ? 4000 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    return (ranked[0]?.t ?? texts.join("\n")).trim();
  } finally {
    await worker.terminate();
  }
}

/** OCR de la página 2 del COO: prioriza la columna ENGINE No, no la factura. */
export async function extractCertificatePagePlainTextWithTesseract(
  imageBuffer: Buffer,
  options?: { fast?: boolean }
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => undefined,
  });
  try {
    const prepared = await upscaleForOcr(imageBuffer, options?.fast ? 1400 : 1800);
    const texts: string[] = [];
    const psms = options?.fast
      ? [PSM.AUTO]
      : [PSM.AUTO, PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT];
    for (const psm of psms) {
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: psm as never,
      });
      const result = await worker.recognize(prepared);
      texts.push(result.data.text ?? "");
    }
    const ranked = texts
      .map((t) => ({
        t,
        score: scoreCertificatePageOcrText(t),
      }))
      .sort((a, b) => b.score - a.score);
    return (ranked[0]?.t ?? texts.join("\n")).trim();
  } finally {
    await worker.terminate();
  }
}

/**
 * Pág. 2 del COO: el cuadro puede ir vertical o apaisado.
 * Prueba 0°/90°/180°/270°. Si sale el 1er ENGINE No, lee la columna hacia abajo.
 */
export async function extractCertificatePagePlainTextOriented(
  imageBuffer: Buffer
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const { rotateImageBuffer } = await import("@/lib/ai/image-orient");
  const worker = await createWorker("eng", 1, {
    logger: () => undefined,
  });
  try {
    const candidates: Buffer[] = [imageBuffer];
    for (const deg of [90, 270, 180] as const) {
      try {
        candidates.push((await rotateImageBuffer(imageBuffer, deg)).buffer);
      } catch {
        // rotación no disponible
      }
    }

    let bestImg = candidates[0]!;
    let best = "";
    let bestScore = -1;
    for (const img of candidates) {
      const text = await recognizeCertPage(worker, img, [PSM.AUTO]);
      const score = scoreCertificatePageOcrText(text);
      if (score > bestScore) {
        bestScore = score;
        best = text;
        bestImg = img;
      }
      if (countSqreTokens(text) >= 8) return text;
    }

    // Columna completa: todas las cajas + recorte + celdas (no solo el 1º).
    if (countSqreTokens(best) >= 1) {
      try {
        const column = await harvestFullEngineColumn(
          worker,
          PSM.SINGLE_COLUMN,
          bestImg
        );
        if (column.length > 0) {
          best = `${best}\nENGINE NO\n${column.join("\n")}`;
          if (column.length >= 4) return best;
        }
      } catch {
        // sin cajas de palabras
      }
    }
    if (countSqreTokens(best) >= 6) return best;

    const extra = await recognizeCertPage(worker, bestImg, [
      PSM.SINGLE_BLOCK,
      PSM.SPARSE_TEXT,
      PSM.SINGLE_COLUMN,
    ]);
    best = `${best}\n${extra}`;
    if (countSqreTokens(best) >= 6) return best;

    const chunks: string[] = [best];
    try {
      const { loadImage } = await import("@napi-rs/canvas");
      const meta = await loadImage(bestImg);
      chunks.push(
        await recognizeCertPage(
          worker,
          await cropPixels(bestImg, meta.width * 0.45, 0, meta.width * 0.55, meta.height),
          [PSM.SINGLE_COLUMN]
        )
      );
    } catch {
      // mitad derecha
    }
    try {
      for (const band of await sliceHorizontalBands(bestImg, 8)) {
        try {
          chunks.push(await recognizeCertPage(worker, band, [PSM.AUTO]));
        } catch {
          // franja ilegible
        }
      }
    } catch {
      // sin franjas
    }
    return chunks.join("\n");
  } finally {
    await worker.terminate();
  }
}

async function recognizeText(
  worker: TessWorker,
  image: Buffer,
  psm: unknown
): Promise<string> {
  await worker.setParameters({
    tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: psm as never,
  });
  const prepared = await upscaleForOcr(image);
  const result = await worker.recognize(prepared);
  return result.data.text ?? "";
}

/**
 * Reconoce VIN en una o varias imágenes (página, tabla, columna Code/Chasis).
 */
export async function extractVinsWithTesseract(
  imageBuffer: Buffer | Buffer[]
): Promise<TesseractVinResult> {
  const images = Array.isArray(imageBuffer) ? imageBuffer : [imageBuffer];
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => undefined,
  });
  const allCounts = new Map<string, number>();
  const textParts: string[] = [];
  let textSample = "";

  try {
    for (const raw of images) {
      const texts: string[] = [
        await recognizeText(worker, raw, PSM.SINGLE_BLOCK),
        await recognizeText(worker, raw, PSM.SINGLE_COLUMN),
      ];

      const bump = (vins: string[]) => {
        for (const vin of vins) {
          allCounts.set(vin, (allCounts.get(vin) ?? 0) + 1);
        }
      };
      bump(extractVinsFromOcrText(texts.join("\n")));

      const { loadImage } = await import("@napi-rs/canvas");
      const meta = await loadImage(raw);
      const isNarrow = meta.width < meta.height * 0.55 || meta.width < 560;
      if (isNarrow && allCounts.size < 10) {
        const bands = await sliceHorizontalBands(raw, 20);
        for (const band of bands) {
          texts.push(await recognizeText(worker, band, PSM.SINGLE_LINE));
        }
        bump(extractVinsFromOcrText(texts.join("\n")));
      }

      const merged = texts.join("\n");
      textParts.push(merged);
      if (!textSample) {
        textSample = merged.replace(/\s+/g, " ").trim().slice(0, 240);
      }
    }
  } finally {
    await worker.terminate();
  }

  let ranked = [...allCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  if (ranked.length > 22) {
    const frequent = ranked.filter(([, c]) => c >= 2);
    if (frequent.length >= 8) ranked = frequent;
  }

  return {
    vins: ranked.map(([v]) => v),
    textSample,
    fullText: textParts.join("\n\n"),
  };
}

/**
 * Orienta una foto de hoja anexa (a menudo rotada 90°) y prueba OCR.
 * Devuelve el mejor resultado por cantidad de VIN.
 */
export async function extractVinsWithTesseractOriented(
  imageBuffer: Buffer
): Promise<TesseractVinResult> {
  const { loadImage } = await import("@napi-rs/canvas");
  const { rotateImageBuffer } = await import("@/lib/ai/image-orient");
  const meta = await loadImage(imageBuffer);
  const candidates: Buffer[] = [imageBuffer];

  // Foto vertical de documento apaisado → probar 90° y 270°
  if (meta.height >= meta.width * 0.95) {
    for (const deg of [90, 270] as const) {
      try {
        const rotated = await rotateImageBuffer(imageBuffer, deg);
        candidates.push(rotated.buffer);
      } catch {
        // ignore
      }
    }
  }

  let best: TesseractVinResult = { vins: [], textSample: "", fullText: "" };
  for (const img of candidates) {
    const result = await extractVinsWithTesseract(img);
    if (
      result.vins.length > best.vins.length ||
      (result.vins.length === best.vins.length &&
        result.fullText.length > best.fullText.length)
    ) {
      best = result;
    }
  }
  return best;
}
