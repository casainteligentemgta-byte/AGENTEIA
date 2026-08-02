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
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileUp,
  Shield,
  User,
} from "lucide-react";
import {
  completePuertoLibreFase1aEmbarqueAction,
  completePuertoLibreFase3Action,
  completePuertoLibreFase4PropietarioAction,
  completePuertoLibreFase5SeguroAction,
  completePuertoLibreFase6MatriculacionAction,
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
  DOCUMENTO_LABELS,
  MEMORIA_FOTOGRAFICA_TIPOS,
  PL_ADUANA_DOCUMENTO_TIPOS,
  PL_EMBARQUE_DOCUMENTO_TIPOS,
  PL_MATRICULACION_CARPETA_TIPOS,
  PL_MATRICULACION_ORIGEN,
  SEGURO_DOCUMENTO_TIPOS,
  type DocumentoTipo,
  type ImportacionData,
  type SeguroData,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import {
  PlanillaVehiculoSelector,
  type PlanillaVehiculoOption,
} from "@/components/nfc/PlanillaVehiculoSelector";
import {
  placaRealVisible,
  resolveCodigoExpediente,
} from "@/lib/puerto-libre/expediente";

export type PlanillaFaseUi = "1a" | 2 | 3 | 4 | 5 | 6;

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
  /** Fase forzada por query (?fase=1a|2|3|4|5|6). */
  faseInicial?: PlanillaFaseUi;
  vehiculoSelector?: {
    current: PlanillaVehiculoOption;
    vehiculos: PlanillaVehiculoOption[];
  };
};

function resolveFase(
  importacion: ImportacionData,
  forced?: PlanillaFaseUi
): PlanillaFaseUi {
  if (
    forced === "1a" ||
    forced === 2 ||
    forced === 3 ||
    forced === 4 ||
    forced === 5 ||
    forced === 6
  ) {
    return forced;
  }
  const f = importacion.planillaFase ?? 1;
  if (f >= 6) return 6;
  if (f === 5) return 5;
  if (f === 4) return 4;
  if (f === 3) return 3;
  if (f === 2) return 2;
  return "1a";
}

function countDocs(docs: VehiculosDocumentos, tipos: DocumentoTipo[]) {
  return tipos.filter((t) => Boolean(docs[t])).length;
}

export function PlanillaRegistroImportacion({
  vehiculoId,
  placa,
  marca,
  modelo,
  color,
  serialMotor,
  serialCarroceria,
  compradorNombre,
  compradorTelefono,
  compradorCedula,
  compradorEmail,
  initialImportacion,
  initialSeguro,
  initialDocumentos,
  faseInicial,
  vehiculoSelector,
}: Props) {
  const router = useRouter();
  const [fase, setFase] = useState<PlanillaFaseUi>(() =>
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

  const fotosCount = countDocs(docs, MEMORIA_FOTOGRAFICA_TIPOS);
  const embarqueCount = countDocs(docs, PL_EMBARQUE_DOCUMENTO_TIPOS);
  const aduanaCount = countDocs(docs, PL_ADUANA_DOCUMENTO_TIPOS);
  const checklistMarked = useMemo(
    () => LLEGADA_CHECKLIST_ITEMS.filter((i) => Boolean(checklist[i.id])).length,
    [checklist]
  );

  const registroCompleto = Boolean(
    marca?.trim() &&
      modelo?.trim() &&
      color?.trim() &&
      initialImportacion.anio &&
      serialMotor?.trim() &&
      serialCarroceria?.trim() &&
      initialImportacion.fechaLlegadaBuque?.trim() &&
      initialImportacion.importadorNombre?.trim()
  );

  const embarqueCompleto = embarqueCount === PL_EMBARQUE_DOCUMENTO_TIPOS.length;

  const llegadaCompleta =
    Boolean(initialImportacion.fechaIngreso?.trim()) &&
    fotosCount === MEMORIA_FOTOGRAFICA_TIPOS.length &&
    checklistMarked === LLEGADA_CHECKLIST_ITEMS.length;

  const aduanaCompleta = aduanaCount === PL_ADUANA_DOCUMENTO_TIPOS.length;
  const propietarioCompleto = Boolean(compradorNombre?.trim());
  const seguroCompleto = Boolean(
    initialSeguro.aseguradora?.trim() && docs.rcv_seguro?.url
  );
  const matriculacionCount = countDocs(docs, PL_MATRICULACION_CARPETA_TIPOS);
  const placaVisible = placaRealVisible(
    placa,
    initialImportacion.codigoExpediente
  );
  const matriculacionCompleta =
    matriculacionCount === PL_MATRICULACION_CARPETA_TIPOS.length &&
    Boolean(placaVisible);

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

  function goFase(next: PlanillaFaseUi) {
    setFase(next);
    router.replace(`/puerto-libre/${vehiculoId}/planilla?fase=${next}`);
  }

  return (
    <div className="space-y-6">
      <PlanillaVehiculoSelector current={selectorCurrent} vehiculos={selectorList} />

      <div className="grid w-full grid-cols-4 gap-1 sm:grid-cols-7 sm:gap-1.5">
        <FaseChip n={1} label="Registro" completo={registroCompleto} current={false} />
        <FaseChip
          n="1A"
          label="Embarque"
          completo={embarqueCompleto}
          current={fase === "1a"}
          onClick={() => goFase("1a")}
        />
        <FaseChip
          n={2}
          label="Llegada"
          completo={llegadaCompleta}
          current={fase === 2}
          onClick={() => goFase(2)}
        />
        <FaseChip
          n={3}
          label="Aduana"
          completo={aduanaCompleta}
          current={fase === 3}
          onClick={() => goFase(3)}
        />
        <FaseChip
          n={4}
          label="Propietario"
          completo={propietarioCompleto}
          current={fase === 4}
          onClick={() => goFase(4)}
        />
        <FaseChip
          n={5}
          label="Seguro"
          completo={seguroCompleto}
          current={fase === 5}
          onClick={() => goFase(5)}
        />
        <FaseChip
          n={6}
          label="Matrícula"
          completo={matriculacionCompleta}
          current={fase === 6}
          onClick={() => goFase(6)}
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

      {fase === "1a" ? (
        <Fase1aEmbarque
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          docsCount={embarqueCount}
          pending={pending}
          canComplete={embarqueCompleto}
          onComplete={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await completePuertoLibreFase1aEmbarqueAction(vehiculoId);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Documentos de embarque guardados");
              setFase(2);
              router.replace(`/puerto-libre/${vehiculoId}/planilla?fase=2`);
              router.refresh();
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : fase === 2 ? (
        <Fase2Llegada
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          fotosCount={fotosCount}
          fechaIngresoInicial={initialImportacion.fechaIngreso?.trim() ?? ""}
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
      ) : fase === 3 ? (
        <Fase3Aduana
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          docsCount={aduanaCount}
          pending={pending}
          canComplete={aduanaCompleta}
          onComplete={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await completePuertoLibreFase3Action(vehiculoId);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Liquidación aduanera guardada");
              setFase(4);
              router.replace(`/puerto-libre/${vehiculoId}/planilla?fase=4`);
              router.refresh();
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : fase === 4 ? (
        <Fase4Propietario
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          compradorNombre={compradorNombre}
          compradorTelefono={compradorTelefono}
          compradorCedula={compradorCedula}
          compradorEmail={compradorEmail}
          compradorDireccion={initialImportacion.compradorDireccion ?? null}
          pending={pending}
          onComplete={(payload) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await completePuertoLibreFase4PropietarioAction({
                vehiculoId,
                ...payload,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Propietario guardado");
              setFase(5);
              router.replace(`/puerto-libre/${vehiculoId}/planilla?fase=5`);
              router.refresh();
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : fase === 5 ? (
        <Fase5Seguro
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          initialSeguro={initialSeguro}
          pending={pending}
          canComplete={Boolean(docs.rcv_seguro?.url)}
          onComplete={(payload) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await completePuertoLibreFase5SeguroAction({
                vehiculoId,
                ...payload,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Seguro guardado");
              setFase(6);
              router.replace(`/puerto-libre/${vehiculoId}/planilla?fase=6`);
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
        <Fase6Matriculacion
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          docsCount={matriculacionCount}
          placaInicial={placaVisible ?? ""}
          pending={pending}
          onComplete={(placaNueva) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await completePuertoLibreFase6MatriculacionAction({
                vehiculoId,
                placa: placaNueva,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Planilla completa · puedes nacionalizar");
              router.push(`/puerto-libre/${vehiculoId}/nacionalizar`);
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
  completo,
  current,
  onClick,
}: {
  n: number | string;
  label: string;
  completo: boolean;
  current?: boolean;
  onClick?: () => void;
}) {
  const base =
    "inline-flex min-w-0 w-full items-center justify-center gap-0.5 whitespace-nowrap rounded-full px-1 py-1.5 text-[10px] font-medium transition sm:gap-1 sm:px-2 sm:text-xs";
  const styles = completo
    ? `bg-emerald-600 text-white ${current ? "ring-2 ring-emerald-300/70 ring-offset-2 ring-offset-slate-950" : ""}`
    : `bg-red-600 text-white ${current ? "ring-2 ring-red-300/70 ring-offset-2 ring-offset-slate-950" : ""}`;
  const content = (
    <>
      {completo ? (
        <CheckCircle2 className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
      ) : (
        <AlertCircle className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
      )}
      <span className="opacity-80">{n}</span>
      <span className="truncate">{label}</span>
    </>
  );
  if (!onClick) {
    return <span className={`${base} ${styles}`}>{content}</span>;
  }
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {content}
    </button>
  );
}

function Fase1aEmbarque({
  vehiculoId,
  docs,
  setDocs,
  docsCount,
  pending,
  canComplete,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  docsCount: number;
  pending: boolean;
  canComplete: boolean;
  onComplete: () => void;
  onUploadedMessage: (msg: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Documentos de embarque
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {docsCount}/{PL_EMBARQUE_DOCUMENTO_TIPOS.length}
          </span>
        </h2>
        <div className="mt-4 grid gap-3">
          {PL_EMBARQUE_DOCUMENTO_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              acceptMode="both"
              hint="Foto o PDF · máx. 10 MB"
              onUploaded={(next) => {
                setDocs(next);
                onUploadedMessage("Documento guardado");
              }}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        disabled={pending || !canComplete}
        onClick={onComplete}
        className="w-full rounded-xl bg-cyan-600 px-5 py-3.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Guardando…" : "Guardar y abrir fase Llegada"}
      </button>
    </div>
  );
}

function Fase2Llegada({
  vehiculoId,
  docs,
  setDocs,
  fotosCount,
  fechaIngresoInicial,
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
  fechaIngresoInicial: string;
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
  const [fecha, setFecha] = useState(fechaIngresoInicial);

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
        {pending ? "Guardando…" : "Guardar y abrir fase Aduana"}
      </button>
    </div>
  );
}

function Fase3Aduana({
  vehiculoId,
  docs,
  setDocs,
  docsCount,
  pending,
  canComplete,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  docsCount: number;
  pending: boolean;
  canComplete: boolean;
  onComplete: () => void;
  onUploadedMessage: (msg: string) => void;
}) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Liquidación aduanera
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {docsCount}/{PL_ADUANA_DOCUMENTO_TIPOS.length}
          </span>
        </h2>
        <div className="mt-4 grid gap-3">
          {PL_ADUANA_DOCUMENTO_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              acceptMode="both"
              hint="Foto o PDF · máx. 10 MB"
              onUploaded={(next) => {
                setDocs(next);
                onUploadedMessage("Documento guardado");
              }}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        disabled={pending || !canComplete}
        onClick={onComplete}
        className="w-full rounded-xl bg-cyan-600 px-5 py-3.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Guardando…" : "Guardar y abrir fase Propietario"}
      </button>
    </div>
  );
}

function Fase4Propietario({
  vehiculoId,
  docs,
  setDocs,
  compradorNombre,
  compradorTelefono,
  compradorCedula,
  compradorEmail,
  compradorDireccion,
  pending,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  compradorNombre: string | null;
  compradorTelefono: string | null;
  compradorCedula: string | null;
  compradorEmail: string | null;
  compradorDireccion: string | null;
  pending: boolean;
  onComplete: (payload: {
    nombreCliente: string;
    telefonoCliente: string;
    cedulaPropietario: string;
    emailPropietario: string;
    direccion: string;
  }) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <User className="h-5 w-5 text-cyan-400" />
          Datos del comprador / propietario
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Persona a cuyo nombre quedará el vehículo. El nombre es obligatorio.
        </p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            onComplete({
              nombreCliente: String(fd.get("nombreCliente") ?? ""),
              telefonoCliente: String(fd.get("telefonoCliente") ?? ""),
              cedulaPropietario: String(fd.get("cedulaPropietario") ?? ""),
              emailPropietario: String(fd.get("emailPropietario") ?? ""),
              direccion: String(fd.get("direccion") ?? ""),
            });
          }}
        >
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Nombre *</span>
            <input
              name="nombreCliente"
              required
              defaultValue={compradorNombre ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Cédula</span>
            <input
              name="cedulaPropietario"
              defaultValue={compradorCedula ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">WhatsApp</span>
            <input
              name="telefonoCliente"
              defaultValue={compradorTelefono ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Dirección</span>
            <input
              name="direccion"
              defaultValue={compradorDireccion ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Email</span>
            <input
              name="emailPropietario"
              type="email"
              defaultValue={compradorEmail ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>

          <div className="grid gap-3 sm:col-span-2">
            <ImportDocumentoUpload
              vehiculoId={vehiculoId}
              tipo="cedula"
              existingUrl={docs.cedula?.url}
              hint=""
              actionLabel="Tomar / subir foto cédula"
              onUploaded={(next) => {
                setDocs(next);
                onUploadedMessage("Foto de cédula guardada");
              }}
            />
            <ImportDocumentoUpload
              vehiculoId={vehiculoId}
              tipo="foto_comprador"
              existingUrl={docs.foto_comprador?.url}
              hint=""
              actionLabel="Tomar / subir foto propietario"
              onUploaded={(next) => {
                setDocs(next);
                onUploadedMessage("Foto del propietario guardada");
              }}
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-cyan-600 px-5 py-3.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
            >
              {pending ? "Guardando…" : "Guardar y abrir fase Seguro"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Fase5Seguro({
  vehiculoId,
  docs,
  setDocs,
  initialSeguro,
  pending,
  canComplete,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  initialSeguro: SeguroData;
  pending: boolean;
  canComplete: boolean;
  onComplete: (payload: {
    aseguradora: string;
    numeroPoliza: string | null;
    tipoCobertura: string | null;
    vigenciaDesde: string | null;
    vigenciaHasta: string | null;
    montoAsegurado: number | null;
    telefonoAseguradora: string | null;
    corredor: string | null;
  }) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Shield className="h-5 w-5 text-cyan-400" />
          Seguro
        </h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            const montoRaw = String(fd.get("montoAsegurado") ?? "").trim();
            onComplete({
              aseguradora: String(fd.get("aseguradora") ?? ""),
              numeroPoliza: String(fd.get("numeroPoliza") ?? "") || null,
              tipoCobertura: String(fd.get("tipoCobertura") ?? "") || null,
              vigenciaDesde: String(fd.get("vigenciaDesde") ?? "") || null,
              vigenciaHasta: String(fd.get("vigenciaHasta") ?? "") || null,
              montoAsegurado: montoRaw ? Number(montoRaw) : null,
              telefonoAseguradora: String(fd.get("telefonoAseguradora") ?? "") || null,
              corredor: String(fd.get("corredor") ?? "") || null,
            });
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Aseguradora *</span>
            <input
              name="aseguradora"
              required
              defaultValue={initialSeguro.aseguradora ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Nro de póliza</span>
            <input
              name="numeroPoliza"
              defaultValue={initialSeguro.numeroPoliza ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Tipo de cobertura</span>
            <input
              name="tipoCobertura"
              defaultValue={initialSeguro.tipoCobertura ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Teléfono aseguradora</span>
            <input
              name="telefonoAseguradora"
              defaultValue={initialSeguro.telefonoAseguradora ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Vigencia desde</span>
            <input
              name="vigenciaDesde"
              type="date"
              defaultValue={initialSeguro.vigenciaDesde ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Vigencia hasta</span>
            <input
              name="vigenciaHasta"
              type="date"
              defaultValue={initialSeguro.vigenciaHasta ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Monto asegurado</span>
            <input
              name="montoAsegurado"
              type="number"
              defaultValue={
                initialSeguro.montoAsegurado != null
                  ? String(initialSeguro.montoAsegurado)
                  : ""
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Corredor / agente</span>
            <input
              name="corredor"
              defaultValue={initialSeguro.corredor ?? ""}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>

          <div className="sm:col-span-2">
            <h3 className="text-sm font-medium text-slate-300">Documentos del seguro</h3>
            <p className="mt-1 text-xs text-slate-500">
              La póliza RCV es obligatoria para avanzar.
            </p>
            <div className="mt-3 grid gap-3">
              {SEGURO_DOCUMENTO_TIPOS.map((tipo) => (
                <ImportDocumentoUpload
                  key={tipo}
                  vehiculoId={vehiculoId}
                  tipo={tipo}
                  existingUrl={docs[tipo]?.url}
                  hint={tipo === "rcv_seguro" ? "Obligatorio · foto o PDF" : ""}
                  onUploaded={(next) => {
                    setDocs(next);
                    onUploadedMessage("Documento de seguro guardado");
                  }}
                />
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending || !canComplete}
              className="w-full rounded-xl bg-cyan-600 px-5 py-3.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 sm:w-auto"
            >
              {pending ? "Guardando…" : "Guardar y abrir Matriculación"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Fase6Matriculacion({
  vehiculoId,
  docs,
  setDocs,
  docsCount,
  placaInicial,
  pending,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  docsCount: number;
  placaInicial: string;
  pending: boolean;
  onComplete: (placa: string) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  const [placa, setPlaca] = useState(placaInicial);
  const carpetaCompleta = docsCount === PL_MATRICULACION_CARPETA_TIPOS.length;
  const canComplete = carpetaCompleta && placa.trim().length > 0;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Matriculación inicial
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {docsCount}/{PL_MATRICULACION_CARPETA_TIPOS.length}
          </span>
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Carpeta a consignar. Al completar el trámite se obtiene el número de
          placa; regístralo abajo para cerrar la planilla.
        </p>

        <ul className="mt-5 space-y-3">
          {PL_MATRICULACION_CARPETA_TIPOS.map((tipo) => {
            const origen = PL_MATRICULACION_ORIGEN[tipo];
            const loaded = Boolean(docs[tipo]?.url);
            return (
              <li
                key={tipo}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100">
                      {DOCUMENTO_LABELS[tipo]}
                    </p>
                    {origen ? (
                      <p className="mt-0.5 text-xs text-slate-500">{origen}</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-500">
                        Cargar en PDF o foto / escaneo
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      loaded
                        ? "bg-emerald-950/60 text-emerald-300"
                        : "bg-red-950/50 text-red-300"
                    }`}
                  >
                    {loaded ? "Listo" : "Pendiente"}
                  </span>
                </div>
                {loaded && docs[tipo]?.url ? (
                  <a
                    href={docs[tipo]!.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-2 inline-flex text-xs text-cyan-400 hover:underline"
                  >
                    Ver documento
                  </a>
                ) : null}
                <ImportDocumentoUpload
                  vehiculoId={vehiculoId}
                  tipo={tipo}
                  existingUrl={docs[tipo]?.url}
                  acceptMode="both"
                  hint="Foto o PDF · máx. 10 MB"
                  actionLabel={loaded ? "Reemplazar" : "Cargar"}
                  onUploaded={(next) => {
                    setDocs(next);
                    onUploadedMessage("Documento guardado");
                  }}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Número de placa</h2>
        <p className="mt-1 text-sm text-slate-500">
          Resultado de la matriculación inicial. Distinto del número de expediente.
        </p>
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm text-slate-400">Placa *</span>
          <input
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            required
            placeholder="Ej. AB123CD"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm uppercase tracking-wide text-slate-100 outline-none focus:border-cyan-500/60"
          />
        </label>
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
          disabled={pending || !canComplete}
          onClick={() => onComplete(placa.trim())}
          className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Finalizar planilla"}
        </button>
      </div>
    </div>
  );
}
