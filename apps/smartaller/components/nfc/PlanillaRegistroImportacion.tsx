"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Camera, CheckCircle2, FileUp } from "lucide-react";
import {
  completePuertoLibreFase3Action,
  savePuertoLibreFase2LlegadaAction,
} from "@/app/actions/nfc/puerto-libre-vehiculo";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";
import {
  OPCIONES_OK_DANO,
  PlanillaChecklistProgress,
  PlanillaChecklistRow,
} from "@/components/nfc/PlanillaChecklistTap";
import {
  LLEGADA_CHECKLIST_ITEMS,
  type LlegadaChecklistNotasState,
  type LlegadaChecklistRespuesta,
  type LlegadaChecklistState,
} from "@/lib/puerto-libre/llegada-catalog";
import {
  MEMORIA_FOTOGRAFICA_TIPOS,
  PL_REGISTRO_DOCUMENTO_TIPOS,
  type ImportacionData,
  type SeguroData,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import {
  PlanillaVehiculoSelector,
  type PlanillaVehiculoOption,
} from "@/components/nfc/PlanillaVehiculoSelector";
import { resolveCodigoExpediente } from "@/lib/puerto-libre/expediente";

type Props = {
  vehiculoId: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serialMotor: string | null;
  serialCarroceria: string | null;
  compradorNombre: string | null;
  compradorTelefono: string | null;
  compradorCedula: string | null;
  compradorEmail: string | null;
  initialImportacion: ImportacionData;
  initialSeguro: SeguroData;
  initialDocumentos: VehiculosDocumentos;
  /** Fase forzada por query (?fase=2|3). */
  faseInicial?: 2 | 3;
  vehiculoSelector?: {
    current: PlanillaVehiculoOption;
    vehiculos: PlanillaVehiculoOption[];
  };
};

function resolveFase(
  importacion: ImportacionData,
  forced?: 2 | 3
): 2 | 3 {
  if (forced === 2 || forced === 3) return forced;
  const f = importacion.planillaFase ?? 2;
  if (f >= 3) return 3;
  return 2;
}

export function PlanillaRegistroImportacion({
  vehiculoId,
  placa,
  marca,
  modelo,
  color,
  initialImportacion,
  initialDocumentos,
  faseInicial,
  vehiculoSelector,
}: Props) {
  const router = useRouter();
  const [fase, setFase] = useState<2 | 3>(() =>
    resolveFase(initialImportacion, faseInicial)
  );
  const [pending, startTransition] = useTransition();
  const [docs, setDocs] = useState(initialDocumentos);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<LlegadaChecklistState>(() => {
    const raw = initialImportacion.checklistLlegada ?? {};
    const next: LlegadaChecklistState = {};
    for (const item of LLEGADA_CHECKLIST_ITEMS) {
      const v = raw[item.id];
      if (v === "sin_dano" || v === "falla" || v === "na") next[item.id] = v;
    }
    return next;
  });
  const [checklistNotas, setChecklistNotas] = useState<LlegadaChecklistNotasState>(() => {
    const raw = initialImportacion.checklistLlegadaNotas ?? {};
    const next: LlegadaChecklistNotasState = {};
    for (const item of LLEGADA_CHECKLIST_ITEMS) {
      const v = raw[item.id];
      if (typeof v === "string" && v.trim()) next[item.id] = v;
    }
    return next;
  });
  const [otrosNotas, setOtrosNotas] = useState(
    initialImportacion.otrosDispositivosNotas ?? ""
  );

  const fotosCount = MEMORIA_FOTOGRAFICA_TIPOS.filter((t) => Boolean(docs[t])).length;
  const docsCount = PL_REGISTRO_DOCUMENTO_TIPOS.filter((t) => Boolean(docs[t])).length;
  const checklistMarked = useMemo(
    () => LLEGADA_CHECKLIST_ITEMS.filter((i) => Boolean(checklist[i.id])).length,
    [checklist]
  );

  const codigoExpediente =
    resolveCodigoExpediente({
      codigoExpediente: initialImportacion.codigoExpediente,
      placa,
    }) ?? placa;

  const selectorCurrent = vehiculoSelector?.current ?? {
    id: vehiculoId,
    placa,
    marca,
    modelo,
    color,
    codigoExpediente,
    fotoUrl: docs.foto_frontal?.url ?? docs.foto_placa?.url ?? null,
    created_at: "",
  };
  const selectorList = vehiculoSelector?.vehiculos ?? [selectorCurrent];

  return (
    <div className="space-y-6">
      <PlanillaVehiculoSelector current={selectorCurrent} vehiculos={selectorList} />

      <div className="flex flex-wrap gap-2">
        <FaseChip
          n={1}
          label="Registro"
          state="done"
          onClick={undefined}
        />
        <FaseChip
          n={2}
          label="Llegada"
          state={fase === 2 ? "current" : (initialImportacion.planillaFase ?? 2) >= 3 ? "done" : "idle"}
          onClick={() => setFase(2)}
        />
        <FaseChip
          n={3}
          label="Documentos"
          state={fase === 3 ? "current" : (initialImportacion.planillaFase ?? 2) >= 4 ? "done" : "idle"}
          onClick={() => setFase(3)}
        />
      </div>

      {(message || error) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-900/50 bg-red-950/30 text-red-200"
              : "border-emerald-900/40 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          {error ?? message}
        </div>
      )}

      {fase === 2 ? (
        <Fase2Llegada
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          fotosCount={fotosCount}
          fechaDefault={
            initialImportacion.fechaIngreso ?? new Date().toISOString().slice(0, 10)
          }
          checklist={checklist}
          setChecklist={setChecklist}
          checklistNotas={checklistNotas}
          setChecklistNotas={setChecklistNotas}
          checklistMarked={checklistMarked}
          otrosNotas={otrosNotas}
          setOtrosNotas={setOtrosNotas}
          pending={pending}
          onSave={(fechaIngreso) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await savePuertoLibreFase2LlegadaAction({
                vehiculoId,
                fechaIngreso,
                checklistLlegada: checklist,
                checklistLlegadaNotas: checklistNotas,
                otrosDispositivosNotas: otrosNotas || null,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Fase 2 guardada");
              setFase(3);
              router.replace(`/puerto-libre/${vehiculoId}/planilla?fase=3`);
              router.refresh();
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : (
        <Fase3Documentos
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          docsCount={docsCount}
          pending={pending}
          onComplete={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await completePuertoLibreFase3Action(vehiculoId);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Planilla completa");
              router.push(`/puerto-libre/${vehiculoId}`);
              router.refresh();
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function FaseChip({
  n,
  label,
  state,
  onClick,
}: {
  n: number;
  label: string;
  state: "done" | "current" | "idle";
  onClick?: () => void;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition";
  const styles =
    state === "current"
      ? "bg-cyan-600 text-white"
      : state === "done"
        ? "bg-emerald-950/50 text-emerald-300 ring-1 ring-emerald-800/60"
        : "bg-slate-900 text-slate-500 ring-1 ring-slate-800";
  const content = (
    <>
      {state === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{n}</span>}
      {label}
    </>
  );
  if (!onClick || state === "idle") {
    return <span className={`${base} ${styles}`}>{content}</span>;
  }
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {content}
    </button>
  );
}

function Fase2Llegada({
  vehiculoId,
  docs,
  setDocs,
  fotosCount,
  fechaDefault,
  checklist,
  setChecklist,
  checklistNotas,
  setChecklistNotas,
  checklistMarked,
  otrosNotas,
  setOtrosNotas,
  pending,
  onSave,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  fotosCount: number;
  fechaDefault: string;
  checklist: LlegadaChecklistState;
  setChecklist: Dispatch<SetStateAction<LlegadaChecklistState>>;
  checklistNotas: LlegadaChecklistNotasState;
  setChecklistNotas: Dispatch<SetStateAction<LlegadaChecklistNotasState>>;
  checklistMarked: number;
  otrosNotas: string;
  setOtrosNotas: (v: string) => void;
  pending: boolean;
  onSave: (fechaIngreso: string) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  const [fecha, setFecha] = useState(fechaDefault);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="text-lg font-semibold leading-snug text-slate-100">
          Fecha de ingreso al PL
        </h2>
        <div className="mt-4 min-w-0 w-full">
          <PlanillaFechaField
            label=""
            value={fecha}
            onChange={setFecha}
            required
            name="fechaIngreso"
            className="min-w-0 w-full"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-snug text-slate-100">
          <Camera className="h-5 w-5 shrink-0 text-cyan-400" />
          Memoria descriptiva fotográfica
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {fotosCount}/{MEMORIA_FOTOGRAFICA_TIPOS.length}
          </span>
        </h2>
        <div className="mt-5 grid gap-3">
          {MEMORIA_FOTOGRAFICA_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              hint=""
              actionLabel="Tomar / subir foto"
              onUploaded={(next) => {
                setDocs(next);
                onUploadedMessage("Foto guardada");
              }}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="text-lg font-semibold leading-snug text-slate-100">Revisión al llegar</h2>
        <p className="mt-2 text-sm text-slate-500">
          Marca OK o Daño. Si hay daño, describe qué viste en la nota.
        </p>
        <div className="mt-4">
          <PlanillaChecklistProgress
            marked={checklistMarked}
            total={LLEGADA_CHECKLIST_ITEMS.length}
            tone="dark"
          />
        </div>
        <ul className="mt-5 space-y-2.5">
          {LLEGADA_CHECKLIST_ITEMS.map((item) => (
            <PlanillaChecklistRow
              key={item.id}
              etiqueta={item.etiqueta}
              value={checklist[item.id]}
              opciones={OPCIONES_OK_DANO}
              tone="dark"
              nota={checklistNotas[item.id] ?? ""}
              onNotaChange={(texto) =>
                setChecklistNotas((prev) => ({
                  ...prev,
                  [item.id]: texto,
                }))
              }
              onChange={(v) => {
                setChecklist((prev) => ({
                  ...prev,
                  [item.id]: v as LlegadaChecklistRespuesta,
                }));
                if (v !== "falla") {
                  setChecklistNotas((prev) => {
                    if (!prev[item.id]) return prev;
                    const next = { ...prev };
                    delete next[item.id];
                    return next;
                  });
                }
              }}
            />
          ))}
        </ul>
        <label className="mt-5 block space-y-2.5">
          <span className="text-sm text-slate-400">Otros dispositivos / notas</span>
          <textarea
            rows={3}
            value={otrosNotas}
            onChange={(e) => setOtrosNotas(e.target.value)}
            placeholder="Ej. candado de volante, corte de combustible…"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
          />
        </label>
      </section>

      <button
        type="button"
        disabled={pending || !fecha}
        onClick={() => onSave(fecha)}
        className="w-full rounded-xl bg-cyan-600 px-5 py-3.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Guardando…" : "Guardar y abrir fase 3"}
      </button>
    </div>
  );
}

function Fase3Documentos({
  vehiculoId,
  docs,
  setDocs,
  docsCount,
  pending,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  docsCount: number;
  pending: boolean;
  onComplete: () => void;
  onUploadedMessage: (msg: string) => void;
}) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Documentos de importación
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {docsCount}/{PL_REGISTRO_DOCUMENTO_TIPOS.length}
          </span>
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Sube o escanea el manual, BL / guía de embarque, factura y documento de importación.
        </p>
        <div className="mt-4 grid gap-3">
          {PL_REGISTRO_DOCUMENTO_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              hint=""
              onUploaded={(next) => {
                setDocs(next);
                onUploadedMessage("Documento guardado");
              }}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-between">
        <Link
          href={`/puerto-libre/${vehiculoId}`}
          className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-500"
        >
          Ir a la ficha
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={onComplete}
          className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Finalizar planilla"}
        </button>
      </div>
    </div>
  );
}
