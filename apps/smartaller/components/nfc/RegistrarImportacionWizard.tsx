"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import type { ImportadorListItem } from "@/app/actions/nfc/importadores";
import { ImportadorForm } from "@/components/nfc/ImportadorForm";
import { PlanillaAltaPuertoLibre } from "@/components/nfc/PlanillaAltaPuertoLibre";
import { PuertoLibreCargaMasiva } from "@/components/nfc/PuertoLibreCargaMasiva";
import type { MultiDocDetectedPayload } from "@/components/nfc/PuertoLibreDocScan";
import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
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

  function openMasivaDocumentos() {
    setMasivaRows(undefined);
    setMasivaMessage(null);
    setMasivaInitialDocs([]);
    setCertMergeRequest(null);
    setMasivaTabMode("documentos");
    setImportModo("masiva");
    setMasivaInstance((n) => n + 1);
  }

  function openMasivaPlantilla() {
    setMasivaRows(undefined);
    setMasivaMessage(null);
    setMasivaInitialDocs([]);
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
    const docs: MasivaDocSeed[] = [];
    const factura =
      payload.facturaFile ??
      (docTipo === "factura_comercial" ? file : undefined);
    if (factura) {
      docs.push({ file: factura, tipo: "factura_comercial" });
    }
    for (const cert of certFiles) {
      docs.push({ file: cert, tipo: "certificado_origen" });
    }

    if (docTipo === "certificado_origen" && masivaRows && masivaRows.length > 0) {
      setCertMergeRequest({ files: certFiles, requestId: Date.now() });
      setMasivaMessage(
        "Certificado detectado. Emparejando con las filas por VIN…"
      );
      setImportModo("masiva");
      return;
    }

    setMasivaInitialDocs(docs);
    setMasivaRows(rows.length > 0 ? rows : undefined);
    setMasivaMessage(message);
    setMasivaTabMode("documentos");
    setImportModo("masiva");
    setMasivaInstance((n) => n + 1);
    if (payload.mergeCerts && certFiles.length > 0) {
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
      <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">
          Cliente de la importación
        </p>
        <p className="mt-1 text-sm font-semibold text-zinc-50">{selected.nombre}</p>
        <p className="mt-0.5 font-mono text-xs text-zinc-400">
          {formatImportadorDocumentoLine(selected)}
          {" · "}
          {IMPORTADOR_TIPO_LABELS[selected.tipo]}
        </p>
        {selected.tipo === "juridica" && selected.registroPuertoLibre ? (
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Registro PL {selected.registroPuertoLibre}
            {selected.registroPlVence
              ? ` · vence ${selected.registroPlVence}`
              : ""}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setStep("cliente")}
          className="mt-2 text-xs text-cyan-400 hover:underline"
        >
          Cambiar cliente
        </button>
      </div>
    );

    if (importModo === "masiva") {
      return (
        <div className="space-y-4">
          {clienteBanner}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
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

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={openMasivaDocumentos}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:text-cyan-50"
          >
            <ClipboardList className="h-4 w-4" />
            Varios vehículos
          </button>
          <button
            type="button"
            onClick={openMasivaPlantilla}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel / CSV
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
          <PlanillaAltaPuertoLibre
            importadorId={selected.id}
            initialImportador={{
              importadorNombre: selected.nombre,
              importadorDocumento: selected.documento,
              importadorTelefono: selected.telefono ?? "",
              importadorEmail: selected.email ?? "",
              importadorDireccion: selected.direccion ?? "",
            }}
            lockImportador
            onMultiDetected={handleMultiDetected}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("buscar")}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            mode === "buscar"
              ? "bg-cyan-600 text-white"
              : "border border-zinc-700 text-zinc-300 hover:border-zinc-500"
          }`}
        >
          <Search className="h-4 w-4" />
          Buscar cliente
        </button>
        <button
          type="button"
          onClick={() => setMode("nuevo")}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            mode === "nuevo"
              ? "bg-cyan-600 text-white"
              : "border border-zinc-700 text-zinc-300 hover:border-zinc-500"
          }`}
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      {mode === "nuevo" ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-50">
            <UserRound className="h-5 w-5 text-cyan-400" />
            Registrar cliente
          </h2>
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
        <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
            <UserRound className="h-5 w-5 text-cyan-400" />
            Selecciona el cliente
          </h2>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, RIF o teléfono…"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-3 text-sm text-zinc-100 outline-none focus:border-cyan-500/60"
            />
          </label>

          {filtrados.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
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
                      className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-cyan-600/60 bg-cyan-950/30"
                          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-zinc-100">
                          {c.nombre}
                        </span>
                        <span className="mt-0.5 block font-mono text-xs text-zinc-400">
                          {c.documento}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-zinc-500">
                          {c.tipoLabel}
                        </span>
                      </span>
                      {active ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-400" />
                      ) : null}
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
            className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
          >
            Continuar a la importación
          </button>
        </div>
      )}
    </div>
  );
}
