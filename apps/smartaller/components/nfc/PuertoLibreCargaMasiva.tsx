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
  Search,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import type { ImportadorListItem } from "@/app/actions/nfc/importadores";
import {
  completarCargaMasivaConCertificadosAction,
  createPuertoLibreCargaMasivaAction,
  extractCargaMasivaEtapaAction,
  parseCargaMasivaSpreadsheetAction,
} from "@/app/actions/nfc/importacion-carga-masiva";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-vehiculo";
import {
  CARGA_MASIVA_MAX_ROWS,
  type CargaMasivaRow,
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
  rifCoincideConSeleccionado,
  sharedShipmentFromRows,
  vehicleCompleteness,
  VEHICLE_FIELD_COLS,
  type CertMatch,
  type DetectedImportador,
  type SharedShipmentFields,
} from "@/lib/importacion/carga-masiva-ui";
import { IMPORTADOR_TIPO_LABELS } from "@/lib/schemas/importador";

type Mode = "plantilla" | "documentos";

type DocItem = {
  id: string;
  file: File;
  tipo: "factura_comercial" | "bl_guia" | "certificado_origen";
};

type Props = {
  initialImportadores: ImportadorListItem[];
};

export function PuertoLibreCargaMasiva({ initialImportadores }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("documentos");
  const [rows, setRows] = useState<CargaMasivaRow[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [shared, setShared] = useState<SharedShipmentFields>({
    ...EMPTY_SHARED_SHIPMENT,
  });
  const [detectedImportador, setDetectedImportador] = useState<DetectedImportador>(
    { ...EMPTY_DETECTED_IMPORTADOR }
  );
  const [importadores] = useState(initialImportadores);
  const [selected, setSelected] = useState<ImportadorListItem | null>(null);
  const [clienteQuery, setClienteQuery] = useState("");
  const [certMatches, setCertMatches] = useState<CertMatch[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [extractProgress, setExtractProgress] =
    useState<CargaMasivaEtapaProgress | null>(null);
  const [activeEtapa, setActiveEtapa] = useState<CargaMasivaEtapaId | null>(
    null
  );
  const sheetRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);
  const certsRef = useRef<HTMLInputElement>(null);
  const seedApplied = useRef(false);

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
    router.replace("/importacion/carga-masiva", { scroll: false });
  }, [router]);

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

  const errorCount = useMemo(() => rows.filter((r) => r.error).length, [rows]);
  const incompleteCount = useMemo(
    () => rows.filter((r) => !vehicleCompleteness(r).complete).length,
    [rows]
  );

  const canImport =
    rows.length > 0 &&
    errorCount === 0 &&
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

  function extractDocs() {
    if (docs.length === 0) {
      setError("Agrega al menos un PDF o foto");
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
      let currentRows: CargaMasivaRow[] = [];
      const allWarnings: string[] = [];
      let lastCertMatches: CertMatch[] = [];

      for (let i = 0; i < etapas.length; i++) {
        const etapa = etapas[i]!;
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
        for (const d of docs) {
          fd.append("files", d.file);
          fd.append("tipos", d.tipo);
        }
        if (etapa !== "vins") {
          fd.set("rowsJson", JSON.stringify(currentRows));
        }

        const result = await extractCargaMasivaEtapaAction(fd);
        if (!result.success) {
          setError(result.error);
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
    });
  }

  function completarConCertificados(list: FileList | null) {
    if (!list?.length) return;
    if (rows.length === 0) {
      setError("Primero extrae o carga los vehículos");
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
      const fd = new FormData();
      for (const d of certDocs) {
        fd.append("files", d.file);
      }
      fd.set("rowsJson", JSON.stringify(rows));
      const result = await completarCargaMasivaConCertificadosAction(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      ingestExtracted(result.rows, result.certMatches);
      setWarnings(result.warnings);
      setResultMsg(
        `Certificados aplicados. ${
          result.rows.filter((r) => vehicleCompleteness(r).complete).length
        }/${result.rows.length} filas con datos completos.`
      );
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
    setError(null);
    setResultMsg(null);

    const rowsToImport = applySharedShipmentToRows(rows, shared).map((r) => ({
      ...r,
      importadorNombre: selected.nombre,
      importadorDocumento: selected.documento,
      importadorTelefono: selected.telefono ?? r.importadorTelefono,
      importadorEmail: selected.email ?? r.importadorEmail,
      importadorDireccion: selected.direccion ?? r.importadorDireccion,
    }));
    setRows(rowsToImport);

    startTransition(async () => {
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

      setResultMsg(
        fail === 0
          ? `Se registraron ${ok} expediente${ok === 1 ? "" : "s"}.${attachNote}`
          : `Registrados: ${ok}. Fallidos: ${fail}.${attachNote}`
      );
      if (ok > 0) {
        setRows([]);
        setDocs([]);
        setShared({ ...EMPTY_SHARED_SHIPMENT });
        setDetectedImportador({ ...EMPTY_DETECTED_IMPORTADOR });
        setCertMatches([]);
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
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <UserRound className="h-4 w-4 text-cyan-400" />
          1. Cliente importador
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Todos los expedientes de esta carga quedan asociados a este cliente. Si
          la factura trae otro RIF, debes elegir el importador correcto antes de
          registrar.
        </p>

        {selected ? (
          <div className="mt-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">
              Seleccionado
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-50">
              {selected.nombre}
            </p>
            <p className="mt-0.5 font-mono text-xs text-zinc-400">
              RIF {selected.documento}
              {selected.cedula ? ` · CI ${selected.cedula}` : ""}
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
                  href="/importacion/clientes"
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

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-base font-semibold text-slate-100">
          Factura con varios vehículos
        </h2>
        <p className="mt-1 text-justify text-sm text-slate-400">
          Ideal para{" "}
          <span className="text-slate-200">hoja anexa MAV</span> (No. de Chasis /
          Motor / Llave / Color / Código) o carátula multipágina. La IA lista
          todas las unidades; luego los{" "}
          <span className="text-slate-200">certificados de origen</span>{" "}
          completan motor y nº de certificado por VIN. También Excel/CSV (hasta{" "}
          {CARGA_MASIVA_MAX_ROWS} filas).
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href="/importacion/carga-masiva/plantilla.xlsx"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2.5 text-center text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="leading-tight">Plantilla Excel (.xlsx)</span>
          </a>
          <a
            href="/importacion/carga-masiva/plantilla.csv"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2.5 text-center text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="leading-tight">Plantilla CSV</span>
          </a>
        </div>
      </section>

      <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-1">
        {(
          [
            { id: "documentos" as const, label: "PDFs / fotos", icon: FileUp },
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
        <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5">
          <h2 className="text-base font-semibold text-slate-100">
            2. Sube el archivo
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Acepta .xlsx, .xls o .csv (coma o punto y coma).
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => sheetRef.current?.click()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
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
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5">
          <h2 className="text-base font-semibold text-slate-100">
            2. Sube facturas y certificados
          </h2>
          <p className="text-sm text-slate-400">
            Sube la factura (carátula o anexa) y los certificados de origen. El
            certificado rellena motor, color y nº cert. por VIN. Aduana, nº BL,
            país y fecha de llegada se completan al cargar el BL en Embarque del
            expediente (no en esta pantalla).
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => docsRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 hover:border-slate-400 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Agregar PDFs o fotos
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
            {pending ? "Extrayendo por etapas…" : "Extraer vehículos"}
          </button>

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
        </section>
      )}

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

      {resultMsg ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {resultMsg}{" "}
          <Link href="/importacion" className="underline hover:text-emerald-100">
            Ver listado
          </Link>
        </p>
      ) : null}

      {rows.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                3. Revisa vehículos ({rows.length})
              </h2>
              <p className="text-xs text-slate-500">
                Solo datos por unidad. Embarque (aduana, BL, fecha) se completa al
                cargar el BL en el expediente.
                {incompleteCount > 0
                  ? ` · ${incompleteCount} fila(s) incompletas — súbelos certificados de origen.`
                  : " · Todas las filas tienen motor y nº cert."}
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
                : `Registrar ${rows.length} expediente${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>

          {!selected ? (
            <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
              Selecciona el cliente importador (paso 1) para habilitar el registro.
            </p>
          ) : null}

          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-slate-100">
              Completar con certificados de origen
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Si ya tienes las filas de la factura, sube aquí los certificados
              (uno por vehículo o un PDF multi). Se emparejan por VIN y rellenan
              motor, marca, color, año y nº de certificado.
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
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="min-w-[900px] w-full border-collapse text-left text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  {VEHICLE_FIELD_COLS.map((c) => (
                    <th
                      key={c.key}
                      className="whitespace-nowrap px-2 py-2 font-medium"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const completeness = vehicleCompleteness(row);
                  return (
                    <tr
                      key={row.id}
                      className={
                        row.error
                          ? "border-t border-red-900/40 bg-red-950/20"
                          : "border-t border-slate-800/80"
                      }
                    >
                      <td className="px-2 py-1.5 align-top text-slate-500">
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
                        {completeness.complete ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Completo
                          </span>
                        ) : (
                          <span
                            className="inline-flex max-w-[8rem] items-start gap-1 text-[10px] text-amber-300"
                            title={`Falta: ${completeness.missing.join(", ")}`}
                          >
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            Falta {completeness.missing.slice(0, 2).join(", ")}
                            {completeness.missing.length > 2 ? "…" : ""}
                          </span>
                        )}
                      </td>
                      {VEHICLE_FIELD_COLS.map((c) => (
                        <td key={c.key} className="px-1 py-1 align-top">
                          <input
                            value={String(row[c.key] ?? "")}
                            onChange={(e) =>
                              updateRow(row.id, c.key, e.target.value)
                            }
                            className={`w-full min-w-[4.5rem] rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-500/50 ${
                              c.wide ? "min-w-[8rem]" : ""
                            }`}
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

function guessTipo(name: string): DocItem["tipo"] {
  const n = name.toLowerCase();
  if (/certificado|origin|coo|origen/.test(n)) return "certificado_origen";
  return "factura_comercial";
}
