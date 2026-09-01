"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import type { ImportadorListItem } from "@/app/actions/nfc/importadores";
import { extractPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-extract";
import { getTasaBcvAction } from "@/app/actions/nfc/tasa-bcv";
import {
  copyCargaMasivaDocumentosAction,
  createPuertoLibreCargaMasivaAction,
  extractCargaMasivaEtapaAction,
  parseCargaMasivaSpreadsheetAction,
} from "@/app/actions/nfc/importacion-carga-masiva";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-vehiculo";
import type { DocumentoTipo } from "@/lib/schemas/vehiculo-documentos";
import {
  type CargaMasivaRow,
  emptyCargaMasivaRow,
} from "@/lib/importacion/carga-masiva-template";
import { readCargaMasivaSeed } from "@/lib/importacion/carga-masiva-seed";
import {
  CARGA_MASIVA_ETAPA_HINTS,
  CARGA_MASIVA_ETAPA_LABELS,
  cargaMasivaEtapasPlan,
  type CargaMasivaEtapaId,
  type CargaMasivaEtapaProgress,
} from "@/lib/importacion/carga-masiva-etapas";
import {
  applyImportadorToRows,
  applySharedLoteTechToRows,
  applySharedShipmentToRows,
  cargaMasivaRowStripeClass,
  cargaMasivaStickyIndexCellClass,
  cargaMasivaStickyIndexHeadClass,
  detectedImportadorFromRows,
  EMPTY_DETECTED_IMPORTADOR,
  EMPTY_SHARED_LOTE_TECH,
  EMPTY_SHARED_SHIPMENT,
  healCargaMasivaCheryRows,
  LOTE_MODALIDAD_TRANSITO_OPTIONS,
  LOTE_TIPO_COMBUSTIBLE_OPTIONS,
  persistLoteTechOnRows,
  groupByBlAndContainer,
  matchSerialKeyAmong,
  normalizeSerialKey,
  pairSerialsOneToOne,
  resumenSemaforo,
  rifCoincideConSeleccionado,
  sharedLoteTechFromRows,
  sharedShipmentFromRows,
  vehicleCompleteness,
  vehicleSemaforo,
  VEHICLE_FIELD_COLS,
  vehicleFieldHeaderClass,
  vehicleFieldInputClass,
  vehicleFieldInputSize,
  type CertMatch,
  type DetectedImportador,
  type SharedLoteTechFields,
  type SharedShipmentFields,
} from "@/lib/importacion/carga-masiva-ui";
import { cargaBlPath } from "@/lib/importacion/expediente-lote";
import { ADUANAS_VENEZUELA } from "@/lib/importacion/aduanas-venezuela";
import { PAISES } from "@/lib/importacion/paises";
import {
  parsePuertosDescarga,
  primaryPuertoDescarga,
  PUERTOS_DESCARGA_VENEZUELA,
  resolvePuertoDescarga,
} from "@/lib/importacion/puertos-venezuela";
import {
  formatCargaMasivaClientError,
  isCargaMasivaNetworkError,
  isOcrPollTimeoutError,
  postSmartimportOcr,
  safeStorageFileName,
  type CargaMasivaStorageDocRef,
} from "@/lib/importacion/carga-masiva-client";
import { createClient } from "@/lib/supabase/client";
import { VEHICULO_DOCS_BUCKET } from "@/lib/vehiculos/upload-documento";
import { normalizeImageFileForUpload } from "@/lib/normalize-image-file";
import { IMPORTADOR_TIPO_LABELS, formatImportadorDocumentoLine } from "@/lib/schemas/importador";
import {
  contentTypeForImportDoc,
  isPdfOrImageFile,
} from "@/lib/validations/vehicle-import";
import { isGenericModelo } from "@/lib/importacion/completitud-datos";
import {
  modelosDeMarca,
  resolveMarcaCatalogo,
} from "@/lib/importacion/vehiculo-catalog";
import {
  CargaMasivaBulkModelo,
  CargaMasivaColorCell,
  CargaMasivaMarcaCell,
  CargaMasivaModeloCell,
  CargaMasivaSelectAllCheckbox,
} from "@/components/nfc/CargaMasivaCatalogCell";

type Mode = "plantilla" | "documentos";

type DocItem = {
  id: string;
  file: File;
  tipo: "factura_comercial" | "bl_guia" | "certificado_origen";
};

export type CargaMasivaInitialDoc = {
  file: File;
  tipo: "factura_comercial" | "bl_guia" | "certificado_origen";
};

type Props = {
  initialImportadores: ImportadorListItem[];
  tallerId: string;
  embedded?: boolean;
  hideClienteSection?: boolean;
  initialSelectedImportador?: ImportadorListItem | null;
  initialRows?: CargaMasivaRow[];
  initialMode?: Mode;
  initialMessage?: string | null;
  initialDocs?: CargaMasivaInitialDoc[];
  certMergeRequest?: { files: File[]; requestId: number } | null;
  onSwitchToIndividual?: () => void;
};

export function PuertoLibreCargaMasiva({
  initialImportadores,
  tallerId,
  embedded = false,
  hideClienteSection = false,
  initialSelectedImportador = null,
  initialRows,
  initialMode,
  initialMessage = null,
  initialDocs = [],
  certMergeRequest = null,
  onSwitchToIndividual,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode ?? "documentos");
  const [rows, setRows] = useState<CargaMasivaRow[]>(initialRows ?? []);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [shared, setShared] = useState<SharedShipmentFields>({
    ...EMPTY_SHARED_SHIPMENT,
  });
  const [loteTech, setLoteTech] = useState<SharedLoteTechFields>({
    ...EMPTY_SHARED_LOTE_TECH,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCols, setBulkCols] = useState<Set<keyof CargaMasivaRow>>(
    () => new Set()
  );
  const [detectedImportador, setDetectedImportador] = useState<DetectedImportador>(
    { ...EMPTY_DETECTED_IMPORTADOR }
  );
  const [importadores] = useState(initialImportadores);
  const [selected, setSelected] = useState<ImportadorListItem | null>(
    initialSelectedImportador
  );
  const [clienteQuery, setClienteQuery] = useState("");
  const [certMatches, setCertMatches] = useState<CertMatch[]>([]);
  const [sheetPending, startSheetTransition] = useTransition();
  const [extractPending, startExtractTransition] = useTransition();
  const [importPending, startImportTransition] = useTransition();
  const pending = sheetPending || extractPending || importPending;
  const [error, setError] = useState<string | null>(null);
  const [, setWarnings] = useState<string[]>([]);
  const [resultMsg, setResultMsg] = useState<string | null>(initialMessage);
  const [createdExpedientes, setCreatedExpedientes] = useState<
    {
      vehiculoId: string;
      codigoExpediente: string;
      serial: string;
      numeroBl?: string;
      numeroContenedor?: string;
    }[]
  >([]);
  const [extractProgress, setExtractProgress] =
    useState<CargaMasivaEtapaProgress | null>(null);
  const [, setActiveEtapa] = useState<CargaMasivaEtapaId | null>(
    null
  );
  /** Etapas realmente terminadas (evita checks verdes falsos al estar en certs). */
  const [, setEtapasHechas] = useState<Set<CargaMasivaEtapaId>>(
    () => new Set()
  );
  const [blOcrPending, setBlOcrPending] = useState(false);
  const [tasaBcvPending, setTasaBcvPending] = useState(false);
  const [tasaBcvHint, setTasaBcvHint] = useState<string | null>(null);
  const tasaBcvReq = useRef(0);
  const sheetRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);
  const certsRef = useRef<HTMLInputElement>(null);
  const blRef = useRef<HTMLInputElement>(null);
  const seedApplied = useRef(false);
  const initialRowsApplied = useRef(false);
  const initialDocsApplied = useRef(false);
  const certMergeHandled = useRef<number | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const loteTechRef = useRef(loteTech);
  loteTechRef.current = loteTech;
  const sharedRef = useRef(shared);
  sharedRef.current = shared;

  useEffect(() => {
    if (initialRowsApplied.current || !initialRows?.length) return;
    initialRowsApplied.current = true;
    setRows(healCargaMasivaCheryRows(initialRows));
    setShared(sharedShipmentFromRows(initialRows));
    setLoteTech(sharedLoteTechFromRows(initialRows));
    setDetectedImportador(detectedImportadorFromRows(initialRows));
    if (initialMessage) {
      setResultMsg(initialMessage);
    }
    setWarnings([
      "Revisa VIN, motor, color y año de cada fila. Selecciona el importador y súbelos certificados de origen para completar motor.",
      "Aduana, BL y fecha de llegada se completan al cargar el BL.",
    ]);
    requestAnimationFrame(() => scrollToCargaMasivaListado());
  }, [initialRows, initialMessage]);

  useEffect(() => {
    if (seedApplied.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("seed") !== "1") return;
    const seed = readCargaMasivaSeed();
    if (!seed) return;
    seedApplied.current = true;
    setMode("documentos");
    setRows(healCargaMasivaCheryRows(seed.rows));
    setShared(sharedShipmentFromRows(seed.rows));
    setLoteTech(sharedLoteTechFromRows(seed.rows));
    setDetectedImportador(detectedImportadorFromRows(seed.rows));
    setResultMsg(
      seed.message ?? `Se cargaron ${seed.rows.length} vehículos desde la factura.`
    );
    setWarnings([
      "Revisa VIN, motor, color y año de cada fila. Selecciona el importador y súbelos certificados de origen para completar motor.",
      "Aduana, BL y fecha de llegada se completan al cargar el BL.",
    ]);
    const nextUrl = "/smartimport/importaciones/nueva?masiva=1";
    router.replace(nextUrl, { scroll: false });
  }, [router]);

  useEffect(() => {
    if (initialDocsApplied.current || !initialDocs.length) return;
    initialDocsApplied.current = true;
    setDocs(
      initialDocs.map((d) => ({
        id: `${d.file.name}-${d.file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file: d.file,
        tipo: d.tipo,
      }))
    );
  }, [initialDocs]);

  /**
   * Si hay un solo PDF de certificado y filas con VIN, asocia ese archivo a
   * cada serial (certificado multi-VIN o un solo vehículo).
   */
  useEffect(() => {
    if (certMatches.length > 0) return;
    const certDocs = docs.filter((d) => d.tipo === "certificado_origen");
    if (certDocs.length !== 1) return;
    const fileName = certDocs[0]!.file.name;
    const synthesized = rows
      .map((r) => normalizeSerialKey(r.serialCarroceria || r.vin))
      .filter(Boolean)
      .map((serial) => ({ serial, fileName }));
    if (synthesized.length === 0) return;
    setCertMatches(synthesized);
  }, [docs, rows, certMatches.length]);

  useEffect(() => {
    if (!certMergeRequest?.files.length) return;
    if (certMergeHandled.current === certMergeRequest.requestId) return;
    certMergeHandled.current = certMergeRequest.requestId;

    const certDocs: DocItem[] = certMergeRequest.files.map((file, index) => ({
      id: `cert-merge-${certMergeRequest.requestId}-${index}`,
      file,
      tipo: "certificado_origen",
    }));
    setDocs((prev) => {
      const seen = new Set(prev.map((d) => `${d.file.name}-${d.file.size}`));
      const extra = certDocs.filter(
        (d) => !seen.has(`${d.file.name}-${d.file.size}`)
      );
      return [...prev, ...extra].slice(0, 20);
    });
    setError(null);
    setResultMsg(null);

    if (rowsRef.current.length === 0) {
      setResultMsg(
        "Certificado listo. Pulsa Extraer vehículos para leer factura y certificado juntos."
      );
      return;
    }

    startExtractTransition(async () => {
      try {
        if (!tallerId) {
          setError("No se pudo identificar el taller para subir documentos");
          return;
        }
        const batchId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`;
        const storageDocs = await uploadDocsToStorage(certDocs, batchId);
        const ok = await applyCertsFromStorage(storageDocs);
        if (!ok) return;
      } catch (err) {
        setError(formatCargaMasivaClientError(err));
      }
    });
  }, [certMergeRequest, tallerId]);

  const filtrados = useMemo(() => {
    const q = clienteQuery.trim().toLowerCase();
    if (!q) return importadores;
    return importadores.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.documento.toLowerCase().includes(q) ||
        (c.cedula ?? "").toLowerCase().includes(q) ||
        (c.telefono ?? "").toLowerCase().includes(q)
    );
  }, [importadores, clienteQuery]);

  /** En el wizard el importador ya se eligió en el paso 1; no bloquear por RIF del OCR. */
  const trustWizardImportador = hideClienteSection && Boolean(selected);

  const rifOk = useMemo(() => {
    if (!selected) return false;
    if (trustWizardImportador) return true;
    return rifCoincideConSeleccionado(
      detectedImportador.documento,
      selected.documento
    );
  }, [detectedImportador.documento, selected, trustWizardImportador]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const targetIds = useMemo(
    () => (selectedIds.length > 0 ? selectedIds : rows.map((r) => r.id)),
    [rows, selectedIds]
  );
  const marcaComunSeleccion = useMemo(() => {
    const source =
      selectedIds.length > 0
        ? rows.filter((r) => selectedIdSet.has(r.id))
        : rows;
    const keys = new Set<string>();
    for (const r of source) {
      const key = resolveMarcaCatalogo(r.marca) || r.marca.trim();
      if (key) keys.add(key);
    }
    return keys.size === 1 ? [...keys][0]! : null;
  }, [rows, selectedIdSet, selectedIds.length]);
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev;
      const valid = new Set(rows.map((r) => r.id));
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [rows]);

  const semaforo = useMemo(() => resumenSemaforo(rows), [rows]);
  const rowsForRegister = useMemo(
    () => applySharedShipmentToRows(rows, shared, { force: true }),
    [rows, shared]
  );
  const registerGroups = useMemo(
    () => groupByBlAndContainer(resumenSemaforo(rowsForRegister).aptos),
    [rowsForRegister]
  );
  const createdGroups = useMemo(
    () => groupByBlAndContainer(createdExpedientes),
    [createdExpedientes]
  );
  const incompleteCount = useMemo(
    () => rows.filter((r) => !vehicleCompleteness(r).complete).length,
    [rows]
  );

  const avisoCupoNatural = useMemo(() => {
    if (!selected || selected.tipo !== "natural") return null;
    if (semaforo.aptos.length <= 1) return null;
    return (
      `Importador persona natural: máximo 1 vehículo cada 3 años. ` +
      `Tienes ${semaforo.aptos.length} filas — selecciona un importador jurídico (J/G/C/P) ` +
      `para registrar el lote completo.`
    );
  }, [selected, semaforo.aptos.length]);

  /** Se registran todos con VIN válido (rojo/ámbar/verde). Sin VIN = omitidos. */
  const canImport =
    semaforo.aptos.length > 0 &&
    !importPending &&
    !extractPending &&
    Boolean(selected) &&
    rifOk &&
    !avisoCupoNatural;

  const importBlockReason = useMemo(() => {
    if (extractPending) {
      return "Espera a que termine la extracción de documentos.";
    }
    if (importPending) return "Registrando vehículos…";
    if (semaforo.aptos.length === 0) {
      if (semaforo.bloqueados.length > 0) {
        return `Ningún vehículo tiene VIN válido (${semaforo.bloqueados.length} fila(s) sin VIN). Corrige o elimina esas filas.`;
      }
      return "No hay vehículos con VIN válido para registrar.";
    }
    if (!selected) {
      return hideClienteSection
        ? "No hay cliente importador asociado. Vuelve al paso 1 y selecciona uno."
        : "Selecciona el cliente importador (paso 1) para habilitar el registro.";
    }
    if (avisoCupoNatural) return avisoCupoNatural;
    if (!rifOk) {
      const docOcr = detectedImportador.documento || "sin RIF en documentos";
      return `El RIF de los documentos (${docOcr}) no coincide con el cliente seleccionado (${selected.documento}). Elige el importador correcto o sube documentos del mismo titular.`;
    }
    return null;
  }, [
    extractPending,
    importPending,
    semaforo.aptos.length,
    semaforo.bloqueados.length,
    selected,
    avisoCupoNatural,
    rifOk,
    detectedImportador.documento,
    hideClienteSection,
  ]);

  function updateRow(id: string, key: keyof CargaMasivaRow, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value, error: null } : r))
    );
  }

  function updateRows(ids: string[], key: keyof CargaMasivaRow, value: string) {
    const only = new Set(ids);
    setRows((prev) =>
      prev.map((r) =>
        only.has(r.id) ? { ...r, [key]: value, error: null } : r
      )
    );
  }

  function updateRowMarca(id: string, marca: string) {
    updateRowsMarca([id], marca);
  }

  function updateRowsMarca(ids: string[], marca: string) {
    const resolved = resolveMarcaCatalogo(marca) ?? marca;
    const only = new Set(ids);
    setRows((prev) =>
      prev.map((r) => {
        if (!only.has(r.id)) return r;
        const modelo = r.modelo.trim();
        const catalog = modelosDeMarca(resolved);
        const keep =
          Boolean(modelo) &&
          !isGenericModelo(modelo) &&
          (catalog.length === 0 ||
            catalog.some((m) => m.toLowerCase() === modelo.toLowerCase()));
        return {
          ...r,
          marca: resolved,
          modelo: keep ? r.modelo : "",
          error: null,
        };
      })
    );
  }

  function applyCondicionToIds(ids: string[], next: string) {
    const only = new Set(ids);
    setRows((prev) =>
      prev.map((r) => {
        if (!only.has(r.id)) return r;
        if (next === "usado") {
          return { ...r, condicion: "usado", esSubasta: "false", error: null };
        }
        if (next === "subasta") {
          return { ...r, condicion: "usado", esSubasta: "true", error: null };
        }
        return { ...r, condicion: "nuevo", esSubasta: "false", error: null };
      })
    );
  }

  function toggleBulkCol(key: keyof CargaMasivaRow, on: boolean) {
    setBulkCols((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function broadcastIds(rowIndex: number, key: keyof CargaMasivaRow) {
    if (rowIndex === 0 && bulkCols.has(key)) {
      return rows.map((r) => r.id);
    }
    return null;
  }

  function commitVehicleField(
    row: CargaMasivaRow,
    rowIndex: number,
    key: keyof CargaMasivaRow,
    value: string
  ) {
    const ids = broadcastIds(rowIndex, key);
    if (ids) {
      if (key === "marca") {
        updateRowsMarca(ids, value);
        return;
      }
      updateRows(ids, key, value);
      return;
    }
    if (key === "marca") {
      updateRowMarca(row.id, value);
      return;
    }
    updateRow(row.id, key, value);
  }

  function toggleRowSelected(id: string, next: boolean) {
    setSelectedIds((prev) => {
      if (next) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((item) => item !== id);
    });
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  }

  function applyLoteTechToTable(
    nextTech: SharedLoteTechFields,
    options?: { force?: boolean; announce?: boolean }
  ) {
    setLoteTech(nextTech);
    loteTechRef.current = nextTech;
    if (rowsRef.current.length === 0) return;
    const ids = selectedIds.length > 0 ? selectedIds : undefined;
    const next = applySharedLoteTechToRows(rowsRef.current, nextTech, {
      force: options?.force ?? true,
      ids,
    });
    rowsRef.current = next;
    setRows(next);
    if (options?.announce) {
      const n = ids?.length ?? next.length;
      setResultMsg(
        `Datos técnicos aplicados a ${n} vehículo${n === 1 ? "" : "s"}.`
      );
    }
  }

  function applyShipmentToTable(
    nextShared: SharedShipmentFields,
    options?: { force?: boolean }
  ) {
    setShared(nextShared);
    sharedRef.current = nextShared;
    if (rowsRef.current.length === 0) return;
    const ids = selectedIds.length > 0 ? selectedIds : undefined;
    const next = applySharedShipmentToRows(rowsRef.current, nextShared, {
      force: options?.force ?? true,
      ids,
    });
    rowsRef.current = next;
    setRows(next);
  }

  function ingestExtracted(nextRows: CargaMasivaRow[], matches?: CertMatch[]) {
    let healed = healCargaMasivaCheryRows(nextRows);
    if (selected) {
      healed = applyImportadorToRows(healed, selected);
    }
    const persisted = persistLoteTechOnRows(healed, loteTechRef.current);
    healed = persisted.rows;
    loteTechRef.current = persisted.tech;
    rowsRef.current = healed;
    setRows(healed);
    setShared(sharedShipmentFromRows(healed));
    setLoteTech(persisted.tech);
    if (trustWizardImportador && selected) {
      setDetectedImportador({
        nombre: selected.nombre,
        documento: selected.documento,
        direccion: selected.direccion ?? "",
      });
    } else {
      const detected = detectedImportadorFromRows(healed);
      if (detected.documento || detected.nombre) {
        setDetectedImportador(detected);
      }
    }
    if (matches?.length) {
      setCertMatches((prev) => {
        const bySerial = new Map(prev.map((m) => [m.serial, m]));
        for (const m of matches) bySerial.set(m.serial, m);
        return Array.from(bySerial.values());
      });
    }
    requestAnimationFrame(() => scrollToCargaMasivaListado());
  }

  /** Un certificado por request (120s) para no cortar la conexión en el móvil. */
  async function applyCertsFromStorage(
    storageDocs: CargaMasivaStorageDocRef[],
    seedRows?: CargaMasivaRow[]
  ): Promise<boolean> {
    let currentRows = seedRows ?? rowsRef.current;
    const allWarnings: string[] = [];
    const lastMatches: CertMatch[] = [];
    for (let i = 0; i < storageDocs.length; i++) {
      const ref = storageDocs[i]!;
      setActiveEtapa("certs");
      setExtractProgress({
        etapa: "certs",
        label: `Certificado ${i + 1}/${storageDocs.length}`,
        hint: ref.fileName,
        vinsEncontrados: currentRows.filter(
          (r) => (r.serialCarroceria || r.vin || "").trim().length >= 11
        ).length,
        filasCompletas: currentRows.filter((r) => vehicleCompleteness(r).complete)
          .length,
        totalFilas: currentRows.length,
        pct: Math.round((i / Math.max(storageDocs.length, 1)) * 100),
      });
      const fd = new FormData();
      fd.set("etapa", "certs");
      fd.set("storageDocs", JSON.stringify([ref]));
      fd.set("rowsJson", JSON.stringify(currentRows));
      let result: Awaited<ReturnType<typeof extractCargaMasivaEtapaAction>>;
      try {
        result = await postSmartimportOcr(
          "/api/smartimport/ocr-carga-masiva",
          fd,
          extractCargaMasivaEtapaAction,
          {
            deadlineMs: 55_000,
            pollMs: 55_000,
            onRetry: (attempt) =>
              setExtractProgress({
                etapa: "certs",
                label: `Certificado ${i + 1}/${storageDocs.length}`,
                hint: `ENGINE No por VIN… ${attempt * 2}s`,
                vinsEncontrados: currentRows.filter(
                  (r) => (r.serialCarroceria || r.vin || "").trim().length >= 11
                ).length,
                filasCompletas: currentRows.filter((r) =>
                  vehicleCompleteness(r).complete
                ).length,
                totalFilas: currentRows.length,
                pct: Math.round((i / Math.max(storageDocs.length, 1)) * 100),
              }),
          }
        );
      } catch (err) {
        ingestExtracted(currentRows, lastMatches);
        allWarnings.push(
          `Certificado «${ref.fileName}»: ${formatCargaMasivaClientError(err)}`
        );
        setWarnings(allWarnings);
        if (isOcrPollTimeoutError(err) || isCargaMasivaNetworkError(err)) {
          continue;
        }
        setActiveEtapa(null);
        setExtractProgress(null);
        setError(
          `Certificado «${ref.fileName}»: ${formatCargaMasivaClientError(err)}. Las filas se mantienen; Extraer seguirá con modelo/color.`
        );
        return true;
      }
      if (!result.success) {
        ingestExtracted(currentRows, lastMatches);
        allWarnings.push(
          `Certificado «${ref.fileName}»: ${result.error}`
        );
        setWarnings(allWarnings);
        if (currentRows.length > 0) continue;
        setActiveEtapa(null);
        setExtractProgress(null);
        setError(result.error);
        return false;
      }
      currentRows = result.rows;
      allWarnings.push(...result.warnings);
      lastMatches.push(...result.certMatches);
      ingestExtracted(result.rows, result.certMatches);
    }
    setWarnings(allWarnings);
    setResultMsg(
      `Certificados aplicados. ${
        currentRows.filter((r) => vehicleCompleteness(r).complete).length
      }/${currentRows.length} filas con datos completos.`
    );
    setActiveEtapa(null);
    setExtractProgress(null);
    return true;
  }

  function handleSheetFile(file: File | null) {
    if (!file) return;
    setError(null);
    setResultMsg(null);
    setWarnings([]);
    startSheetTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const result = await parseCargaMasivaSpreadsheetAction(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      ingestExtracted(result.rows);
    });
  }

  async function fillTasaBcvForFecha(fecha: string) {
    const day = fecha.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setTasaBcvHint(null);
      return;
    }
    const req = ++tasaBcvReq.current;
    setTasaBcvPending(true);
    try {
      const result = await getTasaBcvAction(day);
      if (req !== tasaBcvReq.current) return;
      if (!result.success) {
        setTasaBcvHint(result.error);
        return;
      }
      applyShipmentToTable(
        { ...sharedRef.current, tasaCambioBcv: result.tasa },
        { force: true }
      );
      setTasaBcvHint(result.hint);
    } finally {
      if (req === tasaBcvReq.current) setTasaBcvPending(false);
    }
  }

  function mergeIncomingDocs(incoming: DocItem[]): DocItem[] {
    const seen = new Set(docs.map((d) => `${d.file.name}:${d.file.size}`));
    const extra = incoming.filter(
      (d) => !seen.has(`${d.file.name}:${d.file.size}`)
    );
    return [...docs, ...extra].slice(0, 20);
  }

  function handleDocsFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = assignDocTipos(Array.from(list));
    const merged = mergeIncomingDocs(next);
    setDocs(merged);
    setError(null);
    const hasFactura = merged.some((d) => d.tipo === "factura_comercial");
    const hasCert = merged.some((d) => d.tipo === "certificado_origen");
    if (hasFactura && hasCert) {
      extractDocs(merged);
    }
  }

  async function handleBlFile(file: File | null) {
    if (!file) return;
    if (!isPdfOrImageFile(file)) {
      setError("El BL debe ser PDF o una foto nítida");
      return;
    }
    setError(null);
    setBlOcrPending(true);
    try {
      const prepared =
        file.type === "application/pdf" || /\.pdf$/i.test(file.name)
          ? file
          : await normalizeImageFileForUpload(file);
      const item: DocItem = {
        id: `bl-${prepared.name}-${prepared.size}-${Date.now().toString(36)}`,
        file: prepared,
        tipo: "bl_guia",
      };
      setDocs((prev) => [...prev.filter((d) => d.tipo !== "bl_guia"), item]);

      if (!tallerId) {
        setError("No se pudo identificar el taller para subir el BL");
        return;
      }
      const batchId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;
      const storageDocs = await uploadDocsToStorage([item], batchId);
      const fd = new FormData();
      fd.set("tipo", "bl_guia");
      fd.set("storageDocs", JSON.stringify(storageDocs));
      const result = await postSmartimportOcr(
        "/api/smartimport/ocr-documento",
        fd,
        extractPuertoLibreDocumentoAction
      );
      if (!result.success) {
        setError(
          `${result.error} El archivo queda adjunto: escribe el nº de BL a mano.`
        );
        return;
      }
      const fields = result.fields;
      const nextShared: SharedShipmentFields = {
        ...shared,
        numeroBl: fields.numeroBl?.trim() || shared.numeroBl,
        fechaLlegadaBuque:
          fields.fechaLlegadaBuque?.trim() || shared.fechaLlegadaBuque,
        puerto: fields.puerto?.trim() || shared.puerto,
        aduana: fields.aduana?.trim() || shared.aduana,
        paisOrigen: fields.paisOrigen?.trim() || shared.paisOrigen,
        modalidadTransito:
          fields.modalidadTransito ?? shared.modalidadTransito,
        aduanaTransito: fields.aduanaTransito?.trim() || shared.aduanaTransito,
      };
      applyShipmentToTable(nextShared, { force: false });
      if (nextShared.fechaLlegadaBuque) {
        void fillTasaBcvForFecha(nextShared.fechaLlegadaBuque);
      }
      setResultMsg(
        fields.numeroBl?.trim()
          ? `BL leído: ${fields.numeroBl.trim()}. El archivo se adjunta a los expedientes al registrar.`
          : "BL guardado. No se pudo leer el número: escríbelo a mano."
      );
    } catch (err) {
      setError(
        `${formatCargaMasivaClientError(err)} El archivo queda adjunto: escribe el nº a mano.`
      );
    } finally {
      setBlOcrPending(false);
    }
  }

  async function uploadDocsToStorage(
    items: DocItem[],
    batchId: string
  ): Promise<CargaMasivaStorageDocRef[]> {
    const supabase = createClient();
    const refs: CargaMasivaStorageDocRef[] = [];
    for (const d of items) {
      const fileName = safeStorageFileName(d.file.name);
      const path = `${tallerId}/carga-masiva-temp/${batchId}/${d.id}-${fileName}`;
      const { error } = await supabase.storage
        .from(VEHICULO_DOCS_BUCKET)
        .upload(path, d.file, {
          upsert: false,
          contentType: contentTypeForImportDoc(d.file),
        });
      if (error) {
        throw new Error(`${d.file.name}: ${error.message}`);
      }
      refs.push({ path, tipo: d.tipo, fileName: d.file.name });
    }
    return refs;
  }

  function storageRefsForEtapa(
    allRefs: CargaMasivaStorageDocRef[],
    etapa: CargaMasivaEtapaId
  ): CargaMasivaStorageDocRef[] {
    if (etapa === "certs") {
      return allRefs.filter(
        (r) => r.tipo === "certificado_origen" || r.tipo === "bl_guia"
      );
    }
    return allRefs.filter((r) => r.tipo === "factura_comercial");
  }

  function extractDocs(overrideDocs?: DocItem[]) {
    const items = overrideDocs ?? docs;
    if (items.length === 0) {
      setError("Agrega al menos un PDF o foto");
      return;
    }
    if (!tallerId) {
      setError("No se pudo identificar el taller para subir documentos");
      return;
    }
    setError(null);
    setResultMsg(null);
    setWarnings([]);
    setExtractProgress(null);
    setActiveEtapa(null);
    setEtapasHechas(new Set());

    const hasCertOrBl = items.some(
      (d) => d.tipo === "certificado_origen" || d.tipo === "bl_guia"
    );
    const etapas = cargaMasivaEtapasPlan(hasCertOrBl);

    startExtractTransition(async () => {
        const batchId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`;
        setExtractProgress({
          etapa: "vins",
          label: "Subiendo documentos…",
          hint: "Evita el límite de tamaño de red (Safari / Vercel)",
          vinsEncontrados: 0,
          filasCompletas: 0,
          totalFilas: 0,
          pct: 5,
        });

        let currentRows: CargaMasivaRow[] = [];
        const allWarnings: string[] = [];
        let lastCertMatches: CertMatch[] = [];
        let allStorageDocs: CargaMasivaStorageDocRef[] = [];

        try {
        allStorageDocs = await uploadDocsToStorage(items, batchId);

        for (let i = 0; i < etapas.length; i++) {
          const etapa = etapas[i]!;
          const storageDocs = storageRefsForEtapa(allStorageDocs, etapa);
          if (storageDocs.length === 0) {
            if (etapa === "certs") continue;
            setError("Falta la factura comercial para extraer VIN");
            setActiveEtapa(null);
            setExtractProgress(null);
            return;
          }

          if (etapa === "certs") {
            if (currentRows.length === 0) {
              setError(
                "No hay VIN de la factura para emparejar certificados. Reintenta Extraer vehículos o usa Excel."
              );
              setActiveEtapa(null);
              setExtractProgress(null);
              setWarnings(allWarnings);
              return;
            }
            const ok = await applyCertsFromStorage(storageDocs, currentRows);
            currentRows = rowsRef.current.length > 0 ? rowsRef.current : currentRows;
            if (!ok && currentRows.length === 0) return;
            setEtapasHechas((prev) => new Set(prev).add("certs"));
            continue;
          }

          setActiveEtapa(etapa);
          setExtractProgress({
            etapa,
            label: CARGA_MASIVA_ETAPA_LABELS[etapa],
            hint: CARGA_MASIVA_ETAPA_HINTS[etapa],
            vinsEncontrados: currentRows.filter(
              (r) => (r.serialCarroceria || r.vin || "").trim().length >= 11
            ).length,
            filasCompletas: currentRows.filter(
              (r) => vehicleCompleteness(r).complete
            ).length,
            totalFilas: currentRows.length,
            pct: Math.round((i / etapas.length) * 100),
          });

          const fd = new FormData();
          fd.set("etapa", etapa);
          fd.set("storageDocs", JSON.stringify(storageDocs));
          if (etapa !== "vins") {
            fd.set("rowsJson", JSON.stringify(currentRows));
          }

          let result: Awaited<
            ReturnType<typeof extractCargaMasivaEtapaAction>
          >;
          try {
            result = await postSmartimportOcr(
              "/api/smartimport/ocr-carga-masiva",
              fd,
              extractCargaMasivaEtapaAction,
              { deadlineMs: 90_000, pollMs: 90_000 }
            );
          } catch (err) {
            if (etapa === "datos" && currentRows.length > 0) {
              allWarnings.push(
                `Enriquecer datos: ${formatCargaMasivaClientError(err)}`
              );
              setWarnings([...allWarnings]);
              continue;
            }
            throw err;
          }
          if (!result.success) {
            if (etapa === "datos" && currentRows.length > 0) {
              allWarnings.push(
                `Enriquecer datos: ${formatCargaMasivaClientError(result.error)}`
              );
              setWarnings([...allWarnings]);
              continue;
            }
            const failMsg = formatCargaMasivaClientError(result.error);
            setError(
              currentRows.length > 0
                ? `${failMsg} Las filas ya extraídas se mantienen.`
                : failMsg
            );
            if (currentRows.length > 0) ingestExtracted(currentRows);
            setActiveEtapa(null);
            setExtractProgress(null);
            setWarnings(allWarnings);
            return;
          }

          currentRows = result.rows;
          allWarnings.push(...result.warnings);
          if (result.certMatches.length > 0) {
            lastCertMatches = result.certMatches;
          }
          ingestExtracted(result.rows, result.certMatches);
          setEtapasHechas((prev) => new Set(prev).add(etapa));
          setExtractProgress({
            ...result.progress,
            pct: Math.round(((i + 1) / etapas.length) * 100),
          });
          setWarnings([...allWarnings]);
        }

        setCertMatches(lastCertMatches);
        setActiveEtapa(null);
        setResultMsg(
          `Extracción por etapas lista: ${currentRows.length} vehículo(s). ${
            currentRows.filter((r) => vehicleCompleteness(r).complete).length
          } con datos completos.`
        );
        } catch (err) {
          setActiveEtapa(null);
          setExtractProgress(null);
          const msg = formatCargaMasivaClientError(err);
          if (currentRows.length > 0) {
            ingestExtracted(currentRows, lastCertMatches);
            setWarnings((prev) => [...prev, ...allWarnings]);
            if (isOcrPollTimeoutError(err)) {
              setResultMsg(
                `${currentRows.length} vehículo(s) de la factura listos. Completa ENGINE No con «Añadir certificados» si faltan.`
              );
              setError(null);
              setWarnings((prev) => [...prev, ...allWarnings]);
              return;
            }
            setError(`${msg} Las filas ya extraídas se mantienen.`);
          } else {
            setError(msg);
          }
        }
    });
  }

  function completarConCertificados(list: FileList | null) {
    if (!list?.length) return;
    if (!tallerId) {
      setError("No se pudo identificar el taller para subir documentos");
      return;
    }
    const certDocs: DocItem[] = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      tipo: "certificado_origen" as const,
    }));
    setDocs((prev) => [...prev, ...certDocs].slice(0, 20));
    setError(null);
    if (rowsRef.current.length === 0) {
      setResultMsg(
        "Certificado añadido. Agrega la factura si falta y pulsa Extraer vehículos: se leen ambos PDF."
      );
      return;
    }
    setResultMsg(null);
    startExtractTransition(async () => {
      try {
        const batchId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`;
        const storageDocs = await uploadDocsToStorage(certDocs, batchId);
        const ok = await applyCertsFromStorage(storageDocs);
        if (ok) setEtapasHechas((prev) => new Set(prev).add("certs"));
      } catch (err) {
        setActiveEtapa(null);
        setExtractProgress(null);
        setError(formatCargaMasivaClientError(err));
      }
    });
  }

  /**
   * Resuelve el PDF de certificado para un VIN/serial.
   * Usa empareje exacto o por prefijo (OCR parcial) y fallback 1 archivo.
   */
  function resolveCertFileForSerial(serialRaw: string): File | null {
    const serial = normalizeSerialKey(serialRaw);
    if (!serial) return null;
    const certDocs = docs.filter((d) => d.tipo === "certificado_origen");
    if (certDocs.length === 0) return null;

    const matchKeys = certMatches.map((m) => m.serial);
    const matchedKey = matchSerialKeyAmong(serial, matchKeys);
    if (matchedKey) {
      const match =
        certMatches.find(
          (m) => normalizeSerialKey(m.serial) === matchedKey
        ) ?? certMatches.find((m) => m.serial === matchedKey);
      if (match) {
        const byName = certDocs.find((d) => d.file.name === match.fileName);
        if (byName) return byName.file;
      }
    }

    // Empareje 1:1 global por si el serial del create difiere levemente del OCR.
    const paired = pairSerialsOneToOne(
      [serial],
      certMatches.map((m) => m.serial)
    );
    const certSerial = paired.get(serial);
    if (certSerial) {
      const match = certMatches.find(
        (m) => normalizeSerialKey(m.serial) === certSerial
      );
      if (match) {
        const byName = certDocs.find((d) => d.file.name === match.fileName);
        if (byName) return byName.file;
      }
    }

    if (certDocs.length === 1) return certDocs[0]!.file;
    return null;
  }

  /** Mapa serial → File de certificado para todos los expedientes a crear. */
  function buildCertFileBySerial(
    serials: string[]
  ): Map<string, File> {
    const map = new Map<string, File>();
    const keys = serials.map(normalizeSerialKey).filter(Boolean);
    const paired = pairSerialsOneToOne(
      keys,
      certMatches.map((m) => m.serial)
    );
    for (const rowSerial of keys) {
      const file = resolveCertFileForSerial(rowSerial);
      if (file) {
        map.set(rowSerial, file);
        continue;
      }
      const certSerial = paired.get(rowSerial);
      if (!certSerial) continue;
      const match = certMatches.find(
        (m) => normalizeSerialKey(m.serial) === certSerial
      );
      if (!match) continue;
      const byName = docs.find(
        (d) =>
          d.tipo === "certificado_origen" && d.file.name === match.fileName
      );
      if (byName) map.set(rowSerial, byName.file);
    }
    return map;
  }

  function importRows() {
    if (!selected) {
      setError("Selecciona el cliente importador");
      return;
    }
    if (!trustWizardImportador && !rifOk) {
      setError(
        "El RIF de los documentos no coincide con el cliente seleccionado"
      );
      return;
    }
    if (avisoCupoNatural) {
      setError(avisoCupoNatural);
      return;
    }
    const { aptos, bloqueados } = resumenSemaforo(rows);
    if (aptos.length === 0) {
      setError(
        bloqueados.length > 0
          ? `Ningún vehículo tiene VIN válido. Corrige o elimina las ${bloqueados.length} fila(s) sin VIN.`
          : "No hay vehículos para registrar"
      );
      return;
    }
    if (bloqueados.length > 0) {
      setResultMsg(
        `Se omitirán ${bloqueados.length} sin VIN. Se crearán ${aptos.length} expediente(s); los datos faltantes se completan después.`
      );
    } else {
      setResultMsg(null);
    }
    setError(null);

    const rowsToImport = applySharedLoteTechToRows(
      applySharedShipmentToRows(aptos, shared, { force: true }),
      loteTech,
      { force: true }
    ).map((r) => ({
      ...r,
      importadorNombre: selected.nombre,
      importadorDocumento: selected.documento,
      importadorTelefono: selected.telefono ?? r.importadorTelefono,
      importadorEmail: selected.email ?? r.importadorEmail,
      importadorDireccion: selected.direccion ?? r.importadorDireccion,
    }));
    setRows((prev) => {
      const byId = new Map(rowsToImport.map((r) => [r.id, r]));
      return prev.map((r) => byId.get(r.id) ?? r);
    });

    const facturaDoc = docs.find((d) => d.tipo === "factura_comercial");
    const blDoc = docs.find((d) => d.tipo === "bl_guia");
    const certDocs = docs.filter((d) => d.tipo === "certificado_origen");
    const serialsToImport = rowsToImport.map((r) =>
      normalizeSerialKey(r.serialCarroceria || r.vin)
    );
    const certBySerial = buildCertFileBySerial(serialsToImport);

    // Si el usuario cargó certificados, deben emparejarse antes de crear.
    if (certDocs.length > 0) {
      const unmatched = serialsToImport.filter((s) => s && !certBySerial.has(s));
      if (unmatched.length > 0) {
        setError(
          `Hay ${certDocs.length} certificado(s) pero ${unmatched.length} vehículo(s) sin emparejar por VIN. ` +
            `Espera a que termine el OCR o vuelve a pulsar «Añadir certificados» antes de registrar.`
        );
        return;
      }
    }

    // Si hay factura en docs, se adjuntará a todos; si no y solo hay certs, seguir.
    if (!facturaDoc && certDocs.length === 0 && docs.length === 0) {
      setWarnings((prev) => [
        ...prev,
        "No hay factura ni certificados en memoria: los expedientes se crearán sin documentos adjuntos.",
      ]);
    }

    startImportTransition(async () => {
      try {
      setResultMsg("Creando expedientes…");
      const result = await createPuertoLibreCargaMasivaAction({
        importadorId: selected.id,
        rows: rowsToImport,
        detectedImportadorDocumento: trustWizardImportador
          ? selected.documento
          : detectedImportador.documento,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const ok = result.created.length;
      const fail = result.failed.length;

      let attachNote = "";
      if (ok > 0 && (facturaDoc || blDoc || certDocs.length > 0)) {
        setResultMsg("Adjuntando documentos…");
        let attached = 0;
        let attachFail = 0;
        let withBoth = 0;
        const first = result.created[0]!;
        const restIds = result.created.slice(1).map((c) => c.vehiculoId);
        const loteDocs = [facturaDoc, blDoc].filter(Boolean) as DocItem[];
        const loteTipos: string[] = [];
        let facturaOk = !facturaDoc;

        for (const d of loteDocs) {
          const up = await uploadPuertoLibreDocumentoAction(
            formDataDocUploadSkipOcr(first.vehiculoId, d.tipo, d.file)
          );
          if (up.success) {
            attached += 1;
            loteTipos.push(d.tipo);
            if (d.tipo === "factura_comercial") facturaOk = true;
          } else {
            attachFail += 1;
          }
        }

        if (restIds.length > 0 && loteTipos.length > 0) {
          const copied = await copyCargaMasivaDocumentosAction({
            sourceVehiculoId: first.vehiculoId,
            targetVehiculoIds: restIds,
            tipos: loteTipos as DocumentoTipo[],
          });
          if (copied.success) {
            attached += copied.copied * loteTipos.length;
          } else {
            attachFail += restIds.length;
          }
        }

        const certResults = await Promise.all(
          result.created.map(async (c) => {
            const serial = normalizeSerialKey(c.serial);
            const certFile =
              (serial ? certBySerial.get(serial) : null) ??
              resolveCertFileForSerial(c.serial);
            if (!certFile) {
              return { gotCert: certDocs.length === 0 };
            }
            const up = await uploadPuertoLibreDocumentoAction(
              formDataDocUploadSkipOcr(
                c.vehiculoId,
                "certificado_origen",
                certFile
              )
            );
            if (up.success) attached += 1;
            else attachFail += 1;
            return { gotCert: up.success };
          })
        );
        withBoth = certResults.filter((r) => facturaOk && r.gotCert).length;
        if (attached > 0) {
          attachNote = ` Documentos adjuntos: ${attached}.`;
        }
        if (facturaDoc && certDocs.length > 0) {
          attachNote += ` Expedientes con factura+certificado: ${withBoth}/${ok}.`;
        }
        if (attachFail > 0) {
          attachNote += ` No se pudieron adjuntar ${attachFail} archivo(s).`;
        }
        if (facturaDoc && certDocs.length > 0 && withBoth < ok) {
          setError(
            `Se crearon ${ok} expediente(s), pero solo ${withBoth} quedaron con factura y certificado. Revisa los fallos de subida.`
          );
        }
      }

      const { aptos: registrables } = resumenSemaforo(rowsToImport);
      const verdCount = registrables.filter(
        (r) => vehicleSemaforo(r).nivel === "verde"
      ).length;
      const ambarCount = registrables.filter(
        (r) => vehicleSemaforo(r).nivel === "ambar"
      ).length;
      const rojoCount = registrables.filter(
        (r) => vehicleSemaforo(r).nivel === "rojo"
      ).length;
      const semNote =
        ambarCount > 0 || rojoCount > 0
          ? ` Semáforo: ${verdCount} verde, ${ambarCount} ámbar, ${rojoCount} rojo (completar datos en la ficha).`
          : "";
      const colaNote =
        ok > 0 ? " Quedan por completar embarque." : "";

      setResultMsg(
        fail > 0
          ? `Creados ${ok}. Fallaron ${fail}.${colaNote}${semNote}${attachNote}`
          : `Se registraron ${ok} expediente${ok === 1 ? "" : "s"}.${colaNote}${semNote}${attachNote}`
      );
      if (ok > 0) {
        setCreatedExpedientes((prev) => [...result.created, ...prev]);
        setRows((prev) =>
          prev.filter(
            (r) =>
              !result.created.some(
                (c) =>
                  normalizeSerialKey(c.serial) ===
                  normalizeSerialKey(r.serialCarroceria || r.vin)
              )
          )
        );
        if (fail === 0) {
          setDocs([]);
          setShared({ ...EMPTY_SHARED_SHIPMENT });
          setLoteTech({ ...EMPTY_SHARED_LOTE_TECH });
          setDetectedImportador({ ...EMPTY_DETECTED_IMPORTADOR });
          setCertMatches([]);
        }
        router.refresh();
      }
      if (fail > 0) {
        setError(summarizeBulkRegisterFailures(result.failed));
      }
      } catch (err) {
        setError(formatCargaMasivaClientError(err));
      }
    });
  }

  return (
    <div className="space-y-6">
      {onSwitchToIndividual ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onSwitchToIndividual}
            className="text-sm text-cyan-400 hover:underline"
          >
            Registrar un solo vehículo
          </button>
        </div>
      ) : null}

      {!hideClienteSection ? (
      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="flex items-center gap-2 smartimport-bucket-title text-slate-100">
          <UserRound className="h-4 w-4 text-cyan-400" />
          1. Cliente importador
        </h2>

        {selected ? (
          <div className="mt-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">
              Seleccionado
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-50">
              {selected.nombre}
            </p>
            <p className="mt-0.5 font-mono text-xs text-zinc-400">
              {formatImportadorDocumentoLine(selected)}
              {" · "}
              {IMPORTADOR_TIPO_LABELS[selected.tipo]}
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-2 text-xs text-cyan-400 hover:underline"
            >
              Cambiar cliente
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={clienteQuery}
                onChange={(e) => setClienteQuery(e.target.value)}
                placeholder="Buscar por nombre, RIF o teléfono…"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-3 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
              />
            </label>
            {filtrados.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500">
                No hay clientes.{" "}
                <Link
                  href="/smartimport/clientes"
                  className="text-cyan-400 hover:underline"
                >
                  Registrar uno
                </Link>{" "}
                y vuelve aquí.
              </p>
            ) : (
              <ul className="max-h-56 space-y-2 overflow-y-auto">
                {filtrados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(c)}
                      className="flex w-full items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-3 text-left transition hover:border-zinc-600"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-zinc-100">
                          {c.nombre}
                        </span>
                        <span className="mt-0.5 block font-mono text-xs text-zinc-400">
                          {c.documento}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {detectedImportador.documento || detectedImportador.nombre ? (
          <div
            className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
              selected && !rifOk
                ? "border-red-900/50 bg-red-950/30 text-red-200"
                : selected && rifOk
                  ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-200"
                  : "border-slate-700 bg-slate-900/50 text-slate-300"
            }`}
          >
            <p className="font-medium">
              {selected && !rifOk ? (
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  RIF de documentos no coincide
                </span>
              ) : selected && rifOk ? (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Importador certificado: coincide con documentos
                </span>
              ) : (
                "Importador leído en documentos"
              )}
            </p>
            <p className="mt-1 font-mono text-[11px] opacity-90">
              {[detectedImportador.nombre, detectedImportador.documento]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        ) : null}
      </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 space-y-4">
        <h2 className="smartimport-bucket-title text-slate-100">
          {hideClienteSection ? "1.- Factura con varios vehículos" : "2.- Factura con varios vehículos"}
        </h2>

        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Excel o CSV"
            aria-pressed={mode === "plantilla"}
            onClick={() => setMode("plantilla")}
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition ${
              mode === "plantilla"
                ? "border-cyan-500 bg-cyan-600 text-white"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
            }`}
          >
            <FileSpreadsheet className="h-8 w-8" />
          </button>
          <button
            type="button"
            aria-label="PDF o fotos"
            aria-pressed={mode === "documentos"}
            onClick={() => setMode("documentos")}
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition ${
              mode === "documentos"
                ? "border-cyan-500 bg-cyan-600 text-white"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
            }`}
          >
            <FileText className="h-8 w-8" />
          </button>
        </div>

        {mode === "plantilla" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <a
              href="/smartimport/carga-masiva/plantilla.xlsx"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2.5 text-center text-sm font-medium text-slate-200 hover:border-slate-500"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="leading-tight">Plantilla Excel</span>
            </a>
            <a
              href="/smartimport/carga-masiva/plantilla.csv"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2.5 text-center text-sm font-medium text-slate-200 hover:border-slate-500"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="leading-tight">Plantilla CSV</span>
            </a>
            <button
              type="button"
              disabled={pending}
              onClick={() => sheetRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {pending ? "Leyendo…" : "Elegir archivo"}
            </button>
            <input
              ref={sheetRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                handleSheetFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => docsRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-400 disabled:opacity-50"
            >
              <Upload className="h-4 w-4 shrink-0" />
              Agregar factura / PDFs
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => certsRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-400 disabled:opacity-50"
            >
              <Upload className="h-4 w-4 shrink-0" />
              Añadir certificados
            </button>
          </div>
        )}

        {docs.length > 0 ? (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                  {d.file.name}
                </span>
                <select
                  value={d.tipo}
                  onChange={(e) =>
                    setDocs((prev) =>
                      prev.map((x) =>
                        x.id === d.id
                          ? {
                              ...x,
                              tipo: e.target.value as DocItem["tipo"],
                            }
                          : x
                      )
                    )
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="factura_comercial">Factura</option>
                  <option value="certificado_origen">
                    Certificado origen
                  </option>
                  <option value="bl_guia">BL / guía</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setDocs((prev) => prev.filter((x) => x.id !== d.id))
                  }
                  className="rounded-md p-1.5 text-slate-500 hover:text-red-300"
                  aria-label="Quitar documento"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {extractPending ? (
          <div
            className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3"
            role="status"
            aria-live="polite"
          >
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${extractProgress?.pct ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-center text-sm font-semibold tabular-nums text-cyan-100">
              {extractProgress?.pct ?? 0}%
            </p>
          </div>
        ) : (
          <button
            type="button"
            disabled={importPending || docs.length === 0}
            onClick={() => extractDocs()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-950/40 px-4 py-2.5 text-sm font-medium text-cyan-50 hover:bg-cyan-900/40 disabled:opacity-50"
          >
            <FileUp className="h-4 w-4 shrink-0" />
            Extraer vehículos
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            setRows((prev) => [
              ...prev,
              emptyCargaMasivaRow({ fuente: "Manual" }),
            ])
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-400 disabled:opacity-50"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Añadir fila
        </button>
        <input
          ref={docsRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={(e) => {
            handleDocsFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={certsRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={(e) => {
            completarConCertificados(e.target.files);
            e.target.value = "";
          }}
        />
      </section>

      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {resultMsg || createdExpedientes.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-200">
          {resultMsg ? (
            <p className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{resultMsg}</span>
              {rows.length > 0 ? (
                <button
                  type="button"
                  onClick={scrollToCargaMasivaListado}
                  className="shrink-0 underline hover:text-emerald-100"
                >
                  Ver listado
                </button>
              ) : null}
            </p>
          ) : null}
          {createdExpedientes.length > 0 ? (
            <div className="space-y-3 border-t border-emerald-900/30 pt-2">
              {createdGroups.map((bl) => (
                <div key={bl.numeroBl || "sin-bl"}>
                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-100">
                    <span>
                      BL {bl.label} · {bl.total} expediente
                      {bl.total === 1 ? "" : "s"}
                    </span>
                    {bl.numeroBl ? (
                      <Link
                        href={cargaBlPath(bl.numeroBl)}
                        className="font-medium underline hover:text-emerald-50"
                      >
                        Cargar docs de la carga
                      </Link>
                    ) : null}
                  </p>
                  {bl.contenedores.map((ct) => (
                    <div key={ct.numeroContenedor || "sin-ct"} className="mt-1">
                      <p className="text-[11px] text-emerald-300/90">
                        Contenedor {ct.label} · {ct.items.length}
                      </p>
                      <ul className="mt-0.5 space-y-0.5 font-mono text-xs">
                        {ct.items.map((c) => (
                          <li key={c.vehiculoId}>
                            <Link
                              href={`/smartimport/${c.vehiculoId}`}
                              className="underline hover:text-emerald-100"
                            >
                              {c.codigoExpediente || "Expediente"} · {c.serial}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {rows.length > 0 || mode === "documentos" ? (
        <section
          id={CARGA_MASIVA_LISTADO_ID}
          className="scroll-mt-4 space-y-3"
        >
          <div>
            <h2 className="smartimport-bucket-title text-slate-100">
              {hideClienteSection ? "2. Revisa y registra" : "3. Revisa y registra"} ({rows.length})
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/60 px-2 py-0.5 text-emerald-300">
                ● Verde {semaforo.verde}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-950/60 px-2 py-0.5 text-amber-300">
                ● Ámbar {semaforo.ambar}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-red-950/60 px-2 py-0.5 text-red-300">
                ● Rojo {semaforo.rojo}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Semáforo = completitud. Con VIN válido se crea el expediente aunque
              falten datos (se completan en la ficha). Verde = completo · Ámbar =
              falten motor/color/año · Rojo = faltan marca/modelo (igual se
              crea). Sin VIN no se registra.
              {incompleteCount > 0
                ? " Sube certificados para rellenar motor, color y año."
                : null}
            </p>
          </div>

          {rows.length > 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-slate-200">
                Datos de embarque del lote
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Mismo BL / buque para las {rows.length} fila
                {rows.length === 1 ? "" : "s"}. Se rellenan solas al OCR del BL;
                al cambiar un campo se copian a la tabla.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-xs text-slate-400">
                  Fecha llegada buque
                  <input
                    type="date"
                    value={shared.fechaLlegadaBuque}
                    onChange={(e) => {
                      const fecha = e.target.value;
                      applyShipmentToTable(
                        { ...shared, fechaLlegadaBuque: fecha },
                        { force: true }
                      );
                      void fillTasaBcvForFecha(fecha);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  />
                </label>
                <div className="block text-xs text-slate-400">
                  Nº BL / guía
                  <input
                    type="text"
                    value={shared.numeroBl}
                    onChange={(e) =>
                      applyShipmentToTable(
                        {
                          ...shared,
                          numeroBl: e.target.value.toUpperCase(),
                        },
                        { force: true }
                      )
                    }
                    placeholder={
                      blOcrPending ? "Leyendo nº BL del documento…" : "Ej. COSU123…"
                    }
                    disabled={blOcrPending}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 font-mono text-sm uppercase text-slate-100 disabled:opacity-70"
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={blOcrPending || extractPending || importPending}
                      onClick={() => blRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                    >
                      {blOcrPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {blOcrPending ? "Leyendo…" : "PDF o foto"}
                    </button>
                    {docs.find((d) => d.tipo === "bl_guia") ? (
                      <span className="flex min-w-0 items-center gap-1 text-[11px] text-emerald-300">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {docs.find((d) => d.tipo === "bl_guia")?.file.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        Extrae el nº y se adjunta al registrar
                      </span>
                    )}
                  </div>
                  <input
                    ref={blRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      void handleBlFile(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </div>
                <label className="block text-xs text-slate-400 sm:col-span-2 lg:col-span-3">
                  <span className="font-medium text-slate-300">
                    Puerto de descarga
                  </span>
                  <select
                    value={primaryPuertoDescarga(shared.puerto)}
                    onChange={(e) =>
                      applyShipmentToTable(
                        { ...shared, puerto: e.target.value },
                        { force: true }
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  >
                    <option value="">— Elegir —</option>
                    {PUERTOS_DESCARGA_VENEZUELA.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    {parsePuertosDescarga(shared.puerto)
                      .filter(
                        (p) =>
                          !PUERTOS_DESCARGA_VENEZUELA.includes(
                            p as (typeof PUERTOS_DESCARGA_VENEZUELA)[number]
                          )
                      )
                      .map((p) => (
                        <option key={p} value={p}>
                          {resolvePuertoDescarga(p)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Aduana
                  <select
                    value={shared.aduana}
                    onChange={(e) =>
                      applyShipmentToTable(
                        { ...shared, aduana: e.target.value },
                        { force: true }
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  >
                    <option value="">— Elegir —</option>
                    {shared.aduana &&
                    !ADUANAS_VENEZUELA.includes(
                      shared.aduana as (typeof ADUANAS_VENEZUELA)[number]
                    ) ? (
                      <option value={shared.aduana}>{shared.aduana}</option>
                    ) : null}
                    {ADUANAS_VENEZUELA.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  País de origen
                  <select
                    value={shared.paisOrigen}
                    onChange={(e) =>
                      applyShipmentToTable(
                        { ...shared, paisOrigen: e.target.value },
                        { force: true }
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  >
                    <option value="">— Elegir —</option>
                    {shared.paisOrigen &&
                    !PAISES.includes(
                      shared.paisOrigen as (typeof PAISES)[number]
                    ) ? (
                      <option value={shared.paisOrigen}>
                        {shared.paisOrigen}
                      </option>
                    ) : null}
                    {PAISES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Modalidad tránsito
                  <select
                    value={shared.modalidadTransito}
                    onChange={(e) =>
                      applyShipmentToTable(
                        {
                          ...shared,
                          modalidadTransito: e.target
                            .value as SharedShipmentFields["modalidadTransito"],
                          aduanaTransito:
                            e.target.value === "ninguno"
                              ? ""
                              : shared.aduanaTransito,
                        },
                        { force: true }
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  >
                    <option value="">— Elegir —</option>
                    {LOTE_MODALIDAD_TRANSITO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {shared.modalidadTransito === "transito" ||
                shared.modalidadTransito === "uso24" ? (
                  <label className="block text-xs text-slate-400">
                    Aduana tránsito / USO24
                    <select
                      value={shared.aduanaTransito}
                      onChange={(e) =>
                        applyShipmentToTable(
                          { ...shared, aduanaTransito: e.target.value },
                          { force: true }
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                    >
                      <option value="">— Elegir —</option>
                      {shared.aduanaTransito &&
                      !ADUANAS_VENEZUELA.includes(
                        shared.aduanaTransito as (typeof ADUANAS_VENEZUELA)[number]
                      ) ? (
                        <option value={shared.aduanaTransito}>
                          {shared.aduanaTransito}
                        </option>
                      ) : null}
                      {ADUANAS_VENEZUELA.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="block text-xs text-slate-400">
                  Tasa BCV (Bs/USD)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={shared.tasaCambioBcv}
                    onChange={(e) => {
                      applyShipmentToTable(
                        {
                          ...shared,
                          tasaCambioBcv: e.target.value.replace(/[^\d.,]/g, ""),
                        },
                        { force: true }
                      );
                      setTasaBcvHint((prev) =>
                        prev && !prev.includes("editada a mano")
                          ? `${prev} · editada a mano`
                          : prev
                      );
                    }}
                    placeholder={
                      tasaBcvPending ? "Consultando BCV…" : "Se llena al elegir la fecha"
                    }
                    disabled={tasaBcvPending}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100 disabled:opacity-70"
                  />
                  {tasaBcvPending ? (
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-cyan-300">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Leyendo tasa oficial…
                    </span>
                  ) : tasaBcvHint ? (
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {tasaBcvHint}
                    </span>
                  ) : (
                    <span className="mt-1 block text-[11px] text-slate-500">
                      Se coloca sola al elegir la fecha de llegada
                    </span>
                  )}
                </label>
              </div>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-slate-200">
                Datos técnicos del lote
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Al elegir combustible, condición o cilindrada se copian a las
                filas de la tabla
                {selectedIds.length > 0
                  ? ` (${selectedIds.length} seleccionada${selectedIds.length === 1 ? "" : "s"})`
                  : ` (${rows.length} fila${rows.length === 1 ? "" : "s"})`}
                .
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="block text-xs text-slate-400">
                  Condición
                  <select
                    value={loteTech.condicion}
                    onChange={(e) =>
                      applyLoteTechToTable(
                        {
                          ...loteTech,
                          condicion: e.target
                            .value as SharedLoteTechFields["condicion"],
                        },
                        { force: true }
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  >
                    <option value="">— Elegir —</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="usado">Usado</option>
                    <option value="subasta">Subasta</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Combustible
                  <select
                    value={loteTech.tipoCombustible}
                    onChange={(e) =>
                      applyLoteTechToTable(
                        {
                          ...loteTech,
                          tipoCombustible: e.target
                            .value as SharedLoteTechFields["tipoCombustible"],
                        },
                        { force: true }
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  >
                    <option value="">— Elegir —</option>
                    {LOTE_TIPO_COMBUSTIBLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  Cilindrada (cc)
                  <input
                    type="text"
                    inputMode="numeric"
                    value={loteTech.cilindradaCc}
                    onChange={(e) =>
                      applyLoteTechToTable(
                        {
                          ...loteTech,
                          cilindradaCc: e.target.value.replace(/[^\d]/g, ""),
                        },
                        { force: true }
                      )
                    }
                    placeholder="Ej. 1500"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {rows.length > 0 ? (
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/70 p-4">
            <p className="text-sm font-medium text-slate-100">
              Registrar expedientes
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Se crean todos los que tienen VIN. Al registrar, el registro
              queda cerrado y pasan a Por completar embarque, agrupados por BL
              y por contenedor del certificado de origen.
            </p>
            {registerGroups.length > 0 ? (
              <div className="mt-3 space-y-3">
                {registerGroups.map((bl) => (
                  <div
                    key={bl.numeroBl || "sin-bl"}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-cyan-100">
                      BL {bl.label}
                      <span className="ml-2 font-normal text-slate-400">
                        {bl.total} vehículo{bl.total === 1 ? "" : "s"} ·{" "}
                        {bl.contenedores.length} contenedor
                        {bl.contenedores.length === 1 ? "" : "es"}
                      </span>
                    </p>
                    <ul className="mt-1 space-y-1 text-[11px] text-slate-400">
                      {bl.contenedores.map((ct) => (
                        <li key={ct.numeroContenedor || "sin-ct"}>
                          <span className="font-medium text-slate-200">
                            {ct.label}
                          </span>
                          {" · "}
                          {ct.items.length} unidad
                          {ct.items.length === 1 ? "" : "es"}
                          {ct.items[0]?.vin
                            ? ` · ${ct.items
                                .map((r) => (r.vin || r.serialCarroceria || "").slice(-6))
                                .filter(Boolean)
                                .join(", ")}`
                            : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              disabled={!canImport}
              onClick={importRows}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {importPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {importPending
                ? "Registrando…"
                : `Registrar ${semaforo.aptos.length} vehículo${semaforo.aptos.length === 1 ? "" : "s"}`}
            </button>
            {!canImport && importBlockReason ? (
              <p className="mt-2 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                {importBlockReason}
              </p>
            ) : null}
            {semaforo.bloqueados.length > 0 ? (
              <p className="mt-2 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                {semaforo.bloqueados.length} sin VIN válido (no se crearán). El resto
                ({semaforo.aptos.length}) sí se registra; el color indica qué falta
                completar después.
              </p>
            ) : semaforo.rojo > 0 || semaforo.ambar > 0 ? (
              <p className="mt-2 rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                Se crearán {semaforo.aptos.length} expediente(s). Al registrar
                quedan en Por completar embarque. Los de color rojo/ámbar
                completan datos (marca, motor, certificado…) en la ficha.
              </p>
            ) : null}
          </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-slate-200">
                Selección y modelo
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Marca todas o algunas filas. El modelo sale del catálogo de esa
                marca; serial motor, VIN y carrocería se escriben a mano en cada
                fila.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds(rows.map((r) => r.id))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Seleccionar todas ({rows.length})
                </button>
                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={() => setSelectedIds([])}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  Ninguna
                </button>
                <span className="text-xs text-slate-400">
                  {selectedIds.length > 0
                    ? `${selectedIds.length} seleccionada${selectedIds.length === 1 ? "" : "s"}`
                    : "Sin selección: se aplican a todas"}
                </span>
              </div>
              <div className="mt-3">
                <CargaMasivaBulkModelo
                  marcaComun={marcaComunSeleccion}
                  applyCount={targetIds.length}
                  onApply={(modelo) => updateRows(targetIds, "modelo", modelo)}
                  onClear={() => updateRows(targetIds, "modelo", "")}
                />
              </div>
            </div>
          ) : null}

          <div className="relative isolate overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-800 [-webkit-overflow-scrolling:touch]">
            <p className="sticky left-0 px-3 pt-2 text-[11px] text-slate-500">
              Cada fila es un vehículo. Marca el check del título de una columna y
              escribe en la primera celda para copiar a todas.
              <span className="md:hidden">
                {" "}
                Desliza → para ver más columnas. La columna # queda fija.
              </span>
            </p>
            <table className="w-full min-w-0 border-separate border-spacing-0 text-left text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className={cargaMasivaStickyIndexHeadClass()}>
                    <div className="flex flex-col items-center gap-1">
                      <CargaMasivaSelectAllCheckbox
                        all={rows.length > 0 && selectedIds.length === rows.length}
                        some={
                          selectedIds.length > 0 &&
                          selectedIds.length < rows.length
                        }
                        onToggle={(next) =>
                          setSelectedIds(next ? rows.map((r) => r.id) : [])
                        }
                        label="Seleccionar todas las filas"
                      />
                      <span>#</span>
                    </div>
                  </th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  {VEHICLE_FIELD_COLS.map((c) => (
                    <th
                      key={c.key}
                      className={`whitespace-nowrap px-2 py-2 font-medium ${vehicleFieldHeaderClass(c)}`}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <input
                          type="checkbox"
                          checked={bulkCols.has(c.key)}
                          onChange={(e) => toggleBulkCol(c.key, e.target.checked)}
                          aria-label={`Copiar ${c.label} desde la primera fila`}
                          title="Marca y escribe en la primera celda para copiar a todas las filas"
                          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-cyan-500 accent-cyan-400"
                        />
                        <span>{c.label}</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const sem = vehicleSemaforo(row);
                  const isSelected = selectedIdSet.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`${cargaMasivaRowStripeClass(idx)}${isSelected ? " ring-1 ring-inset ring-cyan-500/25" : ""}`}
                    >
                      <td
                        className={cargaMasivaStickyIndexCellClass(
                          idx,
                          Boolean(row.error)
                        )}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              toggleRowSelected(row.id, e.target.checked)
                            }
                            aria-label={`Seleccionar fila ${idx + 1}`}
                            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-cyan-500 accent-cyan-400"
                          />
                          {idx + 1}
                        </div>
                        {row.error ? (
                          <p className="mt-1 max-w-[7rem] text-[10px] text-red-300">
                            {row.error}
                          </p>
                        ) : null}
                        {row.fuente ? (
                          <p className="mt-0.5 max-w-[7rem] truncate text-[10px] text-slate-600">
                            {row.fuente}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        {sem.nivel === "verde" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Verde
                          </span>
                        ) : sem.nivel === "ambar" ? (
                          <span
                            className="inline-flex max-w-[9rem] items-start gap-1 text-[10px] text-amber-300"
                            title={sem.detail}
                          >
                            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                            Ámbar · {sem.avisos.slice(0, 2).join(", ")}
                            {sem.avisos.length > 2 ? "…" : ""}
                          </span>
                        ) : (
                          <span
                            className="inline-flex max-w-[9rem] items-start gap-1 text-[10px] text-red-300"
                            title={sem.detail}
                          >
                            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
                            {sem.registrable
                              ? `Rojo · ${sem.criticos.slice(0, 2).join(", ") || "completar"}`
                              : `Sin VIN · ${sem.criticos.slice(0, 2).join(", ")}`}
                            {sem.criticos.length > 2 ? "…" : ""}
                          </span>
                        )}
                        {(() => {
                          const serial = normalizeSerialKey(
                            row.serialCarroceria || row.vin
                          );
                          const certMatch = serial
                            ? certMatches.find((m) => m.serial === serial)
                            : undefined;
                          return certMatch ? (
                            <p
                              className="mt-1 max-w-[9rem] truncate text-[10px] text-cyan-300"
                              title={`Certificado emparejado: ${certMatch.fileName}`}
                            >
                              Cert. ✓ {certMatch.fileName}
                            </p>
                          ) : null;
                        })()}
                      </td>
                      {VEHICLE_FIELD_COLS.map((c) => (
                        <td
                          key={c.key}
                          className={`px-1 py-1 align-top ${
                            c.code ? "whitespace-nowrap" : ""
                          } ${vehicleFieldHeaderClass(c)}${
                            idx === 0 && bulkCols.has(c.key)
                              ? " rounded-md ring-1 ring-inset ring-cyan-500/35"
                              : ""
                          }`}
                        >
                          {c.key === "marca" ? (
                            <CargaMasivaMarcaCell
                              value={String(row.marca ?? "")}
                              onChange={(next) =>
                                commitVehicleField(row, idx, "marca", next)
                              }
                            />
                          ) : c.key === "modelo" ? (
                            <CargaMasivaModeloCell
                              marca={String(row.marca ?? "")}
                              value={String(row.modelo ?? "")}
                              onChange={(next) =>
                                commitVehicleField(row, idx, "modelo", next)
                              }
                            />
                          ) : c.key === "color" ? (
                            <CargaMasivaColorCell
                              value={String(row.color ?? "")}
                              onChange={(next) =>
                                commitVehicleField(row, idx, "color", next)
                              }
                            />
                          ) : c.key === "condicion" ? (
                            (() => {
                              const esSub = (row.esSubasta ?? "")
                                .toLowerCase()
                                .trim() === "true";
                              const currentValue = esSub
                                ? "subasta"
                                : (row.condicion ?? "").trim() === "usado"
                                  ? "usado"
                                  : "nuevo";

                              return (
                                <select
                                  value={currentValue}
                                  onChange={(e) => {
                                    const ids =
                                      broadcastIds(idx, "condicion") ?? [
                                        row.id,
                                      ];
                                    applyCondicionToIds(ids, e.target.value);
                                  }}
                                  className={`${vehicleFieldInputClass(
                                    c
                                  )} w-full`}
                                  aria-label="Condición"
                                >
                                  <option value="nuevo">nuevo</option>
                                  <option value="usado">usado</option>
                                  <option value="subasta">subasta</option>
                                </select>
                              );
                            })()
                          ) : c.key === "tipoCombustible" ? (
                            <select
                              value={String(row.tipoCombustible ?? "")}
                              onChange={(e) =>
                                commitVehicleField(
                                  row,
                                  idx,
                                  "tipoCombustible",
                                  e.target.value
                                )
                              }
                              className={`${vehicleFieldInputClass(c)} w-full`}
                              aria-label="Combustible"
                            >
                              <option value="">—</option>
                              {LOTE_TIPO_COMBUSTIBLE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={String(row[c.key] ?? "")}
                              onChange={(e) =>
                                commitVehicleField(
                                  row,
                                  idx,
                                  c.key,
                                  e.target.value
                                )
                              }
                              size={vehicleFieldInputSize(c)}
                              maxLength={
                                c.key === "anio"
                                  ? 4
                                  : c.key === "cilindradaCc"
                                    ? 5
                                    : undefined
                              }
                              inputMode={
                                c.key === "anio" || c.key === "cilindradaCc"
                                  ? "numeric"
                                  : undefined
                              }
                              spellCheck={c.code ? false : undefined}
                              autoComplete="off"
                              className={vehicleFieldInputClass(
                                c,
                                String(row[c.key] ?? "")
                              )}
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-1 py-1 align-top">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="rounded-md p-1.5 text-slate-500 hover:text-red-300"
                          aria-label="Eliminar fila"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const CARGA_MASIVA_LISTADO_ID = "carga-masiva-listado";

function scrollToCargaMasivaListado() {
  document
    .getElementById(CARGA_MASIVA_LISTADO_ID)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Extraer ya leyó los PDF: al Registrar solo se adjunta, sin OCR ni fan-out N×N. */
function formDataDocUploadSkipOcr(
  vehiculoId: string,
  tipo: string,
  file: File
): FormData {
  const fd = new FormData();
  fd.set("vehiculoId", vehiculoId);
  fd.set("tipo", tipo);
  fd.set("file", file);
  fd.set("skipOcr", "1");
  fd.set("skipLoteSync", "1");
  return fd;
}

function guessTipo(name: string): DocItem["tipo"] {
  const n = name.toLowerCase();
  if (/certificado|origin|coo|origen/.test(n)) return "certificado_origen";
  if (/\bbl\b|bill|guia|guía|embarque|lading/.test(n)) return "bl_guia";
  return "factura_comercial";
}

/** Varios PDF a la vez: 1º factura (si no se reconoce) y el resto certificados. */
function assignDocTipos(files: File[]): DocItem[] {
  const guessed = files.map((file) => ({
    id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    tipo: guessTipo(file.name),
  }));
  const allLookFactura =
    guessed.length > 1 &&
    guessed.every((d) => d.tipo === "factura_comercial");
  if (!allLookFactura) return guessed;
  return guessed.map((d, i) =>
    i === 0 ? d : { ...d, tipo: "certificado_origen" as const }
  );
}


function summarizeBulkRegisterFailures(
  failed: { index: number; serial: string; error: string }[]
): string {
  if (failed.length === 0) return "";
  const groups = new Map<string, { count: number; example: (typeof failed)[0] }>();
  for (const f of failed) {
    const g = groups.get(f.error);
    if (g) g.count += 1;
    else groups.set(f.error, { count: 1, example: f });
  }
  return [...groups.values()]
    .slice(0, 3)
    .map(({ count, example }) =>
      count > 1
        ? `${count} vehículos: ${example.error}`
        : `Fila ${example.index + 1} (${example.serial}): ${example.error}`
    )
    .join(" · ");
}
