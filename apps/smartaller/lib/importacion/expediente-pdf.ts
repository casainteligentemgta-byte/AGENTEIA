import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { placaRealVisible } from "@/lib/importacion/expediente";
import { formatPartidaFuente } from "@/lib/arancel/partida-utils";
import {
  ESTADO_PRESENTACION_LABELS,
  computePlazosAduaneros,
} from "@/lib/importacion/plazos";
import { clasificarTipoImportadorPorRif } from "@/lib/importacion/cumplimiento-importador";
import {
  docsDesaduanamientoPdfPorRegimen,
  labelRegimenImportacion,
} from "@/lib/importacion/regimenes";
import {
  DOCUMENTO_LABELS,
  ESTADO_NACIONALIZACION_LABELS,
  ESTADO_SENIAT_LABELS,
  MEMORIA_FOTOGRAFICA_TIPOS,
  PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
  PL_DESADUANAMIENTO_NUEVOS_TIPOS,
  PL_EMBARQUE_DOCUMENTO_TIPOS,
  PL_FASE1_REGISTRO_DOCUMENTO_TIPOS,
  docsMatriculacionPdfTipos,
  PL_MATRICULACION_NUEVOS_TIPOS,
  PL_NACIONALIZACION_M2_TIPOS,
  PL_NACIONALIZACION_M3_TIPOS,
  SEGURO_DOCUMENTO_TIPOS,
  type DocumentoTipo,
  type EstadoNacionalizacion,
  type EstadoSeniat,
  type ImportacionData,
  type SeguroData,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

/** Datos mínimos del expediente para armar el PDF. */
export type ExpedientePdfSource = {
  placa: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serial_motor: string | null;
  serial_carroceria: string | null;
  kilometraje_ultimo: number | null;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  cedula_propietario: string | null;
  email_propietario: string | null;
  codigoExpediente: string | null;
  documentos: VehiculosDocumentos;
  importacion: ImportacionData;
  seguro: SeguroData;
};

const A4_W = 595;
const A4_H = 842;
const MARGIN = 48;
const MAX_PAGES_PER_DOC = 20;
const MAX_ATTACHMENT_PAGES = 100;
const FETCH_TIMEOUT_MS = 20_000;

type LinePair = { label: string; value: string };

/** Helvetica/WinAnsi: evita caracteres fuera de Latin-1 que rompen pdf-lib. */
function winAnsi(s: string): string {
  return s
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\u0000-\u00FF]/g, "?");
}

function txt(v: string | number | null | undefined, fallback = "-"): string {
  if (v == null) return fallback;
  if (typeof v === "string" && !v.trim()) return fallback;
  return winAnsi(String(v));
}

function uniqueTipos(...groups: DocumentoTipo[][]): DocumentoTipo[] {
  const seen = new Set<DocumentoTipo>();
  const out: DocumentoTipo[] = [];
  for (const group of groups) {
    for (const tipo of group) {
      if (seen.has(tipo)) continue;
      seen.add(tipo);
      out.push(tipo);
    }
  }
  return out;
}

function expedienteDocTipos(): DocumentoTipo[] {
  return uniqueTipos(
    PL_FASE1_REGISTRO_DOCUMENTO_TIPOS,
    PL_EMBARQUE_DOCUMENTO_TIPOS,
    PL_DESADUANAMIENTO_NUEVOS_TIPOS,
    ["manual_vehiculo", "cedula", "titulo", "foto_comprador"],
    SEGURO_DOCUMENTO_TIPOS,
    PL_MATRICULACION_NUEVOS_TIPOS,
    PL_NACIONALIZACION_M2_TIPOS,
    PL_NACIONALIZACION_M3_TIPOS
  );
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = winAnsi(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
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
  return lines;
}

function addBlankPage(pdf: PDFDocument): PDFPage {
  return pdf.addPage([A4_W, A4_H]);
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  title: string,
  subtitle?: string
): number {
  let y = A4_H - MARGIN;
  page.drawText(winAnsi(title), {
    x: MARGIN,
    y,
    size: 16,
    font: bold,
    color: rgb(0.05, 0.15, 0.28),
  });
  y -= 22;
  if (subtitle) {
    page.drawText(winAnsi(subtitle), {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.4, 0.45),
    });
    y -= 18;
  }
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4_W - MARGIN, y },
    thickness: 1,
    color: rgb(0.75, 0.8, 0.85),
  });
  return y - 20;
}

function drawSectionTitle(page: PDFPage, bold: PDFFont, title: string, y: number): number {
  page.drawText(winAnsi(title), {
    x: MARGIN,
    y,
    size: 12,
    font: bold,
    color: rgb(0.08, 0.45, 0.55),
  });
  return y - 18;
}

function drawPairs(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  pairs: LinePair[],
  startY: number
): { page: PDFPage; y: number } {
  let current = page;
  let y = startY;
  const labelW = 150;
  const valueW = A4_W - MARGIN * 2 - labelW - 8;
  const size = 9;
  const lineH = 12;

  for (const pair of pairs) {
    const valueLines = wrapLines(pair.value, font, size, valueW);
    const blockH = Math.max(1, valueLines.length) * lineH + 4;
    if (y - blockH < MARGIN) {
      current = addBlankPage(pdf);
      y = A4_H - MARGIN;
    }
    current.drawText(winAnsi(pair.label), {
      x: MARGIN,
      y: y - lineH + 2,
      size,
      font: bold,
      color: rgb(0.35, 0.4, 0.45),
    });
    let vy = y;
    for (const line of valueLines) {
      current.drawText(winAnsi(line), {
        x: MARGIN + labelW,
        y: vy - lineH + 2,
        size,
        font,
        color: rgb(0.1, 0.12, 0.15),
      });
      vy -= lineH;
    }
    y -= blockH;
  }
  return { page: current, y };
}

function separatorPage(pdf: PDFDocument, bold: PDFFont, font: PDFFont, title: string, note?: string) {
  const page = addBlankPage(pdf);
  page.drawText(winAnsi(title), {
    x: MARGIN,
    y: A4_H / 2 + 20,
    size: 14,
    font: bold,
    color: rgb(0.05, 0.15, 0.28),
  });
  if (note) {
    const lines = wrapLines(note, font, 10, A4_W - MARGIN * 2);
    let y = A4_H / 2 - 8;
    for (const line of lines) {
      page.drawText(winAnsi(line), {
        x: MARGIN,
        y,
        size: 10,
        font,
        color: rgb(0.4, 0.45, 0.5),
      });
      y -= 14;
    }
  }
}

async function fetchAttachment(
  url: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) return null;
    return { bytes: buf, contentType };
  } catch {
    return null;
  }
}

function looksLikePdf(bytes: Uint8Array, contentType: string, url: string): boolean {
  if (contentType.includes("pdf")) return true;
  if (/\.pdf(\?|$)/i.test(url)) return true;
  return (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

function looksLikePng(bytes: Uint8Array, contentType: string): boolean {
  if (contentType.includes("png")) return true;
  return (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function looksLikeJpeg(bytes: Uint8Array, contentType: string): boolean {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return true;
  return bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function embedImagePage(
  pdf: PDFDocument,
  bytes: Uint8Array,
  kind: "png" | "jpg",
  caption: string,
  bold: PDFFont
): Promise<number> {
  const image = kind === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const page = addBlankPage(pdf);
  page.drawText(winAnsi(caption), {
    x: MARGIN,
    y: A4_H - MARGIN,
    size: 11,
    font: bold,
    color: rgb(0.05, 0.15, 0.28),
  });
  const top = A4_H - MARGIN - 24;
  const bottom = MARGIN;
  const maxW = A4_W - MARGIN * 2;
  const maxH = top - bottom;
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const w = image.width * scale;
  const h = image.height * scale;
  page.drawImage(image, {
    x: MARGIN + (maxW - w) / 2,
    y: bottom + (maxH - h) / 2,
    width: w,
    height: h,
  });
  return 1;
}

async function appendAttachment(
  pdf: PDFDocument,
  bold: PDFFont,
  font: PDFFont,
  label: string,
  url: string,
  pagesUsed: { count: number }
): Promise<void> {
  if (pagesUsed.count >= MAX_ATTACHMENT_PAGES) {
    separatorPage(
      pdf,
      bold,
      font,
      label,
      "Se omitió por límite de páginas del PDF. Ábrelo desde la ficha digital."
    );
    pagesUsed.count += 1;
    return;
  }

  const fetched = await fetchAttachment(url);
  if (!fetched) {
    separatorPage(pdf, bold, font, label, "No se pudo descargar este archivo para incluirlo.");
    pagesUsed.count += 1;
    return;
  }

  const { bytes, contentType } = fetched;

  try {
    if (looksLikePdf(bytes, contentType, url)) {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const indices = src.getPageIndices().slice(0, MAX_PAGES_PER_DOC);
      const remaining = MAX_ATTACHMENT_PAGES - pagesUsed.count;
      const take = indices.slice(0, Math.max(0, remaining));
      if (take.length === 0) {
        separatorPage(pdf, bold, font, label, "Documento omitido por límite de páginas.");
        pagesUsed.count += 1;
        return;
      }
      separatorPage(
        pdf,
        bold,
        font,
        label,
        take.length < indices.length
          ? `Incluye las primeras ${take.length} páginas del documento.`
          : undefined
      );
      pagesUsed.count += 1;
      const copied = await pdf.copyPages(src, take);
      for (const p of copied) {
        pdf.addPage(p);
        pagesUsed.count += 1;
      }
      return;
    }

    if (looksLikePng(bytes, contentType)) {
      separatorPage(pdf, bold, font, label);
      pagesUsed.count += 1;
      pagesUsed.count += await embedImagePage(pdf, bytes, "png", label, bold);
      return;
    }

    if (looksLikeJpeg(bytes, contentType)) {
      separatorPage(pdf, bold, font, label);
      pagesUsed.count += 1;
      pagesUsed.count += await embedImagePage(pdf, bytes, "jpg", label, bold);
      return;
    }

    // Intento final: muchos uploads PL ya son PDF aunque el content-type falle.
    try {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const indices = src.getPageIndices().slice(0, MAX_PAGES_PER_DOC);
      separatorPage(pdf, bold, font, label);
      pagesUsed.count += 1;
      const copied = await pdf.copyPages(src, indices);
      for (const p of copied) {
        pdf.addPage(p);
        pagesUsed.count += 1;
      }
    } catch {
      separatorPage(
        pdf,
        bold,
        font,
        label,
        "Formato no soportado para incrustar. Ábrelo desde la ficha digital."
      );
      pagesUsed.count += 1;
    }
  } catch {
    separatorPage(pdf, bold, font, label, "Error al incrustar este archivo.");
    pagesUsed.count += 1;
  }
}

/** Genera PDF del expediente completo (datos + documentos + fotos). */
export async function buildExpedientePdf(ficha: ExpedientePdfSource): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const codigo = ficha.codigoExpediente ?? ficha.placa;
  const placa = placaRealVisible(ficha.placa, ficha.codigoExpediente);
  const imp = ficha.importacion;
  const seg = ficha.seguro;
  const tituloVehiculo =
    [ficha.marca, ficha.modelo].filter(Boolean).join(" ") || "Expediente Puerto Libre";

  let page = addBlankPage(pdf);
  let y = drawHeader(
    page,
    font,
    bold,
    "Expediente Puerto Libre",
    `${codigo} · SmartTaller`
  );

  y = drawSectionTitle(page, bold, "Vehículo", y);
  ({ page, y } = drawPairs(pdf, page, font, bold, [
    { label: "Expediente", value: codigo },
    { label: "Marca / modelo", value: tituloVehiculo },
    { label: "Color", value: txt(ficha.color) },
    { label: "Año", value: txt(imp.anio) },
    { label: "Serial motor", value: txt(ficha.serial_motor) },
    { label: "VIN", value: txt(imp.vin) },
    { label: "Serial carrocería", value: txt(ficha.serial_carroceria) },
    { label: "Kilometraje", value: txt(ficha.kilometraje_ultimo) },
    { label: "Partida arancelaria", value: txt(imp.partidaArancelaria) },
    {
      label: "Origen de la partida",
      value: txt(
        formatPartidaFuente(
          imp.partidaArancelariaFuente,
          imp.partidaArancelariaFundamento
        )
      ),
    },
    { label: "Cilindrada (cc)", value: txt(imp.cilindradaCc) },
    { label: "Combustible", value: txt(imp.tipoCombustible) },
    {
      label: "Condición",
      value:
        imp.condicionVehiculo === "nuevo"
          ? "Nuevo"
          : imp.condicionVehiculo === "usado"
            ? "Usado"
            : "—",
    },
    ...(imp.condicionVehiculo === "usado"
      ? [
          {
            label: "Subasta",
            value:
              imp.esSubasta === true ? "Sí" : imp.esSubasta === false ? "No" : "—",
          },
        ]
      : []),
    { label: "Placa", value: txt(placa) },
  ], y));

  y -= 10;
  if (y < MARGIN + 80) {
    page = addBlankPage(pdf);
    y = A4_H - MARGIN;
  }
  y = drawSectionTitle(page, bold, "Importador / comprador", y);
  ({ page, y } = drawPairs(pdf, page, font, bold, [
    { label: "Importador", value: txt(imp.importadorNombre) },
    { label: "RIF importador", value: txt(imp.importadorDocumento) },
    { label: "Tel. importador", value: txt(imp.importadorTelefono) },
    { label: "Email importador", value: txt(imp.importadorEmail) },
    { label: "Dirección fiscal", value: txt(imp.importadorDireccion) },
    { label: "Propietario", value: txt(ficha.nombre_cliente) },
    { label: "Cédula propietario", value: txt(ficha.cedula_propietario) },
    { label: "Tel. propietario", value: txt(ficha.telefono_cliente) },
    { label: "Email propietario", value: txt(ficha.email_propietario) },
    { label: "Dirección comprador", value: txt(imp.compradorDireccion) },
  ], y));

  y -= 10;
  if (y < MARGIN + 80) {
    page = addBlankPage(pdf);
    y = A4_H - MARGIN;
  }
  y = drawSectionTitle(page, bold, "Importación", y);
  const plazos = computePlazosAduaneros(imp);
  ({ page, y } = drawPairs(pdf, page, font, bold, [
    { label: "Régimen", value: txt(labelRegimenImportacion(imp.regimen)) },
    { label: "Aduana", value: txt(imp.aduana) },
    { label: "País origen", value: txt(imp.paisOrigen) },
    { label: "Puerto", value: txt(imp.puerto) },
    {
      label: "Tránsito / USO24",
      value: txt(
        imp.modalidadTransito === "transito"
          ? "Tránsito"
          : imp.modalidadTransito === "uso24"
            ? "USO24"
            : imp.modalidadTransito === "ninguno"
              ? "No"
              : null
      ),
    },
    { label: "Aduana tránsito", value: txt(imp.aduanaTransito) },
    { label: "Nº BL / Guía", value: txt(imp.numeroBl) },
    { label: "Contenedor", value: txt(imp.numeroContenedor) },
    { label: "Fecha llegada buque", value: txt(imp.fechaLlegadaBuque) },
    { label: "Fecha ingreso PL", value: txt(imp.fechaIngreso) },
    { label: "Fecha liquidación SENIAT", value: txt(imp.fechaLiquidacion) },
    { label: "Valor CIF", value: txt(imp.valorCif) },
    { label: "Tasa BCV", value: txt(imp.tasaCambioBcv) },
    { label: "Ad-Valorem (%)", value: txt(imp.tarifaAdValoremPct) },
    { label: "Aranceles (USD)", value: txt(imp.costosArancelariosUsd) },
    { label: "Nº expediente SENIAT", value: txt(imp.numeroExpedienteSeniat) },
    { label: "Nº DAV", value: txt(imp.numeroDav) },
    { label: "Nº certificado origen", value: txt(imp.numeroCertificadoOrigen) },
    { label: "Nº lista empaque", value: txt(imp.numeroListaEmpaque) },
    { label: "Nº póliza transporte", value: txt(imp.numeroPolizaTransporte) },
    {
      label: "Nacionalización",
      value:
        ESTADO_NACIONALIZACION_LABELS[
          (imp.estadoNacionalizacion as EstadoNacionalizacion) ?? "pendiente"
        ],
    },
    {
      label: "SENIAT",
      value: ESTADO_SENIAT_LABELS[(imp.estadoSeniat as EstadoSeniat) ?? "pendiente"],
    },
    {
      label: "Próxima presentación",
      value: txt(plazos.proximaFechaPresentacion),
    },
    {
      label: "Estado presentación",
      value: plazos.estadoPresentacion
        ? ESTADO_PRESENTACION_LABELS[plazos.estadoPresentacion]
        : "-",
    },
    { label: "Observaciones", value: txt(imp.observaciones) },
  ], y));

  y -= 10;
  if (y < MARGIN + 80) {
    page = addBlankPage(pdf);
    y = A4_H - MARGIN;
  }
  y = drawSectionTitle(page, bold, "Seguro", y);
  ({ page, y } = drawPairs(pdf, page, font, bold, [
    { label: "Aseguradora", value: txt(seg.aseguradora) },
    { label: "Nro póliza", value: txt(seg.numeroPoliza) },
    { label: "Cobertura", value: txt(seg.tipoCobertura) },
    { label: "Vigencia desde", value: txt(seg.vigenciaDesde) },
    { label: "Vigencia hasta", value: txt(seg.vigenciaHasta) },
    { label: "Monto asegurado", value: txt(seg.montoAsegurado) },
    { label: "Corredor", value: txt(seg.corredor) },
  ], y));

  // Índice de documentos
  page = addBlankPage(pdf);
  y = drawHeader(page, font, bold, "Índice de documentos y fotos", codigo);

  const docTipos = expedienteDocTipos();
  const fotoTipos = [...MEMORIA_FOTOGRAFICA_TIPOS];
  const indexPairs: LinePair[] = [
    ...docTipos.map((tipo) => ({
      label: DOCUMENTO_LABELS[tipo],
      value: ficha.documentos[tipo]?.url ? "Cargado" : "Pendiente",
    })),
    ...fotoTipos.map((tipo) => ({
      label: DOCUMENTO_LABELS[tipo],
      value: ficha.documentos[tipo]?.url ? "Cargada" : "Pendiente",
    })),
  ];
  ({ page, y } = drawPairs(pdf, page, font, bold, indexPairs, y));

  const pagesUsed = { count: 0 };
  const attachments: Array<{ tipo: DocumentoTipo; label: string }> = [
    ...docTipos.map((tipo) => ({ tipo, label: DOCUMENTO_LABELS[tipo] })),
    ...fotoTipos.map((tipo) => ({ tipo, label: DOCUMENTO_LABELS[tipo] })),
  ];

  for (const item of attachments) {
    const url = ficha.documentos[item.tipo]?.url;
    if (!url) continue;
    await appendAttachment(pdf, bold, font, item.label, url, pagesUsed);
  }

  const saved = await pdf.save({ useObjectStreams: false });
  return saved;
}

export function expedientePdfFileName(codigo: string | null | undefined, placa: string): string {
  const raw = (codigo?.trim() || placa || "expediente").replace(/[^\w.\-]+/g, "_");
  return `Expediente-${raw}.pdf`;
}

/**
 * PDF de carpeta física de desaduanamiento SENIAT:
 * portada + índice + documentos consignables (para imprimir / archivar).
 */
export async function buildDesaduanamientoPdf(
  ficha: ExpedientePdfSource
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const codigo = ficha.codigoExpediente ?? ficha.placa;
  const placa = placaRealVisible(ficha.placa, ficha.codigoExpediente);
  const imp = ficha.importacion;
  const tituloVehiculo =
    [ficha.marca, ficha.modelo].filter(Boolean).join(" ") || "Vehiculo";

  let page = addBlankPage(pdf);
  let y = drawHeader(
    page,
    font,
    bold,
    "Expediente PDF SENIAT",
    `${codigo} · SmartTaller`
  );

  y = drawSectionTitle(page, bold, "Expediente", y);
  ({ page, y } = drawPairs(
    pdf,
    page,
    font,
    bold,
    [
      { label: "Expediente PL", value: codigo },
      { label: "Vehiculo", value: tituloVehiculo },
      { label: "Color / anio", value: `${txt(ficha.color)} / ${txt(imp.anio)}` },
      { label: "Serial carroceria", value: txt(ficha.serial_carroceria) },
      { label: "Placa", value: txt(placa) },
      { label: "Regimen", value: txt(labelRegimenImportacion(imp.regimen)) },
      { label: "Aduana", value: txt(imp.aduana) },
      { label: "Puerto", value: txt(imp.puerto) },
      {
        label: "Transito / USO24",
        value: txt(
          imp.modalidadTransito === "transito"
            ? "Transito"
            : imp.modalidadTransito === "uso24"
              ? "USO24"
              : imp.modalidadTransito === "ninguno"
                ? "No"
                : null
        ),
      },
      { label: "Aduana transito", value: txt(imp.aduanaTransito) },
      { label: "Agente de aduanas", value: txt(imp.agenteAduanal) },
      { label: "Fecha llegada buque", value: txt(imp.fechaLlegadaBuque) },
      { label: "Fecha ingreso PL", value: txt(imp.fechaIngreso) },
      { label: "Nº BL / Guia", value: txt(imp.numeroBl) },
      { label: "Contenedor", value: txt(imp.numeroContenedor) },
      { label: "Nº DAV", value: txt(imp.numeroDav) },
      { label: "Nº expediente SENIAT", value: txt(imp.numeroExpedienteSeniat) },
      { label: "Importador", value: txt(imp.importadorNombre) },
      { label: "RIF / cedula importador", value: txt(imp.importadorDocumento) },
      {
        label: "Direccion importador",
        value: txt(imp.importadorDireccion) || "Nueva Esparta, Venezuela",
      },
    ],
    y
  ));

  page = addBlankPage(pdf);
  y = drawHeader(
    page,
    font,
    bold,
    "Indice — Expediente SENIAT",
    codigo
  );
  y = drawSectionTitle(page, bold, "Documentos a consignar", y);

  // Expediente PDF: sin pase de salida (se carga aparte en la planilla).
  const carpetaTipos = docsDesaduanamientoPdfPorRegimen(
    imp.regimen,
    PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
    {
      esJuridica:
        clasificarTipoImportadorPorRif(imp.importadorDocumento) === "juridica",
    }
  );
  const indexPairs: LinePair[] = carpetaTipos.map((tipo, i) => ({
    label: `${i + 1}. ${DOCUMENTO_LABELS[tipo]}`,
    value: ficha.documentos[tipo]?.url ? "Cargado" : "Pendiente",
  }));
  ({ page, y } = drawPairs(pdf, page, font, bold, indexPairs, y));

  page.drawText(
    winAnsi(
      "Expediente PDF SENIAT. Canalizar mediante Agente de Aduanas autorizado. Imprimir para el expediente fisico."
    ),
    {
      x: MARGIN,
      y: MARGIN + 12,
      size: 8,
      font,
      color: rgb(0.35, 0.4, 0.45),
    }
  );

  const pagesUsed = { count: 0 };
  for (const tipo of carpetaTipos) {
    const url = ficha.documentos[tipo]?.url;
    if (!url) {
      separatorPage(
        pdf,
        bold,
        font,
        DOCUMENTO_LABELS[tipo],
        "Documento pendiente de carga en el expediente digital."
      );
      pagesUsed.count += 1;
      continue;
    }
    await appendAttachment(
      pdf,
      bold,
      font,
      DOCUMENTO_LABELS[tipo],
      url,
      pagesUsed
    );
  }

  return pdf.save({ useObjectStreams: false });
}

export function desaduanamientoPdfFileName(
  codigo: string | null | undefined,
  placa: string
): string {
  const raw = (codigo?.trim() || placa || "expediente").replace(/[^\w.\-]+/g, "_");
  return `Expediente-SENIAT-${raw}.pdf`;
}

/**
 * PDF de carpeta INTT (Matriculación):
 * portada + índice + anexos (referencias de fases anteriores + docs de esta fase).
 */
export async function buildMatriculacionPdf(
  ficha: ExpedientePdfSource
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const codigo = ficha.codigoExpediente ?? ficha.placa;
  const placa = placaRealVisible(ficha.placa, ficha.codigoExpediente);
  const imp = ficha.importacion;
  const tituloVehiculo =
    [ficha.marca, ficha.modelo].filter(Boolean).join(" ") || "Vehiculo";
  const requiereHomologacion = imp.requiereHomologacion === true;

  let page = addBlankPage(pdf);
  let y = drawHeader(
    page,
    font,
    bold,
    "Carpeta PDF Matriculacion INTT",
    `${codigo} · SmartTaller`
  );

  y = drawSectionTitle(page, bold, "Expediente", y);
  ({ page, y } = drawPairs(
    pdf,
    page,
    font,
    bold,
    [
      { label: "Expediente PL", value: codigo },
      { label: "Vehiculo", value: tituloVehiculo },
      { label: "Color / anio", value: `${txt(ficha.color)} / ${txt(imp.anio)}` },
      { label: "Serial carroceria", value: txt(ficha.serial_carroceria) },
      { label: "Placa", value: txt(placa) },
      { label: "Regimen", value: txt(labelRegimenImportacion(imp.regimen)) },
      { label: "Importador", value: txt(imp.importadorNombre) },
      { label: "RIF / cedula importador", value: txt(imp.importadorDocumento) },
      {
        label: "Homologacion",
        value: requiereHomologacion ? "Requerida" : "No aplica",
      },
      { label: "Fecha ingreso PL", value: txt(imp.fechaIngreso) },
      { label: "Nº BL / Guia", value: txt(imp.numeroBl) },
      { label: "Contenedor", value: txt(imp.numeroContenedor) },
    ],
    y
  ));

  page = addBlankPage(pdf);
  y = drawHeader(page, font, bold, "Indice — Carpeta INTT", codigo);
  y = drawSectionTitle(page, bold, "Documentos (referencia + carga)", y);

  const carpetaTipos = docsMatriculacionPdfTipos(requiereHomologacion);
  const indexPairs: LinePair[] = carpetaTipos.map((tipo, i) => ({
    label: `${i + 1}. ${DOCUMENTO_LABELS[tipo]}`,
    value: ficha.documentos[tipo]?.url ? "Cargado" : "Pendiente",
  }));
  ({ page, y } = drawPairs(pdf, page, font, bold, indexPairs, y));

  page.drawText(
    winAnsi(
      "Carpeta PDF para tramite INTT. Incluye recaudos de fases anteriores y los de Matriculacion."
    ),
    {
      x: MARGIN,
      y: MARGIN + 12,
      size: 8,
      font,
      color: rgb(0.35, 0.4, 0.45),
    }
  );

  const pagesUsed = { count: 0 };
  for (const tipo of carpetaTipos) {
    const url = ficha.documentos[tipo]?.url;
    if (!url) {
      separatorPage(
        pdf,
        bold,
        font,
        DOCUMENTO_LABELS[tipo],
        "Documento pendiente de carga en el expediente digital."
      );
      pagesUsed.count += 1;
      continue;
    }
    await appendAttachment(
      pdf,
      bold,
      font,
      DOCUMENTO_LABELS[tipo],
      url,
      pagesUsed
    );
  }

  return pdf.save({ useObjectStreams: false });
}

export function matriculacionPdfFileName(
  codigo: string | null | undefined,
  placa: string
): string {
  const raw = (codigo?.trim() || placa || "expediente").replace(/[^\w.\-]+/g, "_");
  return `Carpeta-INTT-${raw}.pdf`;
}
