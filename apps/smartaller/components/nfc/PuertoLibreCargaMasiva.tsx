"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import type { ImportadorListItem } from "@/app/actions/nfc/importadores";
import {
  createPuertoLibreCargaMasivaAction,
  extractCargaMasivaEtapaAction,
  parseCargaMasivaSpreadsheetAction,
} from "@/app/actions/nfc/importacion-carga-masiva";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-vehiculo";
import {
  type CargaMasivaRow,
  emptyCargaMasivaRow,
} from "@/lib/importacion/carga-masiva-template";
import { readCargaMasivaSeed } from "@/lib/importacion/carga-masiva-seed";
import {
  CARGA_MASIVA_ETAPA_HINTS,
  CARGA_MASIVA_ETAPA_LABELS,
  CARGA_MASIVA_ETAPAS,
  type CargaMasivaEtapaId,
  type CargaMasivaEtapaProgress,
} from "@/lib/importacion/carga-masiva-etapas";
import {
  applySharedShipmentToRows,
  detectedImportadorFromRows,
  EMPTY_DETECTED_IMPORTADOR,
  EMPTY_SHARED_SHIPMENT,
  normalizeSerialKey,
  resumenSemaforo,
  rifCoincideConSeleccionado,
  sharedShipmentFromRows,
  vehicleCompleteness,
  vehicleSemaforo,
  VEHICLE_FIELD_COLS,
  VIN_VISIBLE_CHARS,
  SERIAL_MOTOR_VISIBLE_CHARS,
  vehicleFieldInputClass,
  type CertMatch,
  type DetectedImportador,
  type SharedShipmentFields,
} from "@/lib/importacion/carga-masiva-ui";
import {
  formatCargaMasivaClientError,
  postSmartimportOcr,
  safeStorageFileName,
  type CargaMasivaStorageDocRef,
} from "@/lib/importacion/carga-masiva-client";
import { createClient } from "@/lib/supabase/client";
import { VEHICULO_DOCS_BUCKET } from "@/lib/vehiculos/upload-documento";
import { IMPORTADOR_TIPO_LABELS, formatImportadorDocumentoLine } from "@/lib/schemas/importador";

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
  const [detectedImportador, setDetectedImportador] = useState<DetectedImportador>(
    { ...EMPTY_DETECTED_IMPORTADOR }
  );
  const [importadores] = useState(initialImportadores);
  const [selected, setSelected] = useState<ImportadorListItem | null>(
    initialSelectedImportador
  );
  const [clienteQuery, setClienteQuery] = useState("");
  const [certMatches, setCertMatches] = useState<CertMatch[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resultMsg, setResultMsg] = useState<string | null>(initialMessage);
  const [createdExpedientes, setCreatedExpedientes] = useState<
    { vehiculoId: string; codigoExpediente: string; serial: string }[]
  >([]);
  const [extractProgress, setExtractProgress] =
    useState<CargaMasivaEtapaProgress | null>(null);
  const [activeEtapa, setActiveEtapa] = useState<CargaMasivaEtapaId | null>(
    null
  );
  const sheetRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);
  const certsRef = useRef<HTMLInputElement>(null);
  const seedApplied = useRef(false);
  const initialRowsApplied = useRef(false);
  const initialDocsApplied = useRef(false);
  const certMergeHandled = useRef<number | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    if (initialRowsApplied.current || !initialRows?.length) return;
    initialRowsApplied.current = true;
    setRows(initialRows);
    setShared(sharedShipmentFromRows(initialRows));
    setDetectedImportador(detectedImportadorFromRows(initialRows));
    if (initialMessage) {
      setResultMsg(initialMessage);
    }
    setWarnings([
      "Revisa VIN, motor y color de cada fila. Selecciona el importador y súbelos certificados de origen para completar motor / nº cert.",
      "Aduana, BL y fecha de llegada se completan al cargar el BL.",
    ]);
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
    setRows(seed.rows);
    setShared(sharedShipmentFromRows(seed.rows));
    setDetectedImportador(detectedImportadorFromRows(seed.rows));
    setResultMsg(
      seed.message ?? `Se cargaron ${seed.rows.length} vehículos desde la factura.`
    );
    setWarnings([
      "Revisa VIN, motor y color de cada fila. Selecciona el importador y súbelos certificados de origen para completar motor / nº cert.",
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

    startTransition(async () => {
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

  const rifOk = useMemo(() => {
    if (!selected) return false;
    return rifCoincideConSeleccionado(
      detectedImportador.documento,
      selected.documento
    );
  }, [detectedImportador.documento, selected]);

  const semaforo = useMemo(() => resumenSemaforo(rows), [rows]);
  const incompleteCount = useMemo(
    () => rows.filter((r) => !vehicleCompleteness(r).complete).length,
    [rows]
  );

  /** Se registran todos con VIN válido (rojo/ámbar/verde). Sin VIN = omitidos. */
  const canImport =
    semaforo.aptos.length > 0 &&
    !pending &&
    Boolean(selected) &&
    rifOk;

  function updateRow(id: string, key: keyof CargaMasivaRow, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value, error: null } : r))
    );
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function ingestExtracted(nextRows: CargaMasivaRow[], matches?: CertMatch[]) {
    rowsRef.current = nextRows;
    setRows(nextRows);
    setShared(sharedShipmentFromRows(nextRows));
    const detected = detectedImportadorFromRows(nextRows);
    if (detected.documento || detected.nombre) {
      setDetectedImportador(detected);
    }
    if (matches?.length) {
      setCertMatches((prev) => {
        const bySerial = new Map(prev.map((m) => [m.serial, m]));
        for (const m of matches) bySerial.set(m.serial, m);
        return Array.from(bySerial.values());
      });
    }
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
      const result = await postSmartimportOcr(
        "/api/smartimport/ocr-carga-masiva",
        fd,
        extractCargaMasivaEtapaAction
      );
      if (!result.success) {
        setError(
          currentRows.length > 0
            ? `Certificado «${ref.fileName}»: ${result.error}. Las filas ya extraídas se mantienen; reintenta con «Subir certificados».`
            : result.error
        );
        ingestExtracted(currentRows, lastMatches);
        setWarnings(allWarnings);
        setActiveEtapa(null);
        setExtractProgress(null);
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
    startTransition(async () => {
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

  function handleDocsFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: DocItem[] = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      tipo: guessTipo(file.name),
    }));
    setDocs((prev) => [...prev, ...next].slice(0, 20));
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
          contentType: d.file.type || "application/pdf",
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

  function extractDocs() {
    if (docs.length === 0) {
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

    const hasCertOrBl = docs.some(
      (d) => d.tipo === "certificado_origen" || d.tipo === "bl_guia"
    );
    const etapas: CargaMasivaEtapaId[] = hasCertOrBl
      ? ["vins", "datos", "certs"]
      : ["vins", "datos"];

    startTransition(async () => {
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

        try {
        const allStorageDocs = await uploadDocsToStorage(docs, batchId);

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
            const ok = await applyCertsFromStorage(storageDocs, currentRows);
            if (!ok) return;
            currentRows = rowsRef.current.length > 0 ? rowsRef.current : currentRows;
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

          const result = await postSmartimportOcr(
            "/api/smartimport/ocr-carga-masiva",
            fd,
            extractCargaMasivaEtapaAction
          );
          if (!result.success) {
            setError(
              currentRows.length > 0
                ? `${result.error} Las filas ya extraídas se mantienen.`
                : result.error
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
    setResultMsg(null);
    startTransition(async () => {
      try {
        const batchId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`;
        const storageDocs = await uploadDocsToStorage(certDocs, batchId);
        await applyCertsFromStorage(storageDocs);
      } catch (err) {
        setError(formatCargaMasivaClientError(err));
      }
    });
  }

  function resolveCertFileForSerial(serialRaw: string): File | null {
    const serial = normalizeSerialKey(serialRaw);
    if (!serial) return null;
    const match = certMatches.find((m) => m.serial === serial);
    if (match) {
      const byName = docs.find(
        (d) =>
          d.tipo === "certificado_origen" && d.file.name === match.fileName
      );
      if (byName) return byName.file;
    }
    const certs = docs.filter((d) => d.tipo === "certificado_origen");
    if (certs.length === 1) return certs[0]!.file;
    return null;
  }

  function importRows() {
    if (!selected) {
      setError("Selecciona el cliente importador");
      return;
    }
    if (!rifOk) {
      setError(
        "El RIF de los documentos no coincide con el cliente seleccionado"
      );
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

    const rowsToImport = applySharedShipmentToRows(aptos, shared).map((r) => ({
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

    startTransition(async () => {
      try {
      const result = await createPuertoLibreCargaMasivaAction({
        importadorId: selected.id,
        rows: rowsToImport,
        detectedImportadorDocumento: detectedImportador.documento,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const ok = result.created.length;
      const fail = result.failed.length;

      let attachNote = "";
      if (ok > 0 && docs.length > 0) {
        let attached = 0;
        let attachFail = 0;
        const factura = docs.find((d) => d.tipo === "factura_comercial");
        const bl = docs.find((d) => d.tipo === "bl_guia");
        for (const c of result.created) {
          const sharedDocs = [factura, bl].filter(Boolean) as DocItem[];
          for (const d of sharedDocs) {
            const fd = new FormData();
            fd.set("vehiculoId", c.vehiculoId);
            fd.set("tipo", d.tipo);
            fd.set("file", d.file);
            const up = await uploadPuertoLibreDocumentoAction(fd);
            if (up.success) attached += 1;
            else attachFail += 1;
          }
          const certFile = resolveCertFileForSerial(c.serial);
          if (certFile) {
            const fd = new FormData();
            fd.set("vehiculoId", c.vehiculoId);
            fd.set("tipo", "certificado_origen");
            fd.set("file", certFile);
            const up = await uploadPuertoLibreDocumentoAction(fd);
            if (up.success) attached += 1;
            else attachFail += 1;
          }
        }
        if (attached > 0) {
          attachNote = ` Documentos adjuntos: ${attached}.`;
        }
        if (attachFail > 0) {
          attachNote += ` No se pudieron adjuntar ${attachFail} archivo(s).`;
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
          ? ` Semáforo: ${verdCount} verde, ${ambarCount} ámbar, ${rojoCount} rojo (completar datos en el expediente).`
          : "";

      setResultMsg(
        fail > 0
          ? `Creados ${ok}. Fallaron ${fail}.${semNote}${attachNote}`
          : `Se registraron ${ok} expediente${ok === 1 ? "" : "s"}.${semNote}${attachNote}`
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
          setDetectedImportador({ ...EMPTY_DETECTED_IMPORTADOR });
          setCertMatches([]);
        }
        router.refresh();
      }
      if (fail > 0) {
        setError(
          result.failed
            .slice(0, 5)
            .map((f) => `Fila ${f.index + 1} (${f.serial}): ${f.error}`)
            .join(" · ")
        );
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
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
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
        <h2 className="text-base font-semibold text-slate-100">
          {hideClienteSection ? "1.- Factura con varios vehículos" : "2.- Factura con varios vehículos"}
        </h2>

        <div className="grid grid-cols-2 gap-2">
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
        </div>

        <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-1">
          {(
            [
              { id: "documentos" as const, label: "PDF / Fotos", icon: FileUp },
              { id: "plantilla" as const, label: "Excel / CSV", icon: FileSpreadsheet },
            ] as const
          ).map((tab) => {
            const active = mode === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-cyan-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {mode === "plantilla" ? (
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() => sheetRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
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
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => docsRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-400 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Agregar PDF
              </button>
              <button
                type="button"
                disabled={pending || docs.length === 0}
                onClick={extractDocs}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {pending ? "Extrayendo…" : "Extraer vehículos"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => certsRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-400 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Añadir certificados
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  setRows((prev) => [
                    ...prev,
                    emptyCargaMasivaRow({ fuente: "Manual" }),
                  ])
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-400 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Añadir fila
              </button>
            </div>
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
                      <option value="certificado_origen">Certificado origen</option>
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

            {(pending && extractProgress) || extractProgress ? (
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300/90">
                  Extracción por etapas
                </p>
                <ol className="mt-2 space-y-1.5">
                  {CARGA_MASIVA_ETAPAS.map((id) => {
                    const done =
                      extractProgress &&
                      CARGA_MASIVA_ETAPAS.indexOf(extractProgress.etapa) >
                        CARGA_MASIVA_ETAPAS.indexOf(id);
                    const current = activeEtapa === id;
                    const skipped =
                      id === "certs" &&
                      !docs.some(
                        (d) =>
                          d.tipo === "certificado_origen" || d.tipo === "bl_guia"
                      );
                    return (
                      <li
                        key={id}
                        className={`flex items-center gap-2 text-sm ${
                          skipped
                            ? "text-slate-600"
                            : current
                              ? "text-cyan-100"
                              : done
                                ? "text-emerald-300/90"
                                : "text-slate-500"
                        }`}
                      >
                        {current ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        ) : done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-current opacity-40" />
                        )}
                        <span>
                          {CARGA_MASIVA_ETAPA_LABELS[id]}
                          {skipped ? " (omitida)" : ""}
                          {current ? ` — ${CARGA_MASIVA_ETAPA_HINTS[id]}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {extractProgress ? (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                        style={{ width: `${extractProgress.pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">
                      {extractProgress.vinsEncontrados} VIN ·{" "}
                      {extractProgress.filasCompletas}/
                      {extractProgress.totalFilas || "—"} filas completas
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}

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
            <ul className="space-y-1 border-t border-emerald-900/30 pt-2 font-mono text-xs">
              {createdExpedientes.map((c) => (
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
          ) : null}
        </div>
      ) : null}

      {rows.length > 0 || mode === "documentos" ? (
        <section
          id={CARGA_MASIVA_LISTADO_ID}
          className="scroll-mt-4 space-y-3"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
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
                faltan motor/color/año/cert · Rojo = faltan marca/modelo (igual se
                crea). Sin VIN no se registra.
                {incompleteCount > 0
                  ? " Sube certificados para rellenar motor y nº cert."
                  : null}
              </p>
            </div>
            <button
              type="button"
              disabled={!canImport}
              onClick={importRows}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {pending
                ? "Registrando…"
                : `Registrar ${semaforo.aptos.length} vehículo${semaforo.aptos.length === 1 ? "" : "s"}`}
            </button>
          </div>

          {semaforo.bloqueados.length > 0 ? (
            <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              {semaforo.bloqueados.length} sin VIN válido (no se crearán). El resto
              ({semaforo.aptos.length}) sí se registra; el color indica qué falta
              completar después.
            </p>
          ) : semaforo.rojo > 0 || semaforo.ambar > 0 ? (
            <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
              Se crearán {semaforo.aptos.length} expediente(s). Los de color
              rojo/ámbar quedan pendientes de datos (marca, motor, certificado…)
              en la ficha.
            </p>
          ) : null}

          {!selected && !hideClienteSection ? (
            <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
              Selecciona el cliente importador (paso 1) para habilitar el registro.
            </p>
          ) : null}

          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-slate-100">
              Completar con certificados de origen
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Añade uno o varios PDF (un certificado por vehículo o un PDF con
              varios VIN). Se emparejan por serial y, si no hay fila, se crea.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => certsRef.current?.click()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm font-medium text-slate-100 hover:border-slate-400 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Subir certificados
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <p className="px-3 pt-2 text-[11px] text-slate-500 md:hidden">
              VIN y seriales completos: desliza la tabla en horizontal.
            </p>
            <table className="w-max min-w-full border-collapse text-left text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th
                    className="sticky left-0 z-20 bg-slate-900 px-2 py-2 font-medium shadow-[2px_0_0_rgba(0,0,0,0.25)]"
                  >
                    #
                  </th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  {VEHICLE_FIELD_COLS.map((c) => (
                    <th
                      key={c.key}
                      className={`whitespace-nowrap px-2 py-2 font-medium ${
                        c.code ? "min-w-[18ch]" : ""
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const sem = vehicleSemaforo(row);
                  const rowTone =
                    sem.nivel === "rojo" || row.error
                      ? "border-t border-red-900/40 bg-red-950/20"
                      : sem.nivel === "ambar"
                        ? "border-t border-amber-900/30 bg-amber-950/10"
                        : "border-t border-slate-800/80";
                  return (
                    <tr key={row.id} className={rowTone}>
                      <td
                        className="sticky left-0 z-10 bg-slate-950/70 px-2 py-1.5 align-top text-slate-500 shadow-[2px_0_0_rgba(0,0,0,0.2)]"
                      >
                        {idx + 1}
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
                          }`}
                        >
                          <input
                            value={String(row[c.key] ?? "")}
                            onChange={(e) =>
                              updateRow(row.id, c.key, e.target.value)
                            }
                            size={
                              c.code
                                ? c.key === "serialMotor"
                                  ? SERIAL_MOTOR_VISIBLE_CHARS
                                  : VIN_VISIBLE_CHARS
                                : undefined
                            }
                            spellCheck={c.code ? false : undefined}
                            autoComplete="off"
                            className={vehicleFieldInputClass(c)}
                          />
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

function guessTipo(name: string): DocItem["tipo"] {
  const n = name.toLowerCase();
  if (/certificado|origin|coo|origen/.test(n)) return "certificado_origen";
  return "factura_comercial";
}
