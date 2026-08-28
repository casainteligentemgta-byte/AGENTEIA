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
  saveVehicleImportDraftAction,
} from "@/app/actions/nfc/vehicle-import-draft";
import { PlanillaAltaPuertoLibre } from "@/components/nfc/PlanillaAltaPuertoLibre";
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
  readVehicleImportDraft,
  writeVehicleImportDraft,
  type VehicleImportDraft,
} from "@/lib/importacion/vehicle-import-draft";
import {
  vehicleImportExtractedSchema,
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<CargaMasivaEtapaProgress | null>(null);
  const [foundCount, setFoundCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
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
        updatedAt: new Date().toISOString(),
        ...partial,
      };
      writeVehicleImportDraft(tallerId, draft);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveVehicleImportDraftAction(draft);
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
    ]
  );

  useEffect(() => {
    const local = readVehicleImportDraft(tallerId, importador.id);
    if (local?.rows.length) {
      setRows(local.rows);
      setExtractedFieldKeys(local.extractedFieldKeys);
      setStep(local.step === 1 && local.rows.length > 0 ? 2 : local.step);
      setCurrentIndex(
        Math.min(local.currentVehicleIndex, Math.max(local.rows.length - 1, 0))
      );
      setFoundCount(local.rows.length);
      return;
    }
    void loadVehicleImportDraftAction(importador.id).then((result) => {
      if (!result.ok || !result.draft?.rows.length) return;
      setRows(result.draft.rows);
      setExtractedFieldKeys(result.draft.extractedFieldKeys);
      setStep(result.draft.step === 1 ? 2 : result.draft.step);
      setCurrentIndex(result.draft.currentVehicleIndex);
      setFoundCount(result.draft.rows.length);
    });
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
      setError(result.error);
      if (result.rows.length > 0) {
        applyRows(result.rows);
      }
      return;
    }
    const extracted = vehicleImportExtractedSchema.safeParse({
      factura: parsed.data.factura,
      certificados: parsed.data.certificados,
      detectedVehicleCount: result.rows.length,
    });
    if (!extracted.success) {
      setError(extracted.error.errors[0]?.message ?? "Cantidad de vehículos inválida");
      return;
    }
    applyRows(result.rows);
    setFoundCount(result.rows.length);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setStep(2);
    setCurrentIndex(0);
  }

  function applyRows(next: CargaMasivaRow[]) {
    const keys: Record<string, string[]> = {};
    for (const row of next) {
      keys[row.id] = extractedKeysFromRow(row);
    }
    setRows(next);
    setExtractedFieldKeys(keys);
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
      const toSave = aptos.map((row) => ({
        ...row,
        importadorNombre: importador.nombre,
        importadorDocumento: importador.documento,
        importadorTelefono: importador.telefono ?? row.importadorTelefono,
        importadorEmail: importador.email ?? row.importadorEmail,
        importadorDireccion: importador.direccion ?? row.importadorDireccion,
      }));
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

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
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
          pending={saving}
          error={error}
          onBack={() => setStep(2)}
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
