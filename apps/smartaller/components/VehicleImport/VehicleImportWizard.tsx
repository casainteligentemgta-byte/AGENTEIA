"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ImportadorListItem } from "@/app/actions/nfc/importadores";
import { createPuertoLibreCargaMasivaAction } from "@/app/actions/nfc/importacion-carga-masiva";
import { uploadPuertoLibreDocumentoAction } from "@/app/actions/nfc/importacion-vehiculo";
import {
  clearVehicleImportDraftAction,
  loadVehicleImportDraftAction,
  saveVehicleImportDraft,
} from "@/app/actions/vehicle-import";
import { PlanillaAltaPuertoLibre } from "@/components/nfc/PlanillaAltaPuertoLibre";
import { VehicleImportDraftPrompt } from "@/components/VehicleImport/VehicleImportDraftPrompt";
import { VehicleImportStepIndicator } from "@/components/VehicleImport/StepIndicator";
import { Step1UploadDocuments } from "@/components/VehicleImport/Step1UploadDocuments";
import { Step2ReviewData } from "@/components/VehicleImport/Step2ReviewData";
import { Step3ConfirmSave } from "@/components/VehicleImport/Step3ConfirmSave";
import type { CargaMasivaEtapaProgress } from "@/lib/importacion/carga-masiva-etapas";
import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import {
  formatCargaMasivaClientError,
} from "@/lib/importacion/carga-masiva-client";
import { normalizeSerialKey, resumenSemaforo } from "@/lib/importacion/carga-masiva-ui";
import { runVehicleImportExtract } from "@/lib/importacion/vehicle-import-extract";
import {
  clearVehicleImportDraft,
  extractedKeysFromRow,
  pickNewerDraft,
  readVehicleImportDraft,
  writeVehicleImportDraft,
  type VehicleImportDraft,
} from "@/lib/importacion/vehicle-import-draft";
import type { VinDocSources } from "@/lib/importacion/vehicle-import-vin";
import {
  vehicleImportExtractedSchema,
  vehicleImportReviewSchema,
  vehicleImportUploadSchema,
} from "@/lib/validations/vehicle-import";

type Props = {
  importador: ImportadorListItem;
  tallerId: string;
};

export function VehicleImportWizard({ importador, tallerId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [manual, setManual] = useState(false);
  const [factura, setFactura] = useState<File | null>(null);
  const [certificados, setCertificados] = useState<File[]>([]);
  const [rows, setRows] = useState<CargaMasivaRow[]>([]);
  const [extractedFieldKeys, setExtractedFieldKeys] = useState<
    Record<string, string[]>
  >({});
  const [vinSources, setVinSources] = useState<
    Record<string, VinDocSources>
  >({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<CargaMasivaEtapaProgress | null>(null);
  const [foundCount, setFoundCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<VehicleImportDraft | null>(
    null
  );
  const [lookingDraft, setLookingDraft] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistDraft = useCallback(
    (partial?: Partial<VehicleImportDraft>) => {
      const draft: VehicleImportDraft = {
        importadorId: importador.id,
        step,
        currentVehicleIndex: currentIndex,
        facturaName: factura?.name ?? null,
        certificadoNames: certificados.map((file) => file.name),
        rows,
        extractedFieldKeys,
        vinSources,
        updatedAt: new Date().toISOString(),
        ...partial,
      };
      writeVehicleImportDraft(tallerId, draft);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveVehicleImportDraft(draft);
      }, 800);
    },
    [
      certificados,
      currentIndex,
      extractedFieldKeys,
      factura,
      importador.id,
      rows,
      step,
      tallerId,
      vinSources,
    ]
  );

  function applyDraft(draft: VehicleImportDraft) {
    setRows(draft.rows);
    setExtractedFieldKeys(draft.extractedFieldKeys);
    setVinSources(draft.vinSources ?? {});
    setStep(draft.step === 1 && draft.rows.length > 0 ? 2 : draft.step);
    setCurrentIndex(
      Math.min(draft.currentVehicleIndex, Math.max(draft.rows.length - 1, 0))
    );
    setFoundCount(draft.rows.length);
    setPendingDraft(null);
  }

  useEffect(() => {
    const local = readVehicleImportDraft(tallerId, importador.id);
    void loadVehicleImportDraftAction()
      .then((result) => {
        const remote = result.ok ? result.draft : null;
        const draft = pickNewerDraft(local, remote);
        if (!draft?.rows.length) return;
        setPendingDraft(draft);
      })
      .finally(() => setLookingDraft(false));
  }, [importador.id, tallerId]);

  useEffect(() => {
    if (rows.length === 0) return;
    persistDraft();
  }, [rows, step, currentIndex, extractedFieldKeys, persistDraft]);

  const createdHref = useMemo(() => "/smartimport", []);

  async function processDocuments() {
    const parsed = vehicleImportUploadSchema.safeParse({
      factura,
      certificados,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Revisa los archivos");
      return;
    }
    setError(null);
    setExtracting(true);
    setProgress(null);
    setFoundCount(null);
    const result = await runVehicleImportExtract({
      tallerId,
      factura: parsed.data.factura,
      certificados: parsed.data.certificados,
      onProgress: setProgress,
    });
    setExtracting(false);
    if (!result.ok) {
      setError(formatCargaMasivaClientError(result.error));
      if (result.rows.length > 0) {
        applyRows(result.rows, result.vinSources);
      }
      return;
    }
    const extracted = vehicleImportExtractedSchema.safeParse({
      detectedVehicleCount: result.rows.length,
      vehicles: result.rows,
    });
    if (!extracted.success) {
      setError(extracted.error.errors[0]?.message ?? "Cantidad de vehículos inválida");
      return;
    }
    applyRows(result.rows, result.vinSources);
    setFoundCount(result.rows.length);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setStep(2);
    setCurrentIndex(0);
  }

  function applyRows(
    next: CargaMasivaRow[],
    sources: Record<string, VinDocSources> = {}
  ) {
    const keys: Record<string, string[]> = {};
    for (const row of next) {
      keys[row.id] = extractedKeysFromRow(row);
    }
    setRows(next);
    setExtractedFieldKeys(keys);
    setVinSources(sources);
  }

  function handleFieldChange(
    rowId: string,
    field: keyof CargaMasivaRow,
    value: string
  ) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, [field]: value };
        if (field === "vin" && (!row.serialCarroceria || row.serialCarroceria === row.vin)) {
          next.serialCarroceria = value;
        }
        return next;
      })
    );
    setExtractedFieldKeys((prev) => {
      const current = new Set(prev[rowId] ?? []);
      current.delete(String(field));
      return { ...prev, [rowId]: Array.from(current) };
    });
  }

  async function saveAll() {
    setError(null);
    setSaving(true);
    try {
      const { aptos } = resumenSemaforo(rows);
      const toSave = aptos.flatMap((row) => {
        const reviewed = vehicleImportReviewSchema.safeParse({
          marca: row.marca,
          modelo: row.modelo,
          anio: row.anio,
          color: row.color,
          vin: row.vin || row.serialCarroceria,
          serialMotor: row.serialMotor,
          serialCarroceria: row.serialCarroceria,
        });
        if (!reviewed.success) return [];
        const vin = reviewed.data.vin;
        return [
          {
            ...row,
            marca: reviewed.data.marca || row.marca,
            modelo: reviewed.data.modelo || row.modelo,
            anio: reviewed.data.anio || row.anio,
            color: reviewed.data.color || row.color,
            vin,
            serialCarroceria: reviewed.data.serialCarroceria.trim() || vin,
            serialMotor: reviewed.data.serialMotor,
            importadorNombre: importador.nombre,
            importadorDocumento: importador.documento,
            importadorTelefono: importador.telefono ?? row.importadorTelefono,
            importadorEmail: importador.email ?? row.importadorEmail,
            importadorDireccion: importador.direccion ?? row.importadorDireccion,
          },
        ];
      });
      if (toSave.length === 0) {
        setError("Ningún vehículo tiene VIN válido de 17 caracteres");
        return;
      }
      const result = await createPuertoLibreCargaMasivaAction({
        importadorId: importador.id,
        rows: toSave,
        detectedImportadorDocumento: importador.documento,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }

      if (factura || certificados.length > 0) {
        for (const created of result.created) {
          if (factura) {
            const fd = new FormData();
            fd.set("vehiculoId", created.vehiculoId);
            fd.set("tipo", "factura_comercial");
            fd.set("file", factura);
            await uploadPuertoLibreDocumentoAction(fd);
          }
          const serial = normalizeSerialKey(created.serial);
          const cert =
            certificados.find((file) =>
              normalizeSerialKey(file.name).includes(serial.slice(-6))
            ) ??
            (certificados.length === 1 ? certificados[0] : null) ??
            (certificados.length === result.created.length
              ? certificados[result.created.indexOf(created)]
              : null);
          if (cert) {
            const fd = new FormData();
            fd.set("vehiculoId", created.vehiculoId);
            fd.set("tipo", "certificado_origen");
            fd.set("file", cert);
            await uploadPuertoLibreDocumentoAction(fd);
          }
        }
      }

      clearVehicleImportDraft(tallerId, importador.id);
      void clearVehicleImportDraftAction();
      const fail = result.failed.length;
      setDoneMsg(
        fail > 0
          ? `Creados ${result.created.length}. Fallaron ${fail}.`
          : `Se registraron ${result.created.length} expediente${result.created.length === 1 ? "" : "s"}.`
      );
      router.refresh();
    } catch (err) {
      setError(formatCargaMasivaClientError(err));
    } finally {
      setSaving(false);
    }
  }

  if (manual) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setManual(false)}
          className="text-sm text-cyan-400 hover:underline"
        >
          Volver al flujo por documentos
        </button>
        <PlanillaAltaPuertoLibre
          importadorId={importador.id}
          initialImportador={{
            importadorNombre: importador.nombre,
            importadorDocumento: importador.documento,
            importadorTelefono: importador.telefono ?? "",
            importadorEmail: importador.email ?? "",
            importadorDireccion: importador.direccion ?? "",
          }}
          lockImportador
        />
      </div>
    );
  }

  if (doneMsg) {
    return (
      <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 px-5 py-6">
        <p className="text-sm font-medium text-emerald-100">{doneMsg}</p>
        <Link
          href={createdHref}
          className="mt-4 inline-flex rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Ir al panel
        </Link>
      </div>
    );
  }

  if (lookingDraft) {
    return (
      <p className="text-sm text-zinc-500">Buscando borrador guardado…</p>
    );
  }

  if (pendingDraft) {
    return (
      <VehicleImportDraftPrompt
        vehicleCount={pendingDraft.rows.length}
        step={pendingDraft.step}
        updatedAt={pendingDraft.updatedAt}
        onContinue={() => applyDraft(pendingDraft)}
        onStartNew={() => {
          clearVehicleImportDraft(tallerId, importador.id);
          void clearVehicleImportDraftAction();
          setPendingDraft(null);
          setRows([]);
          setExtractedFieldKeys({});
          setVinSources({});
          setStep(1);
          setCurrentIndex(0);
          setFoundCount(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-white/[0.06] bg-[#08141c] p-5 sm:p-6">
      <VehicleImportStepIndicator
        step={step}
        vehicleIndex={currentIndex}
        vehicleTotal={rows.length}
      />

      {step === 1 ? (
        <Step1UploadDocuments
          factura={factura}
          certificados={certificados}
          extracting={extracting}
          progress={progress}
          foundCount={foundCount}
          error={error}
          onFactura={setFactura}
          onCertificados={setCertificados}
          onProcess={() => void processDocuments()}
          onManual={() => setManual(true)}
        />
      ) : null}

      {step === 2 ? (
        <Step2ReviewData
          rows={rows}
          currentIndex={currentIndex}
          extractedFieldKeys={extractedFieldKeys}
          vinSources={vinSources}
          onIndexChange={setCurrentIndex}
          onChange={handleFieldChange}
          onNext={() => {
            setError(null);
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      ) : null}

      {step === 3 ? (
        <Step3ConfirmSave
          rows={rows}
          facturaName={factura?.name ?? null}
          certificadoCount={certificados.length}
          vinSources={vinSources}
          pending={saving}
          error={error}
          onBack={() => setStep(2)}
          onSelectVehicle={(index) => {
            setCurrentIndex(index);
            setStep(2);
          }}
          onSave={() => void saveAll()}
        />
      ) : null}

      <p className="text-center text-xs text-zinc-600">
        Atajo Excel/CSV:{" "}
        <Link href="/smartimport/importaciones/nueva?masiva=1" className="text-cyan-500 hover:underline">
          carga masiva clásica
        </Link>
      </p>
    </div>
  );
}
