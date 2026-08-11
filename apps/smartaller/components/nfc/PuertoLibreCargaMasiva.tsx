"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createPuertoLibreCargaMasivaAction,
  extractCargaMasivaDocumentosAction,
  parseCargaMasivaSpreadsheetAction,
} from "@/app/actions/nfc/importacion-carga-masiva";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-vehiculo";
import {
  CARGA_MASIVA_MAX_ROWS,
  type CargaMasivaRow,
} from "@/lib/importacion/carga-masiva-template";

type Mode = "plantilla" | "documentos";

type DocItem = {
  id: string;
  file: File;
  tipo: "factura_comercial" | "bl_guia" | "certificado_origen";
};

type SharedFields = {
  importadorNombre: string;
  importadorDocumento: string;
  importadorDireccion: string;
  fechaLlegadaBuque: string;
  aduana: string;
  numeroBl: string;
  paisOrigen: string;
  anio: string;
  marca: string;
};

const EMPTY_SHARED: SharedFields = {
  importadorNombre: "",
  importadorDocumento: "",
  importadorDireccion: "",
  fechaLlegadaBuque: "",
  aduana: "",
  numeroBl: "",
  paisOrigen: "",
  anio: "",
  marca: "",
};

const FIELD_COLS: {
  key: keyof CargaMasivaRow;
  label: string;
  wide?: boolean;
}[] = [
  { key: "marca", label: "Marca" },
  { key: "modelo", label: "Modelo" },
  { key: "color", label: "Color" },
  { key: "anio", label: "Año" },
  { key: "serialMotor", label: "Serial motor", wide: true },
  { key: "vin", label: "VIN", wide: true },
  { key: "serialCarroceria", label: "Serial carrocería", wide: true },
  { key: "kilometraje", label: "Km" },
  { key: "condicion", label: "Condición" },
  { key: "esSubasta", label: "Subasta" },
  { key: "partidaArancelaria", label: "Partida" },
  { key: "cilindradaCc", label: "cc" },
  { key: "tipoCombustible", label: "Combustible" },
  { key: "fechaLlegadaBuque", label: "Llegada buque", wide: true },
  { key: "importadorNombre", label: "Importador", wide: true },
  { key: "importadorDocumento", label: "RIF" },
  { key: "importadorDireccion", label: "Dir. fiscal", wide: true },
  { key: "numeroBl", label: "Nº BL" },
  { key: "aduana", label: "Aduana" },
  { key: "paisOrigen", label: "Origen" },
  { key: "valorCif", label: "CIF" },
  { key: "tasaCambioBcv", label: "Tasa BCV" },
  { key: "numeroExpedienteSeniat", label: "Exp. SENIAT" },
  { key: "numeroDav", label: "DAV" },
  { key: "observaciones", label: "Obs. (unidad/llave)", wide: true },
];

function sharedFromRows(rows: CargaMasivaRow[]): SharedFields {
  const first = rows[0];
  if (!first) return { ...EMPTY_SHARED };
  return {
    importadorNombre: first.importadorNombre ?? "",
    importadorDocumento: first.importadorDocumento ?? "",
    importadorDireccion: first.importadorDireccion ?? "",
    fechaLlegadaBuque: first.fechaLlegadaBuque ?? "",
    aduana: first.aduana ?? "",
    numeroBl: first.numeroBl ?? "",
    paisOrigen: first.paisOrigen ?? "",
    anio: first.anio ?? "",
    marca: first.marca ?? "",
  };
}

export function PuertoLibreCargaMasiva() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("documentos");
  const [rows, setRows] = useState<CargaMasivaRow[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [shared, setShared] = useState<SharedFields>({ ...EMPTY_SHARED });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const sheetRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  const errorCount = useMemo(
    () => rows.filter((r) => r.error).length,
    [rows]
  );
  const canImport = rows.length > 0 && errorCount === 0 && !pending;

  function updateRow(id: string, key: keyof CargaMasivaRow, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value, error: null } : r))
    );
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function applySharedToAll() {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        importadorNombre: shared.importadorNombre.trim() || r.importadorNombre,
        importadorDocumento:
          shared.importadorDocumento.trim() || r.importadorDocumento,
        importadorDireccion:
          shared.importadorDireccion.trim() || r.importadorDireccion,
        fechaLlegadaBuque:
          shared.fechaLlegadaBuque.trim() || r.fechaLlegadaBuque,
        aduana: shared.aduana.trim() || r.aduana,
        numeroBl: shared.numeroBl.trim() || r.numeroBl,
        paisOrigen: shared.paisOrigen.trim() || r.paisOrigen,
        anio: shared.anio.trim() || r.anio,
        marca: shared.marca.trim() || r.marca,
        error: null,
      }))
    );
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
      setRows(result.rows);
      setShared(sharedFromRows(result.rows));
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
    startTransition(async () => {
      const fd = new FormData();
      for (const d of docs) {
        fd.append("files", d.file);
        fd.append("tipos", d.tipo);
      }
      const result = await extractCargaMasivaDocumentosAction(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setRows(result.rows);
      setShared(sharedFromRows(result.rows));
      setWarnings(result.warnings);
    });
  }

  function importRows() {
    setError(null);
    setResultMsg(null);
    const rowsToImport = rows.map((r) => ({
      ...r,
      importadorNombre: shared.importadorNombre.trim() || r.importadorNombre,
      importadorDocumento:
        shared.importadorDocumento.trim() || r.importadorDocumento,
      importadorDireccion:
        shared.importadorDireccion.trim() || r.importadorDireccion,
      fechaLlegadaBuque: shared.fechaLlegadaBuque.trim() || r.fechaLlegadaBuque,
      aduana: shared.aduana.trim() || r.aduana,
      numeroBl: shared.numeroBl.trim() || r.numeroBl,
      paisOrigen: shared.paisOrigen.trim() || r.paisOrigen,
      anio: shared.anio.trim() || r.anio,
      marca: shared.marca.trim() || r.marca,
      error: null,
    }));
    setRows(rowsToImport);

    startTransition(async () => {
      const result = await createPuertoLibreCargaMasivaAction(rowsToImport);
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
        const certificado = docs.find((d) => d.tipo === "certificado_origen");
        const bl = docs.find((d) => d.tipo === "bl_guia");
        const toAttach = [factura, certificado, bl].filter(Boolean) as DocItem[];
        for (const c of result.created) {
          for (const d of toAttach) {
            const fd = new FormData();
            fd.set("vehiculoId", c.vehiculoId);
            fd.set("tipo", d.tipo);
            fd.set("file", d.file);
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
        setShared({ ...EMPTY_SHARED });
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
        <h2 className="text-base font-semibold text-slate-100">
          Factura con varios vehículos
        </h2>
        <p className="mt-1 text-justify text-sm text-slate-400">
          Sube la factura (carátula o hoja anexa) y, si tienes, el BL. La IA
          detecta todas las unidades, revisas la tabla y registras N
          expedientes de una vez. También puedes usar Excel/CSV (hasta{" "}
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
            2. Sube facturas y BL
          </h2>
          <p className="text-sm text-slate-400">
            Sube factura (carátula o anexa), certificado de origen y BL. El
            certificado rellena lo que falte (motor, origen, etc.) emparejando
            por VIN.
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
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="factura_comercial">Factura</option>
                    <option value="certificado_origen">Certificado origen</option>
                    <option value="bl_guia">BL / Guía</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setDocs((prev) => prev.filter((x) => x.id !== d.id))
                    }
                    className="rounded-lg p-1.5 text-slate-500 hover:text-red-300"
                    aria-label="Quitar"
                  >
                    <Trash2 className="h-4 w-4" />
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
            {pending ? "Extrayendo con IA…" : "Extraer vehículos"}
          </button>
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
                3. Revisa y registra ({rows.length})
              </h2>
              <p className="text-xs text-slate-500">
                Completa los datos compartidos (fecha buque, importador…) y
                corrige celdas en rojo. Cada fila = un expediente.
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

          <div className="space-y-3 rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Datos compartidos (aplican a todas las filas)
              </h3>
              <button
                type="button"
                onClick={applySharedToAll}
                className="rounded-lg border border-cyan-700/50 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-950/50"
              >
                Aplicar a todas
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["importadorNombre", "Importador", "text"],
                  ["importadorDocumento", "RIF", "text"],
                  ["importadorDireccion", "Dirección fiscal", "text"],
                  ["marca", "Marca", "text"],
                  ["anio", "Año", "text"],
                  ["fechaLlegadaBuque", "Fecha llegada buque", "date"],
                  ["aduana", "Aduana / destino", "text"],
                  ["numeroBl", "Nº BL", "text"],
                  ["paisOrigen", "País / origen", "text"],
                ] as const
              ).map(([key, label, type]) => (
                <label key={key} className="block space-y-1">
                  <span className="text-[11px] text-zinc-500">{label}</span>
                  <input
                    type={type}
                    value={shared[key]}
                    onChange={(e) =>
                      setShared((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/50"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="min-w-[1100px] w-full border-collapse text-left text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-2 py-2 font-medium">#</th>
                  {FIELD_COLS.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-2 py-2 font-medium">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
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
                    {FIELD_COLS.map((c) => (
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
                ))}
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
  if (/\bbl\b|bill|guia|guía|embarque|lading/.test(n)) return "bl_guia";
  if (/certificado|origin|coo|origen/.test(n)) return "certificado_origen";
  return "factura_comercial";
}
