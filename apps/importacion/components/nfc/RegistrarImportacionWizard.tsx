"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import type { ImportadorListItem } from "@/app/actions/nfc/importadores";
import { ImportadorForm } from "@/components/nfc/ImportadorForm";
import { PuertoLibreCargaMasiva } from "@/components/nfc/PuertoLibreCargaMasiva";
import { VehicleImportWizard } from "@/components/VehicleImport/VehicleImportWizard";
import type { MultiDocDetectedPayload } from "@/components/nfc/PuertoLibreDocScan";
import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { mergeCargaMasivaRowsByVin } from "@/lib/importacion/carga-masiva-ui";
import {
  IMPORTADOR_TIPO_LABELS,
  formatImportadorDocumentoLine,
} from "@/lib/schemas/importador";

type Props = {
  initialImportadores: ImportadorListItem[];
  tallerId: string;
  startInMasiva?: boolean;
};

type Step = "cliente" | "importacion";
type ImportModo = "individual" | "masiva";
type MasivaTabMode = "plantilla" | "documentos";

type MasivaDocSeed = {
  file: File;
  tipo: "factura_comercial" | "bl_guia" | "certificado_origen";
};

/**
 * Alta de importación: 1) cliente importador → 2) datos del vehículo / carga masiva inline.
 */
export function RegistrarImportacionWizard({
  initialImportadores,
  tallerId,
  startInMasiva = false,
}: Props) {
  const [step, setStep] = useState<Step>("cliente");
  const [mode, setMode] = useState<"buscar" | "nuevo">("buscar");
  const [query, setQuery] = useState("");
  const [clientes, setClientes] = useState(initialImportadores);
  const [selected, setSelected] = useState<ImportadorListItem | null>(null);
  const [importModo, setImportModo] = useState<ImportModo>(
    startInMasiva ? "masiva" : "individual"
  );
  const [masivaRows, setMasivaRows] = useState<CargaMasivaRow[] | undefined>(
    undefined
  );
  const [masivaMessage, setMasivaMessage] = useState<string | null>(null);
  const [masivaTabMode, setMasivaTabMode] = useState<MasivaTabMode>("documentos");
  const [masivaInstance, setMasivaInstance] = useState(0);
  const [certMergeRequest, setCertMergeRequest] = useState<{
    files: File[];
    requestId: number;
  } | null>(null);
  const [masivaInitialDocs, setMasivaInitialDocs] = useState<MasivaDocSeed[]>(
    []
  );
  const masivaRowsRef = useRef<CargaMasivaRow[] | undefined>(masivaRows);
  const masivaDocsRef = useRef<MasivaDocSeed[]>([]);
  masivaRowsRef.current = masivaRows;

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.documento.toLowerCase().includes(q) ||
        (c.cedula ?? "").toLowerCase().includes(q) ||
        (c.telefono ?? "").toLowerCase().includes(q) ||
        (c.registroPuertoLibre ?? "").toLowerCase().includes(q)
    );
  }, [clientes, query]);

  function openMasivaPlantilla() {
    setMasivaRows(undefined);
    masivaRowsRef.current = undefined;
    setMasivaMessage(null);
    setMasivaInitialDocs([]);
    masivaDocsRef.current = [];
    setCertMergeRequest(null);
    setMasivaTabMode("plantilla");
    setImportModo("masiva");
    setMasivaInstance((n) => n + 1);
  }

  function handleMultiDetected(payload: MultiDocDetectedPayload) {
    const { rows, message, docTipo, file } = payload;
    const certFiles = [
      ...(docTipo === "certificado_origen" && file ? [file] : []),
      ...(payload.extraCertFiles ?? []),
    ].filter((item, index, all) => all.indexOf(item) === index);
    const incomingDocs: MasivaDocSeed[] = [];
    const factura =
      payload.facturaFile ??
      (docTipo === "factura_comercial" ? file : undefined);
    if (factura) {
      incomingDocs.push({ file: factura, tipo: "factura_comercial" });
    }
    for (const cert of certFiles) {
      incomingDocs.push({ file: cert, tipo: "certificado_origen" });
    }

    const mergedRows = mergeCargaMasivaRowsByVin(
      masivaRowsRef.current ?? [],
      rows
    );
    masivaRowsRef.current = mergedRows.length > 0 ? mergedRows : masivaRowsRef.current;

    const seen = new Set(
      masivaDocsRef.current.map((d) => `${d.tipo}:${d.file.name}:${d.file.size}`)
    );
    for (const doc of incomingDocs) {
      const key = `${doc.tipo}:${doc.file.name}:${doc.file.size}`;
      if (seen.has(key)) continue;
      seen.add(key);
      masivaDocsRef.current.push(doc);
    }

    if (
      docTipo === "certificado_origen" &&
      (masivaRowsRef.current?.length ?? 0) > 0
    ) {
      setMasivaInitialDocs(masivaDocsRef.current);
      setCertMergeRequest({ files: certFiles, requestId: Date.now() });
      setMasivaMessage(
        "Certificado detectado. Emparejando con las filas por VIN…"
      );
      setImportModo("masiva");
      return;
    }

    setMasivaInitialDocs(masivaDocsRef.current);
    setMasivaRows(masivaRowsRef.current);
    setMasivaMessage(message);
    setMasivaTabMode("documentos");
    setImportModo("masiva");
    setMasivaInstance((n) => n + 1);
    // Siempre re-emparejar certificados en la planilla masiva (precarga por VIN).
    if (certFiles.length > 0) {
      setCertMergeRequest({ files: certFiles, requestId: Date.now() });
    } else {
      setCertMergeRequest(null);
    }
  }

  function switchToIndividual() {
    setImportModo("individual");
  }

  if (step === "importacion" && selected) {
    const clienteBanner = (
      <div className="rounded-2xl border border-emerald-700/55 bg-[#071412] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
          Cliente de la importación
        </p>
        <p className="mt-2 text-base font-semibold text-white">{selected.nombre}</p>
        <p className="mt-1 font-mono text-[13px] text-slate-400">
          {formatImportadorDocumentoLine(selected)}
          {" · "}
          {IMPORTADOR_TIPO_LABELS[selected.tipo]}
        </p>
        {selected.tipo === "juridica" && selected.registroPuertoLibre ? (
          <p className="mt-0.5 text-[12px] text-slate-500">
            Registro PL {selected.registroPuertoLibre}
            {selected.registroPlVence
              ? ` · vence ${selected.registroPlVence}`
              : ""}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setStep("cliente")}
          className="mt-3 text-sm text-cyan-400 hover:text-cyan-300"
        >
          Cambiar cliente
        </button>
      </div>
    );

    if (importModo === "masiva") {
      return (
        <div className="space-y-4">
          {clienteBanner}
          <div className="rounded-2xl border border-white/[0.06] bg-[#08141c] p-5 sm:p-6">
            <PuertoLibreCargaMasiva
              key={masivaInstance}
              embedded
              hideClienteSection
              initialSelectedImportador={selected}
              initialRows={masivaRows}
              initialMode={masivaTabMode}
              initialMessage={masivaMessage}
              initialDocs={masivaInitialDocs}
              certMergeRequest={certMergeRequest}
              onSwitchToIndividual={switchToIndividual}
              initialImportadores={clientes}
              tallerId={tallerId}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {clienteBanner}
        <VehicleImportWizard importador={selected} tallerId={tallerId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.06] bg-[#08141c] p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-400">
          Cliente de la importación
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          {mode === "nuevo" ? "Registrar cliente" : "Selecciona el cliente"}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {mode === "nuevo"
            ? "Carga el RIF o la cédula para autocompletar, o llena los datos a mano."
            : "Elige quién importa. Después subes la factura y los certificados."}
        </p>

        <div className="mt-4 flex gap-1 rounded-xl border border-white/[0.06] bg-[#070f16] p-1">
          <button
            type="button"
            onClick={() => setMode("buscar")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              mode === "buscar"
                ? "bg-cyan-600 text-white shadow-[0_8px_20px_rgba(8,145,178,0.28)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Search className="h-4 w-4" />
            Buscar cliente
          </button>
          <button
            type="button"
            onClick={() => setMode("nuevo")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              mode === "nuevo"
                ? "bg-cyan-600 text-white shadow-[0_8px_20px_rgba(8,145,178,0.28)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </button>
        </div>

        {mode === "nuevo" ? (
          <div className="mt-5">
            <ImportadorForm
              submitLabel="Guardar y continuar"
              onSaved={(imp) => {
                const item: ImportadorListItem = {
                  ...imp,
                  tipoLabel: IMPORTADOR_TIPO_LABELS[imp.tipo],
                  documentos: imp.documentos ?? {},
                  activo: true,
                  createdAt: new Date().toISOString(),
                };
                setClientes((prev) => {
                  if (prev.some((c) => c.id === item.id)) return prev;
                  return [item, ...prev];
                });
                setSelected(item);
                setStep("importacion");
              }}
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <aside className="rounded-xl border border-[#183c44] bg-[#0c1a21] px-4 py-3 text-sm">
              <p className="font-medium text-[#e9edef]">Un cliente por importación</p>
              <p className="mt-0.5 text-[13px] text-[#70a5ad]">
                Puedes cambiarlo después, antes de guardar los expedientes.
              </p>
            </aside>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, RIF o teléfono…"
                className="w-full rounded-xl border border-slate-700/80 bg-[#070f16] py-3 pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-500/60"
              />
            </label>

            {filtrados.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
                No hay clientes. Crea uno nuevo para continuar.
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {filtrados.map((c) => {
                  const active = selected?.id === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(c)}
                        className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
                          active
                            ? "border-cyan-500/50 bg-cyan-950/30"
                            : "border-white/[0.06] bg-[#070f16] hover:border-slate-600"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white">
                            {c.nombre}
                          </span>
                          <span className="mt-0.5 block font-mono text-xs text-slate-400">
                            {c.documento}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            {c.tipoLabel}
                          </span>
                        </span>
                        {active ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-400" />
                        ) : (
                          <UserRound className="h-5 w-5 shrink-0 text-slate-600" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              disabled={!selected}
              onClick={() => selected && setStep("importacion")}
              className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(8,145,178,0.28)] transition hover:bg-cyan-500 disabled:opacity-50"
            >
              Continuar a la importación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
