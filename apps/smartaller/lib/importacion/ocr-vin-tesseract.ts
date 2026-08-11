/**
 * OCR local de VIN con Tesseract (sin OpenAI).
 * Útil en facturas Chery escaneadas cuando la visión LLM falla.
 */

import {
  extractVinStringsFromText,
  normalizeVinLoose,
} from "@/lib/importacion/vin-text";

/** Cuerpo Chery completo tras WMI: DC21B5VD713650 */
const CHERY_BODY_RE = /D[CB]21[A-HJ-NPR-Z0-9]{2}VD[0-9]{6}/gi;

/** Columna Code cortada: 21B5VD713650 */
const CHERY_SHORT_TAIL_RE = /21[A-HJ-NPR-Z0-9]{2}VD[0-9]{6}/gi;

const PLAUSIBLE_VIN_RE = /^(LVV|LVT|LVD|LSG|LFB|LFV|LHG|LDC)/;

/** VIN Chery Arrizo/Tiggo: LVV + DC/DB + 21 + 2 chars + VD + 6 dígitos */
const CHERY_FULL_RE = /^LVVD[CB]21[A-HJ-NPR-Z0-9]{2}VD[0-9]{6}$/;

export function isPlausibleOcrVin(vin: string): boolean {
  return vin.length === 17 && PLAUSIBLE_VIN_RE.test(vin);
}

/**
 * Chery export: índice 7 suele ser B; Tesseract lo lee como 3/8.
 */
export function repairCheryOcrVin(vin: string): string {
  if (!CHERY_FULL_RE.test(vin)) return vin;
  if (vin[7] === "B") return vin;
  return `${vin.slice(0, 7)}B${vin.slice(8)}`;
}

/** Elige DC vs DB según el serial visual (713=Arrizo, 602/010=Tiggo). */
function cheryPrefixesForTail(tail12: string): string[] {
  const afterVd = tail12.slice(6);
  if (afterVd.startsWith("713")) return ["LVVDC"];
  if (afterVd.startsWith("602") || afterVd.startsWith("010")) return ["LVVDB"];
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
    let vin = normalizeVinLoose(raw);
    if (!vin || vin.length !== 17 || !isPlausibleOcrVin(vin)) return;
    vin = repairCheryOcrVin(vin);
    found.add(vin);
  };

  for (const v of extractVinStringsFromText(text)) add(v);

  for (const line of text.split(/\n+/)) {
    const compact = line.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (compact.length < 12 || compact.length > 48) continue;
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
};

type TessWorker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;

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
 * Reconoce VIN en una o varias imágenes (página, tabla, columna Code).
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

      // Franjas solo si la columna es estrecha y aún hay pocos VIN
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
      if (!textSample) {
        textSample = merged.replace(/\s+/g, " ").trim().slice(0, 240);
      }
    }
  } finally {
    await worker.terminate();
  }

  let ranked = [...allCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  // Si hay demasiados candidatos OCR, quedarse con los que se repiten
  if (ranked.length > 22) {
    const frequent = ranked.filter(([, c]) => c >= 2);
    if (frequent.length >= 8) ranked = frequent;
  }

  return {
    vins: ranked.map(([v]) => v),
    textSample,
  };
}
