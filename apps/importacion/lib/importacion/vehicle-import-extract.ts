import { extractCargaMasivaEtapaAction } from "@/app/actions/nfc/importacion-carga-masiva";
import {
  formatCargaMasivaClientError,
  postSmartimportOcr,
  safeStorageFileName,
  type CargaMasivaStorageDocRef,
} from "@/lib/importacion/carga-masiva-client";
import {
  CARGA_MASIVA_ETAPA_HINTS,
  CARGA_MASIVA_ETAPA_LABELS,
  type CargaMasivaEtapaId,
  type CargaMasivaEtapaProgress,
} from "@/lib/importacion/carga-masiva-etapas";
import { vehicleCompleteness } from "@/lib/importacion/carga-masiva-ui";
import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { createClient } from "@/lib/supabase/client";
import { VEHICULO_DOCS_BUCKET } from "@/lib/vehiculos/upload-documento";

export type VehicleImportDoc = {
  file: File;
  tipo: "factura_comercial" | "certificado_origen";
};

export type ExtractProgressFn = (progress: CargaMasivaEtapaProgress) => void;

async function uploadDocs(
  tallerId: string,
  docs: VehicleImportDoc[],
  batchId: string
): Promise<CargaMasivaStorageDocRef[]> {
  const supabase = createClient();
  const refs: CargaMasivaStorageDocRef[] = [];
  for (const doc of docs) {
    const fileName = safeStorageFileName(doc.file.name);
    const path = `${tallerId}/carga-masiva-temp/${batchId}/${fileName}`;
    const { error } = await supabase.storage
      .from(VEHICULO_DOCS_BUCKET)
      .upload(path, doc.file, {
        upsert: false,
        contentType: doc.file.type || "application/pdf",
      });
    if (error) {
      throw new Error(`${doc.file.name}: ${error.message}`);
    }
    refs.push({ path, tipo: doc.tipo, fileName: doc.file.name });
  }
  return refs;
}

function rowVinCount(rows: CargaMasivaRow[]): number {
  return rows.filter(
    (row) => (row.serialCarroceria || row.vin || "").trim().length >= 11
  ).length;
}

export async function runVehicleImportExtract(params: {
  tallerId: string;
  factura: File;
  certificados: File[];
  onProgress: ExtractProgressFn;
}): Promise<
  | { ok: true; rows: CargaMasivaRow[]; warnings: string[] }
  | { ok: false; error: string; rows: CargaMasivaRow[]; warnings: string[] }
> {
  const docs: VehicleImportDoc[] = [
    { file: params.factura, tipo: "factura_comercial" },
    ...params.certificados.map((file) => ({
      file,
      tipo: "certificado_origen" as const,
    })),
  ];
  const etapas: CargaMasivaEtapaId[] =
    params.certificados.length > 0 ? ["vins", "datos", "certs"] : ["vins", "datos"];

  const batchId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;

  params.onProgress({
    etapa: "vins",
    label: "Subiendo documentos…",
    hint: "Preparando OCR",
    vinsEncontrados: 0,
    filasCompletas: 0,
    totalFilas: 0,
    pct: 4,
  });

  let currentRows: CargaMasivaRow[] = [];
  const warnings: string[] = [];

  try {
    const allRefs = await uploadDocs(params.tallerId, docs, batchId);

    for (let i = 0; i < etapas.length; i++) {
      const etapa = etapas[i]!;
      const storageDocs =
        etapa === "certs"
          ? allRefs.filter((ref) => ref.tipo === "certificado_origen")
          : allRefs.filter((ref) => ref.tipo === "factura_comercial");

      if (storageDocs.length === 0) {
        if (etapa === "certs") continue;
        return {
          ok: false,
          error: "Falta la factura comercial para extraer VIN",
          rows: currentRows,
          warnings,
        };
      }

      if (etapa === "certs") {
        for (let c = 0; c < storageDocs.length; c++) {
          const ref = storageDocs[c]!;
          params.onProgress({
            etapa: "certs",
            label: `Certificado ${c + 1}/${storageDocs.length}`,
            hint: ref.fileName,
            vinsEncontrados: rowVinCount(currentRows),
            filasCompletas: currentRows.filter(
              (row) => vehicleCompleteness(row).complete
            ).length,
            totalFilas: currentRows.length,
            pct: Math.round(70 + ((c + 1) / storageDocs.length) * 25),
          });
          const fd = new FormData();
          fd.set("etapa", "certs");
          fd.set("storageDocs", JSON.stringify([ref]));
          fd.set("rowsJson", JSON.stringify(currentRows));
          const result = await postSmartimportOcr(
            "/api/smartimport/ocr-carga-masiva",
            fd,
            extractCargaMasivaEtapaAction,
            { deadlineMs: 100_000 }
          );
          if (!result.success) {
            return {
              ok: false,
              error: `Certificado «${ref.fileName}»: ${result.error}`,
              rows: currentRows,
              warnings,
            };
          }
          currentRows = result.rows;
          warnings.push(...result.warnings);
        }
        continue;
      }

      params.onProgress({
        etapa,
        label: CARGA_MASIVA_ETAPA_LABELS[etapa],
        hint: CARGA_MASIVA_ETAPA_HINTS[etapa],
        vinsEncontrados: rowVinCount(currentRows),
        filasCompletas: currentRows.filter((row) =>
          vehicleCompleteness(row).complete
        ).length,
        totalFilas: currentRows.length,
        pct: Math.round((i / etapas.length) * 70),
      });

      const fd = new FormData();
      fd.set("etapa", etapa);
      fd.set("storageDocs", JSON.stringify(storageDocs));
      if (etapa !== "vins") {
        fd.set("rowsJson", JSON.stringify(currentRows));
      }
      const result = await postSmartimportOcr(
        "/api/smartimport/ocr-carga-masiva",
        fd,
        extractCargaMasivaEtapaAction,
        { deadlineMs: 110_000 }
      );
      if (!result.success) {
        return {
          ok: false,
          error: result.error,
          rows: currentRows,
          warnings,
        };
      }
      currentRows = result.rows;
      warnings.push(...result.warnings);
    }

    params.onProgress({
      etapa: "certs",
      label: "Listo",
      hint: `${currentRows.length} vehículo(s) encontrados`,
      vinsEncontrados: rowVinCount(currentRows),
      filasCompletas: currentRows.filter((row) =>
        vehicleCompleteness(row).complete
      ).length,
      totalFilas: currentRows.length,
      pct: 100,
    });

    return { ok: true, rows: currentRows, warnings };
  } catch (err) {
    return {
      ok: false,
      error: formatCargaMasivaClientError(err),
      rows: currentRows,
      warnings,
    };
  }
}
