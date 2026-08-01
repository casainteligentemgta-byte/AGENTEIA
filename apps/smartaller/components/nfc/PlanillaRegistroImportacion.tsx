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
import { AlertCircle, Camera, CheckCircle2, FileUp } from "lucide-react";
import {
  completePuertoLibreFase1aEmbarqueAction,
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
  PL_ADUANA_DOCUMENTO_TIPOS,
  PL_EMBARQUE_DOCUMENTO_TIPOS,
  type DocumentoTipo,
  type ImportacionData,
  type SeguroData,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import {
  PlanillaVehiculoSelector,
  type PlanillaVehiculoOption,
} from "@/components/nfc/PlanillaVehiculoSelector";
import { resolveCodigoExpediente } from "@/lib/puerto-libre/expediente";

export type PlanillaFaseUi = "1a" | 2 | 3;

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
  /** Fase forzada por query (?fase=1a|2|3). */
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
  if (forced === "1a" || forced === 2 || forced === 3) return forced;
  const f = importacion.planillaFase ?? 1;
  if (f >= 3) return 3;
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
  initialImportacion,
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

      <div className="flex w-full flex-nowrap items-stretch gap-1 sm:gap-1.5">
        <FaseChip
          n={1}
          label="Registro"
          completo={registroCompleto}
          current={false}
        />
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
          fechaLlegadaBuque={initialImportacion.fechaLlegadaBuque?.trim() ?? null}
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
    "inline-flex min-w-0 flex-1 items-center justify-center gap-0.5 whitespace-nowrap rounded-full px-1 py-1.5 text-[10px] font-medium transition sm:gap-1.5 sm:px-2.5 sm:text-xs";
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

function formatFechaReferencia(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
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
        <p className="mt-1 text-sm text-slate-500">
          Recaudos que viajan con la carga o se reciben antes de la llegada física.
          Foto o PDF · máx. 10 MB.
        </p>
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
  fechaLlegadaBuque,
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
  /** Solo la fecha de ingreso ya guardada; nunca se rellena con la del buque. */
  fechaIngresoInicial: string;
  fechaLlegadaBuque: string | null;
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
        <p className="mt-2 text-sm text-slate-500">
          Día en que el vehículo hace aduana o entra al régimen de Puerto Libre.
          Es distinta de la fecha de llegada del buque
          {fechaLlegadaBuque
            ? ` (${formatFechaReferencia(fechaLlegadaBuque)})`
            : ""}
          .
        </p>
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
        <p className="mt-1 text-sm text-slate-500">
          Tras el ingreso a Puerto Libre. Planilla CVA / DUA del SENIAT que demuestra
          el pago de tributos e IVA. Es recaudo para que aduana autorice el retiro de
          la mercancía.
        </p>
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
          onClick={onComplete}
          className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Finalizar planilla"}
        </button>
      </div>
    </div>
  );
}
