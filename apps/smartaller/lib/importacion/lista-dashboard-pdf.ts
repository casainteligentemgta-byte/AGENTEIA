import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const A4_W = 595;
const A4_H = 842;
const MARGIN = 40;

export type ListaDashboardPdfColumn = {
  key: string;
  header: string;
  /** Fracción del ancho útil (suma ≈ 1). */
  width?: number;
};

export type ListaDashboardPdfRow = {
  cells: Record<string, string>;
};

export type ListaDashboardPdfInput = {
  title: string;
  subtitle?: string;
  columns: ListaDashboardPdfColumn[];
  rows: ListaDashboardPdfRow[];
  generatedAt?: Date;
};

/** Helvetica/WinAnsi: evita caracteres fuera de Latin-1 que rompen pdf-lib. */
function winAnsi(s: string): string {
  return s
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\u0000-\u00FF]/g, "?");
}

function txt(v: string | null | undefined, fallback = "-"): string {
  if (v == null || !String(v).trim()) return fallback;
  return winAnsi(String(v));
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = winAnsi(text).split(/\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const next = `${current} ${words[i]}`;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = words[i]!;
      }
    }
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

function formatGeneratedAt(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

function slugFile(title: string): string {
  return winAnsi(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function listaDashboardPdfFileName(title: string, at = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `${slugFile(title) || "lista"}_${y}-${m}-${d}.pdf`;
}

function columnWidths(
  columns: ListaDashboardPdfColumn[],
  usable: number
): number[] {
  const weights = columns.map((c) => (c.width && c.width > 0 ? c.width : 1));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => (w / sum) * usable);
}

function drawPageHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  title: string,
  subtitle: string | undefined,
  meta: string,
  pageNum: number,
  totalHint: string
): number {
  let y = A4_H - MARGIN;
  page.drawText(winAnsi(title), {
    x: MARGIN,
    y,
    size: 14,
    font: bold,
    color: rgb(0.05, 0.15, 0.28),
  });
  y -= 18;
  if (subtitle) {
    page.drawText(winAnsi(subtitle), {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: rgb(0.25, 0.3, 0.35),
    });
    y -= 14;
  }
  page.drawText(winAnsi(meta), {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });
  const pageLabel = `Pag. ${pageNum}${totalHint}`;
  const pw = font.widthOfTextAtSize(pageLabel, 8);
  page.drawText(pageLabel, {
    x: A4_W - MARGIN - pw,
    y,
    size: 8,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });
  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4_W - MARGIN, y },
    thickness: 1,
    color: rgb(0.75, 0.8, 0.85),
  });
  return y - 14;
}

function drawTableHeader(
  page: PDFPage,
  bold: PDFFont,
  columns: ListaDashboardPdfColumn[],
  widths: number[],
  y: number
): number {
  let x = MARGIN;
  const size = 8;
  for (let i = 0; i < columns.length; i++) {
    page.drawText(winAnsi(columns[i]!.header), {
      x,
      y,
      size,
      font: bold,
      color: rgb(0.2, 0.25, 0.3),
    });
    x += widths[i]!;
  }
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4_W - MARGIN, y },
    thickness: 0.6,
    color: rgb(0.8, 0.82, 0.86),
  });
  return y - 10;
}

/**
 * Genera un PDF tabular (A4) con el listado filtrado del dashboard Puerto Libre.
 */
export async function buildListaDashboardPdf(
  input: ListaDashboardPdfInput
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const generatedAt = input.generatedAt ?? new Date();
  const usable = A4_W - MARGIN * 2;
  const widths = columnWidths(input.columns, usable);
  const meta = `Generado: ${formatGeneratedAt(generatedAt)} · ${input.rows.length} registro(s)`;
  const subtitle =
    input.subtitle ??
    "Expediente Importacion Vehicular · Puerto Libre";

  let page = pdf.addPage([A4_W, A4_H]);
  let pageNum = 1;
  let y = drawPageHeader(
    page,
    font,
    bold,
    input.title,
    subtitle,
    meta,
    pageNum,
    ""
  );
  y = drawTableHeader(page, bold, input.columns, widths, y);

  const fontSize = 8;
  const lineH = 10;
  const bottom = MARGIN + 24;

  for (const row of input.rows) {
    const cellLines = input.columns.map((col, i) =>
      wrapLines(txt(row.cells[col.key]), font, fontSize, widths[i]! - 4)
    );
    const rowLines = Math.max(1, ...cellLines.map((l) => l.length));
    const rowHeight = rowLines * lineH + 6;

    if (y - rowHeight < bottom) {
      pageNum += 1;
      page = pdf.addPage([A4_W, A4_H]);
      y = drawPageHeader(
        page,
        font,
        bold,
        input.title,
        subtitle,
        meta,
        pageNum,
        ""
      );
      y = drawTableHeader(page, bold, input.columns, widths, y);
    }

    let x = MARGIN;
    for (let i = 0; i < input.columns.length; i++) {
      const lines = cellLines[i]!;
      let ly = y;
      for (const line of lines) {
        page.drawText(line, {
          x,
          y: ly,
          size: fontSize,
          font,
          color: rgb(0.1, 0.12, 0.16),
        });
        ly -= lineH;
      }
      x += widths[i]!;
    }
    y -= rowHeight;
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: A4_W - MARGIN, y: y + 4 },
      thickness: 0.3,
      color: rgb(0.9, 0.91, 0.93),
    });
  }

  if (input.rows.length === 0) {
    page.drawText(winAnsi("Sin registros para los filtros aplicados."), {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  return pdf.save();
}
