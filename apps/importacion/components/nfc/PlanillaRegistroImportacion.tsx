"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  AlertCircle,
  BookOpen,
  Camera,
  CheckCircle2,
  FileUp,
  Ship,
  Shield,
  User,
} from "lucide-react";
import Link from "next/link";
import {
  completePuertoLibreFase2EmbarqueAction,
  completePuertoLibreFase3Action,
  completePuertoLibreFase4PropietarioAction,
  completePuertoLibreFase5SeguroAction,
  savePuertoLibreCarpetaMatriculacionAction,
  savePuertoLibreFase1RegistroAction,
  savePuertoLibreFase2LlegadaAction,
  syncCertificadoOrigenNumeroAction,
} from "@/app/actions/nfc/importacion-vehiculo";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { PropietarioCedulaScan } from "@/components/nfc/PropietarioCedulaScan";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";
import {
  OPCIONES_OK_DANO,
  PlanillaChecklistProgress,
  PlanillaChecklistRow,
} from "@/components/nfc/PlanillaChecklistTap";
import {
  isLlegadaChecklistCompleto,
  LLEGADA_CHECKLIST_ITEMS,
  type LlegadaChecklistNotasState,
  type LlegadaChecklistRespuesta,
  type LlegadaChecklistState,
} from "@/lib/importacion/llegada-catalog";
import { PuertoLibreDescargarDesaduanamientoPdf } from "@/components/nfc/PuertoLibreDescargarDesaduanamientoPdf";
import { PuertoLibreDescargarMatriculacionPdf } from "@/components/nfc/PuertoLibreDescargarMatriculacionPdf";
import { clasificarTipoImportadorPorRif } from "@/lib/importacion/cumplimiento-importador";
import {
  docsDesaduanamientoPorRegimen,
  getRegimenConfig,
  origenDocDesaduanamiento,
  type RegimenImportacion,
} from "@/lib/importacion/regimenes";
import {
  ADUANAS_VENEZUELA,
  resolveAduanaVenezuela,
} from "@/lib/importacion/aduanas-venezuela";
import { PAISES, resolvePais } from "@/lib/importacion/paises";
import {
  DOCUMENTO_LABELS,
  MEMORIA_FOTOGRAFICA_TIPOS,
  MODALIDAD_TRANSITO_LABELS,
  MODALIDADES_TRANSITO,
  PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
  PL_DESADUANAMIENTO_ORIGEN,
  PL_EMBARQUE_DOCUMENTO_TIPOS,
  PL_PASE_SALIDA_TIPO,
  PL_FASE1_REGISTRO_DOCUMENTO_TIPOS,
  PL_LLEGADA_DOCUMENTO_TIPOS,
  PL_MATRICULACION_CARGAR_TIPOS,
  PL_MATRICULACION_LIQUIDACION_EXENCION_TIPOS,
  PL_MATRICULACION_ORIGEN,
  PL_MATRICULACION_REFERENCIA_TIPOS,
  countMatriculacionCarpeta,
  tieneLiquidacionOExencion,
  SEGURO_DOCUMENTO_TIPOS,
  type DocumentoTipo,
  type ImportacionData,
  type ModalidadTransito,
  type SeguroData,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import {
  PlanillaVehiculoSelector,
  type PlanillaVehiculoOption,
} from "@/components/nfc/PlanillaVehiculoSelector";
import {
  PuertoLibreFase1Form,
  type PuertoLibreFase1FormValues,
} from "@/components/nfc/PuertoLibreFase1Form";
import {
  placaRealVisible,
  resolveCodigoExpediente,
} from "@/lib/importacion/expediente";

/** UI chips 1–7. En BD planillaFase 8 = completa. */
export type PlanillaFaseUi = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Tras guardar una fase: seguir en planilla o volver a la ficha. */
type PlanillaAfterSave = "next" | "ficha";

type Props = {
  vehiculoId: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serialMotor: string | null;
  serialCarroceria: string | null;
  kilometrajeUltimo: number | null;
  compradorNombre: string | null;
  compradorTelefono: string | null;
  compradorCedula: string | null;
  compradorEmail: string | null;
  compradorFechaNacimiento: string | null;
  initialImportacion: ImportacionData;
  initialSeguro: SeguroData;
  initialDocumentos: VehiculosDocumentos;
  /** Fase forzada por query (?fase=1|2|3|4|5|6|7). */
  faseInicial?: PlanillaFaseUi;
  /**
   * Operador (admin/taller/concesionario) puede forzar avance si OCR no lee la impronta.
   * Calculado en servidor con `canForzarImprontaSinVerificar` / `canMutateImportacionData`.
   */
  canForzarImpronta?: boolean;
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
    forced === 1 ||
    forced === 2 ||
    forced === 3 ||
    forced === 4 ||
    forced === 5 ||
    forced === 6 ||
    forced === 7
  ) {
    return forced;
  }
  const f = importacion.planillaFase ?? 1;
  if (f >= 7) return 7;
  if (f === 6) return 6;
  if (f === 5) return 5;
  if (f === 4) return 4;
  if (f === 3) return 3;
  if (f === 2) return 2;
  if (f === 1) return 1;
  return 1;
}

function countDocs(docs: VehiculosDocumentos, tipos: DocumentoTipo[]) {
  return tipos.filter((t) => Boolean(docs[t]?.url)).length;
}

export function PlanillaRegistroImportacion({
  vehiculoId,
  placa,
  marca,
  modelo,
  color,
  serialMotor,
  serialCarroceria,
  kilometrajeUltimo,
  compradorNombre,
  compradorTelefono,
  compradorCedula,
  compradorEmail,
  compradorFechaNacimiento,
  initialImportacion,
  initialSeguro,
  initialDocumentos,
  faseInicial,
  canForzarImpronta = false,
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

  useEffect(() => {
    if (!error) return;
    document.getElementById("planilla-flash")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [error]);
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

  const regimenCfg = getRegimenConfig(initialImportacion.regimen);
  const esImportadorJuridico =
    clasificarTipoImportadorPorRif(initialImportacion.importadorDocumento) ===
    "juridica";
  const desaduanamientoTipos = useMemo(
    () =>
      docsDesaduanamientoPorRegimen(
        initialImportacion.regimen,
        PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
        { esJuridica: esImportadorJuridico }
      ),
    [initialImportacion.regimen, esImportadorJuridico]
  );
  const fotosCount = countDocs(docs, MEMORIA_FOTOGRAFICA_TIPOS);
  const registroDocsCount = countDocs(docs, PL_FASE1_REGISTRO_DOCUMENTO_TIPOS);
  const embarqueCount = countDocs(docs, PL_EMBARQUE_DOCUMENTO_TIPOS);
  const aduanaCount = countDocs(docs, desaduanamientoTipos);
  const checklistMarked = useMemo(
    () => LLEGADA_CHECKLIST_ITEMS.filter((i) => Boolean(checklist[i.id])).length,
    [checklist]
  );

  const registroCompleto =
    Boolean(
      marca?.trim() &&
        modelo?.trim() &&
        color?.trim() &&
        initialImportacion.anio &&
        serialMotor?.trim() &&
        initialImportacion.vin?.trim() &&
        serialCarroceria?.trim() &&
        kilometrajeUltimo != null &&
        (initialImportacion.condicionVehiculo !== "usado" ||
          kilometrajeUltimo > 0) &&
        initialImportacion.condicionVehiculo &&
        (initialImportacion.condicionVehiculo === "nuevo" ||
          typeof initialImportacion.esSubasta === "boolean") &&
        initialImportacion.importadorNombre?.trim()
    ) && registroDocsCount === PL_FASE1_REGISTRO_DOCUMENTO_TIPOS.length;

  const embarqueCompleto = embarqueCount === PL_EMBARQUE_DOCUMENTO_TIPOS.length;

  const llegadaDocsCount = countDocs(docs, PL_LLEGADA_DOCUMENTO_TIPOS);
  const llegadaCompleta =
    Boolean(initialImportacion.fechaIngreso?.trim()) &&
    Boolean(initialImportacion.partidaArancelaria?.trim()) &&
    llegadaDocsCount === PL_LLEGADA_DOCUMENTO_TIPOS.length &&
    fotosCount === MEMORIA_FOTOGRAFICA_TIPOS.length &&
    isLlegadaChecklistCompleto(checklist);

  const aduanaCompleta = aduanaCount === desaduanamientoTipos.length;
  const propietarioCompleto = Boolean(compradorNombre?.trim());
  const seguroCompleto = Boolean(
    initialSeguro.aseguradora?.trim() ||
      (initialImportacion.planillaFase != null &&
        initialImportacion.planillaFase >= 7)
  );
  const matriculacionStats = countMatriculacionCarpeta(
    docs,
    initialImportacion.requiereHomologacion === true
  );
  const placaVisible = placaRealVisible(
    placa,
    initialImportacion.codigoExpediente
  );
  const matriculacionCompleta =
    matriculacionStats.listos === matriculacionStats.total;

  const codigoExpediente =
    resolveCodigoExpediente({
      codigoExpediente: initialImportacion.codigoExpediente,
      placa,
    }) ?? placa;

  const selectorCurrent = vehiculoSelector?.current ?? {
    id: vehiculoId,
    placa,
    vin: initialImportacion.vin?.trim() || serialCarroceria,
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
    router.replace(`/smartimport/${vehiculoId}/planilla?fase=${String(next)}`);
  }

  function navigateAfterSave(after: PlanillaAfterSave, nextFase: PlanillaFaseUi) {
    if (after === "ficha") {
      router.push(`/smartimport/${vehiculoId}`);
      router.refresh();
      return;
    }
    setFase(nextFase);
    router.replace(`/smartimport/${vehiculoId}/planilla?fase=${nextFase}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PlanillaVehiculoSelector current={selectorCurrent} vehiculos={selectorList} />

      <div className="flex justify-end">
        <Link
          href="/smartimport/instructivo"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-cyan-300"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Cómo llenar la planilla
        </Link>
      </div>

      <div className="grid w-full grid-cols-4 gap-1 sm:grid-cols-7 sm:gap-1.5">
        <FaseChip
          n={1}
          label="Registro"
          completo={registroCompleto}
          current={fase === 1}
          onClick={() => goFase(1)}
        />
        <FaseChip
          n={2}
          label="Embarque"
          completo={embarqueCompleto}
          current={fase === 2}
          onClick={() => goFase(2)}
        />
        <FaseChip
          n={3}
          label="Llegada"
          completo={llegadaCompleta}
          current={fase === 3}
          onClick={() => goFase(3)}
        />
        <FaseChip
          n={4}
          label="Desaduana"
          completo={aduanaCompleta}
          current={fase === 4}
          onClick={() => goFase(4)}
        />
        <FaseChip
          n={5}
          label="Propietario"
          completo={propietarioCompleto}
          current={fase === 5}
          onClick={() => goFase(5)}
        />
        <FaseChip
          n={6}
          label="Seguro"
          completo={seguroCompleto}
          current={fase === 6}
          onClick={() => goFase(6)}
        />
        <FaseChip
          n={7}
          label="Matrícula"
          completo={matriculacionCompleta}
          current={fase === 7}
          onClick={() => goFase(7)}
        />
      </div>

      {(message || error) && (
        <div
          id="planilla-flash"
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-900/50 bg-red-950/30 text-red-200"
              : "border-emerald-900/40 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          {error ?? message}
        </div>
      )}

      {fase === 1 ? (
        <Fase1Registro
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          pending={pending}
          initial={{
            marca: marca ?? "",
            modelo: modelo ?? "",
            color: color ?? "",
            anio: initialImportacion.anio ?? undefined,
            serialMotor: serialMotor ?? "",
            vin: initialImportacion.vin ?? serialCarroceria ?? "",
            serialCarroceria: serialCarroceria ?? "",
            kilometraje: kilometrajeUltimo,
            condicion: initialImportacion.condicionVehiculo ?? "",
            esSubasta:
              initialImportacion.esSubasta === true
                ? "true"
                : initialImportacion.esSubasta === false
                  ? "false"
                  : "",
            partidaArancelaria: initialImportacion.partidaArancelaria ?? "",
            cilindradaCc:
              initialImportacion.cilindradaCc != null
                ? String(initialImportacion.cilindradaCc)
                : "",
            tipoCombustible: initialImportacion.tipoCombustible ?? "",
            fechaLlegadaBuque: initialImportacion.fechaLlegadaBuque ?? "",
            regimen: (initialImportacion.regimen as
              | "ordinario"
              | "equipaje"
              | "puerto_libre"
              | "diplomatico"
              | "temporal"
              | undefined) ?? "puerto_libre",
            importadorId: initialImportacion.importadorId ?? null,
            importadorNombre: initialImportacion.importadorNombre ?? "",
            importadorDocumento: initialImportacion.importadorDocumento ?? "",
            importadorTelefono: initialImportacion.importadorTelefono ?? "",
            importadorEmail: initialImportacion.importadorEmail ?? "",
            importadorDireccion: initialImportacion.importadorDireccion ?? "",
            aduana: initialImportacion.aduana ?? "",
            puerto: initialImportacion.puerto ?? "",
            modalidadTransito: initialImportacion.modalidadTransito ?? "ninguno",
            aduanaTransito: initialImportacion.aduanaTransito ?? "",
            numeroBl: initialImportacion.numeroBl ?? "",
            paisOrigen: initialImportacion.paisOrigen ?? "",
            valorCif:
              initialImportacion.valorCif != null
                ? String(initialImportacion.valorCif)
                : "",
            tasaCambioBcv:
              initialImportacion.tasaCambioBcv != null
                ? String(initialImportacion.tasaCambioBcv)
                : "",
            numeroExpedienteSeniat:
              initialImportacion.numeroExpedienteSeniat ?? "",
            numeroDav: initialImportacion.numeroDav ?? "",
            numeroCertificadoOrigen:
              initialImportacion.numeroCertificadoOrigen ?? "",
            numeroListaEmpaque: initialImportacion.numeroListaEmpaque ?? "",
            numeroPolizaTransporte:
              initialImportacion.numeroPolizaTransporte ?? "",
            observaciones: initialImportacion.observaciones ?? "",
          }}
          onSave={(payload, after) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await savePuertoLibreFase1RegistroAction({
                vehiculoId,
                ...payload,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Registro guardado");
              navigateAfterSave(after, 2);
            });
          }}
        />
      ) : fase === 2 ? (
        <Fase2Embarque
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          docsCount={embarqueCount}
          pending={pending}
          canCompleteDocs={embarqueCompleto}
          initial={{
            fechaLlegadaBuque: initialImportacion.fechaLlegadaBuque?.trim() ?? "",
            puerto: initialImportacion.puerto?.trim() ?? "",
            modalidadTransito:
              (initialImportacion.modalidadTransito as ModalidadTransito | null) ??
              "ninguno",
            aduanaTransito:
              resolveAduanaVenezuela(initialImportacion.aduanaTransito) ||
              initialImportacion.aduanaTransito?.trim() ||
              "",
            aduana:
              resolveAduanaVenezuela(initialImportacion.aduana) ||
              initialImportacion.aduana?.trim() ||
              "",
            numeroBl: initialImportacion.numeroBl?.trim() ?? "",
            paisOrigen:
              resolvePais(initialImportacion.paisOrigen) ||
              initialImportacion.paisOrigen?.trim() ||
              "",
            regimen:
              (initialImportacion.regimen as RegimenImportacion | null) ??
              "puerto_libre",
            numeroCertificadoOrigen:
              initialImportacion.numeroCertificadoOrigen?.trim() ?? "",
            observaciones: initialImportacion.observaciones?.trim() ?? "",
          }}
          onComplete={(datos, after) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await completePuertoLibreFase2EmbarqueAction({
                vehiculoId,
                ...datos,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Embarque guardado");
              navigateAfterSave(after, 3);
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : fase === 3 ? (
        <Fase2Llegada
          vehiculoId={vehiculoId}
          serialCarroceria={serialCarroceria}
          docs={docs}
          setDocs={setDocs}
          fotosCount={fotosCount}
          fechaIngresoInicial={initialImportacion.fechaIngreso?.trim() ?? ""}
          partidaArancelariaInicial={
            initialImportacion.partidaArancelaria?.trim() ?? ""
          }
          initialImprontaEstado={initialImportacion.serialImprontaEstado ?? null}
          initialImprontaLeido={initialImportacion.serialImprontaLeido ?? null}
          checklist={checklist}
          setChecklist={setChecklist}
          checklistNotas={checklistNotas}
          setChecklistNotas={setChecklistNotas}
          checklistMarked={checklistMarked}
          otrosNotas={otrosNotas}
          setOtrosNotas={setOtrosNotas}
          pending={pending}
          canForzarImpronta={canForzarImpronta}
          onSave={(fechaIngreso, partidaArancelaria, after, forzarImprontaSinVerificar) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await savePuertoLibreFase2LlegadaAction({
                vehiculoId,
                fechaIngreso,
                partidaArancelaria,
                checklistLlegada: checklist,
                checklistLlegadaNotas: checklistNotas,
                otrosDispositivosNotas: otrosNotas || null,
                forzarImprontaSinVerificar:
                  canForzarImpronta && forzarImprontaSinVerificar,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Llegada guardada");
              navigateAfterSave(after, 4);
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : fase === 4 ? (
        <Fase3Aduana
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          docsCount={aduanaCount}
          docTipos={desaduanamientoTipos}
          regimenLabel={regimenCfg.label}
          regimen={initialImportacion.regimen}
          importadorNombre={initialImportacion.importadorNombre ?? ""}
          importadorDocumento={initialImportacion.importadorDocumento ?? ""}
          pending={pending}
          canComplete={aduanaCompleta}
          agenteAduanalInicial={initialImportacion.agenteAduanal ?? ""}
          onComplete={(agenteAduanal, after) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              try {
                const result = await completePuertoLibreFase3Action({
                  vehiculoId,
                  agenteAduanal,
                });
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setMessage("Desaduanamiento guardado");
                navigateAfterSave(after, 5);
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "No se pudo guardar el desaduanamiento"
                );
              }
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : fase === 5 ? (
        <Fase4Propietario
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          compradorNombre={compradorNombre}
          compradorTelefono={compradorTelefono}
          compradorCedula={compradorCedula}
          compradorEmail={compradorEmail}
          compradorFechaNacimiento={compradorFechaNacimiento}
          compradorDireccion={initialImportacion.compradorDireccion ?? null}
          pending={pending}
          onComplete={(payload, after) => {
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
              navigateAfterSave(after, 6);
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : fase === 6 ? (
        <Fase5Seguro
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          initialSeguro={initialSeguro}
          pending={pending}
          onComplete={(payload, after) => {
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
              navigateAfterSave(after, 7);
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
          requiereHomologacionInicial={
            initialImportacion.requiereHomologacion === true
          }
          pending={pending}
          onComplete={(requiereHomologacion, after) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await savePuertoLibreCarpetaMatriculacionAction({
                vehiculoId,
                requiereHomologacion,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Matriculación completa · puedes nacionalizar");
              if (after === "ficha") {
                router.push(`/smartimport/${vehiculoId}`);
              } else {
                router.push(`/smartimport/${vehiculoId}/nacionalizar`);
              }
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

function PlanillaFaseActions({
  pending,
  disabled,
  continueLabel,
  onAction,
  asFormSubmit = false,
  blockedReason,
}: {
  pending: boolean;
  disabled?: boolean;
  continueLabel: string;
  onAction?: (after: PlanillaAfterSave) => void;
  /** Botones submit con name=after (next|ficha) para formularios. */
  asFormSubmit?: boolean;
  blockedReason?: string | null;
}) {
  const isDisabled = pending || Boolean(disabled);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {blockedReason && !pending ? (
        <p className="w-full rounded-xl border border-amber-900/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          {blockedReason}
        </p>
      ) : null}
      <button
        type={asFormSubmit ? "submit" : "button"}
        name={asFormSubmit ? "after" : undefined}
        value={asFormSubmit ? "next" : undefined}
        disabled={isDisabled}
        onClick={asFormSubmit ? undefined : () => onAction?.("next")}
        className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-5 py-3.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando…" : continueLabel}
      </button>
      <button
        type={asFormSubmit ? "submit" : "button"}
        name={asFormSubmit ? "after" : undefined}
        value={asFormSubmit ? "ficha" : undefined}
        disabled={isDisabled}
        onClick={asFormSubmit ? undefined : () => onAction?.("ficha")}
        className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-5 py-3.5 text-sm font-medium text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar e ir a la ficha"}
      </button>
    </div>
  );
}

function afterFromFormData(fd: FormData): PlanillaAfterSave {
  return String(fd.get("after") ?? "") === "ficha" ? "ficha" : "next";
}

type Fase1RegistroPayload = {
  marca: string;
  modelo: string;
  color: string;
  anio: number;
  serialMotor: string;
  vin: string;
  serialCarroceria: string;
  kilometraje: number;
  condicion: "nuevo" | "usado";
  esSubasta: boolean | null;
  partidaArancelaria: string;
  cilindradaCc: string;
  tipoCombustible: string;
  fechaLlegadaBuque: string;
  regimen: string;
  importadorId?: string;
  importadorNombre: string;
  importadorDocumento: string;
  importadorTelefono: string;
  importadorEmail: string;
  importadorDireccion: string;
  aduana: string;
  puerto: string;
  modalidadTransito: "ninguno" | "transito" | "uso24" | "" | null;
  aduanaTransito: string;
  numeroBl: string;
  paisOrigen: string;
  valorCif: string;
  tasaCambioBcv: string;
  numeroExpedienteSeniat: string;
  numeroDav: string;
  numeroCertificadoOrigen: string;
  numeroListaEmpaque: string;
  numeroPolizaTransporte: string;
  observaciones: string;
};

function Fase1Registro({
  vehiculoId,
  docs,
  setDocs,
  pending,
  initial,
  onSave,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  pending: boolean;
  initial: {
    marca: string;
    modelo: string;
    color: string;
    anio?: number | null;
    serialMotor: string;
    vin: string;
    serialCarroceria: string;
    kilometraje: number | null;
    condicion: string;
    esSubasta: string;
    partidaArancelaria: string;
    cilindradaCc: string;
    tipoCombustible: string;
    fechaLlegadaBuque: string;
    regimen: string;
    importadorId?: string | null;
    importadorNombre: string;
    importadorDocumento: string;
    importadorTelefono: string;
    importadorEmail: string;
    importadorDireccion: string;
    aduana: string;
    puerto: string;
    modalidadTransito: "ninguno" | "transito" | "uso24" | "";
    aduanaTransito: string;
    numeroBl: string;
    paisOrigen: string;
    valorCif: string;
    tasaCambioBcv: string;
    numeroExpedienteSeniat: string;
    numeroDav: string;
    numeroCertificadoOrigen: string;
    numeroListaEmpaque: string;
    numeroPolizaTransporte: string;
    observaciones: string;
  };
  onSave: (payload: Fase1RegistroPayload, after: PlanillaAfterSave) => void;
}) {
  const formInitial: Partial<PuertoLibreFase1FormValues> = {
    marca: initial.marca,
    modelo: initial.modelo,
    color: initial.color,
    anio: initial.anio != null ? String(initial.anio) : "",
    serialMotor: initial.serialMotor,
    vin: initial.vin,
    serialCarroceria: initial.serialCarroceria,
    kilometraje:
      initial.kilometraje != null ? String(initial.kilometraje) : "",
    condicion:
      initial.condicion === "nuevo" || initial.condicion === "usado"
        ? initial.condicion
        : "",
    esSubasta:
      initial.esSubasta === "true" || initial.esSubasta === "false"
        ? initial.esSubasta
        : "",
    partidaArancelaria: initial.partidaArancelaria,
    cilindradaCc: initial.cilindradaCc,
    tipoCombustible:
      initial.tipoCombustible === "gasolina" ||
      initial.tipoCombustible === "diesel" ||
      initial.tipoCombustible === "electrico" ||
      initial.tipoCombustible === "hibrido" ||
      initial.tipoCombustible === "gnv" ||
      initial.tipoCombustible === "otro"
        ? initial.tipoCombustible
        : "",
    fechaLlegadaBuque: initial.fechaLlegadaBuque,
    regimen: (initial.regimen as
      | "ordinario"
      | "equipaje"
      | "puerto_libre"
      | "diplomatico"
      | "temporal") || "puerto_libre",
    importadorNombre: initial.importadorNombre,
    importadorDocumento: initial.importadorDocumento,
    importadorTelefono: initial.importadorTelefono,
    importadorEmail: initial.importadorEmail,
    importadorDireccion: initial.importadorDireccion,
    aduana: initial.aduana,
    puerto: initial.puerto,
    modalidadTransito: initial.modalidadTransito || "ninguno",
    aduanaTransito: initial.aduanaTransito,
    numeroBl: initial.numeroBl,
    paisOrigen: initial.paisOrigen,
    valorCif: initial.valorCif,
    tasaCambioBcv: initial.tasaCambioBcv,
    numeroExpedienteSeniat: initial.numeroExpedienteSeniat,
    numeroDav: initial.numeroDav,
    numeroCertificadoOrigen: initial.numeroCertificadoOrigen,
    numeroListaEmpaque: initial.numeroListaEmpaque,
    numeroPolizaTransporte: initial.numeroPolizaTransporte,
    observaciones: initial.observaciones,
  };

  return (
    <PuertoLibreFase1Form
      variant="planilla"
      lockImportador
      vehiculoId={vehiculoId}
      existingDocumentos={docs}
      onDocumentosChange={setDocs}
      initial={formInitial}
      onSubmit={(values, fd) => {
        onSave(
          {
            marca: values.marca,
            modelo: values.modelo,
            color: values.color,
            anio: values.anio ? Number(values.anio) : Number.NaN,
            serialMotor: values.serialMotor,
            vin: values.vin,
            serialCarroceria: values.serialCarroceria,
            kilometraje: values.kilometraje
              ? Number(values.kilometraje)
              : Number.NaN,
            condicion: values.condicion as "nuevo" | "usado",
            esSubasta:
              values.condicion === "usado"
                ? values.esSubasta === "true"
                  ? true
                  : values.esSubasta === "false"
                    ? false
                    : null
                : false,
            partidaArancelaria: values.partidaArancelaria,
            cilindradaCc: values.cilindradaCc,
            tipoCombustible: values.tipoCombustible,
            fechaLlegadaBuque: values.fechaLlegadaBuque,
            regimen: values.regimen || "puerto_libre",
            importadorId: initial.importadorId ?? undefined,
            importadorNombre: values.importadorNombre,
            importadorDocumento: values.importadorDocumento,
            importadorTelefono: values.importadorTelefono,
            importadorEmail: values.importadorEmail,
            importadorDireccion: values.importadorDireccion,
            aduana: values.aduana,
            puerto: values.puerto,
            modalidadTransito: values.modalidadTransito || null,
            aduanaTransito: values.aduanaTransito,
            numeroBl: values.numeroBl,
            paisOrigen: values.paisOrigen,
            valorCif: values.valorCif,
            tasaCambioBcv: values.tasaCambioBcv,
            numeroExpedienteSeniat: values.numeroExpedienteSeniat,
            numeroDav: values.numeroDav,
            numeroCertificadoOrigen: values.numeroCertificadoOrigen,
            numeroListaEmpaque: values.numeroListaEmpaque,
            numeroPolizaTransporte: values.numeroPolizaTransporte,
            observaciones: values.observaciones,
          },
          afterFromFormData(fd)
        );
      }}
      actions={
        <PlanillaFaseActions
          pending={pending}
          continueLabel="Continuar a Embarque"
          asFormSubmit
        />
      }
    />
  );
}

type EmbarqueDatosForm = {
  fechaLlegadaBuque: string;
  puerto: string;
  modalidadTransito: ModalidadTransito;
  aduanaTransito: string;
  aduana: string;
  numeroBl: string;
  paisOrigen: string;
  regimen: RegimenImportacion;
  numeroCertificadoOrigen: string;
  observaciones: string;
};

function Fase2Embarque({
  vehiculoId,
  docs,
  setDocs,
  docsCount,
  pending,
  canCompleteDocs,
  initial,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  docsCount: number;
  pending: boolean;
  canCompleteDocs: boolean;
  initial: EmbarqueDatosForm;
  onComplete: (datos: EmbarqueDatosForm, after: PlanillaAfterSave) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  const [datos, setDatos] = useState<EmbarqueDatosForm>({
    ...initial,
    regimen: "puerto_libre",
  });
  const certSyncStarted = useRef(false);

  useEffect(() => {
    setDatos((prev) => ({
      fechaLlegadaBuque: initial.fechaLlegadaBuque || prev.fechaLlegadaBuque,
      puerto: initial.puerto || prev.puerto,
      modalidadTransito: initial.modalidadTransito || prev.modalidadTransito,
      aduanaTransito: initial.aduanaTransito || prev.aduanaTransito,
      aduana: initial.aduana || prev.aduana,
      numeroBl: initial.numeroBl || prev.numeroBl,
      paisOrigen: initial.paisOrigen || prev.paisOrigen,
      regimen: "puerto_libre",
      numeroCertificadoOrigen:
        initial.numeroCertificadoOrigen || prev.numeroCertificadoOrigen,
      observaciones: initial.observaciones || prev.observaciones,
    }));
  }, [initial]);

  useEffect(() => {
    if (certSyncStarted.current) return;
    if (datos.numeroCertificadoOrigen.trim()) return;
    if (!docs.certificado_origen?.url) return;
    certSyncStarted.current = true;
    void syncCertificadoOrigenNumeroAction(vehiculoId).then((result) => {
      if (result.success && result.numeroCertificadoOrigen) {
        setDatos((prev) => ({
          ...prev,
          numeroCertificadoOrigen: result.numeroCertificadoOrigen ?? "",
        }));
      }
    });
  }, [vehiculoId, docs.certificado_origen?.url, datos.numeroCertificadoOrigen]);

  function patch<K extends keyof EmbarqueDatosForm>(
    key: K,
    value: EmbarqueDatosForm[K]
  ) {
    setDatos((prev) => ({ ...prev, [key]: value }));
  }

  const needsAduanaTransito =
    datos.modalidadTransito === "transito" ||
    datos.modalidadTransito === "uso24";

  const datosCompletos =
    Boolean(datos.fechaLlegadaBuque.trim()) &&
    Boolean(datos.puerto.trim()) &&
    Boolean(datos.aduana.trim()) &&
    Boolean(datos.numeroBl.trim()) &&
    Boolean(datos.paisOrigen.trim()) &&
    (!needsAduanaTransito || Boolean(datos.aduanaTransito.trim()));

  const canContinue = canCompleteDocs && datosCompletos;
  const inputClass =
    "box-border w-full max-w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60";

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
              hint={docs[tipo]?.url ? "" : "Foto o PDF · máx. 10 MB"}
              actionLabel={docs[tipo]?.url ? "Sustituir" : "Escanear / PDF"}
              onUploaded={(next) => {
                setDocs(next);
                onUploadedMessage(
                  tipo === "bl_guia"
                    ? "BL guardado · revisa/completa los datos de embarque"
                    : tipo === "poliza_transporte"
                      ? "Póliza guardada · revisa/completa los datos de embarque"
                      : "Documento guardado"
                );
              }}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Ship className="h-5 w-5 text-cyan-400" />
          Datos de embarque
        </h2>
        <input type="hidden" name="regimen" value="puerto_libre" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <PlanillaFechaField
              label="Fecha de llegada del buque *"
              value={datos.fechaLlegadaBuque}
              onChange={(v) => patch("fechaLlegadaBuque", v)}
              required
              name="fechaLlegadaBuque"
            />
          </div>
          {datos.numeroCertificadoOrigen.trim() ? (
            <div className="min-w-0">
              <input
                type="hidden"
                name="numeroCertificadoOrigen"
                value={datos.numeroCertificadoOrigen}
              />
              <p className="text-sm text-slate-400">Nº certificado de origen</p>
              <p className="mt-1 font-mono text-sm uppercase text-cyan-200">
                {datos.numeroCertificadoOrigen}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Extraído del certificado escaneado en Registro
              </p>
            </div>
          ) : (
            <label className="block min-w-0 space-y-1.5">
              <span className="text-sm text-slate-400">Nº certificado de origen</span>
              <input
                name="numeroCertificadoOrigen"
                value={datos.numeroCertificadoOrigen}
                onChange={(e) =>
                  patch("numeroCertificadoOrigen", e.target.value.toUpperCase())
                }
                placeholder={
                  docs.certificado_origen?.url
                    ? "Leyendo certificado…"
                    : "Del certificado de origen (Registro)"
                }
                className={`${inputClass} font-mono uppercase`}
              />
              {docs.certificado_origen?.url ? (
                <p className="text-xs text-slate-500">
                  Se intenta leer del certificado cargado en Registro. Si no aparece,
                  complétalo a mano.
                </p>
              ) : null}
            </label>
          )}
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm text-slate-400">Puerto *</span>
            <input
              name="puerto"
              required
              value={datos.puerto}
              onChange={(e) => patch("puerto", e.target.value)}
              placeholder="Ej. El Guamache"
              className={inputClass}
            />
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm text-slate-400">Tránsito / USO24 *</span>
            <select
              name="modalidadTransito"
              value={datos.modalidadTransito}
              onChange={(e) => {
                const next = e.target.value as ModalidadTransito;
                patch("modalidadTransito", next);
                if (next === "ninguno") patch("aduanaTransito", "");
              }}
              className={inputClass}
            >
              {MODALIDADES_TRANSITO.map((m) => (
                <option key={m} value={m}>
                  {MODALIDAD_TRANSITO_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          {needsAduanaTransito ? (
            <label className="block min-w-0 space-y-1.5">
              <span className="text-sm text-slate-400">Aduana tránsito / USO24 *</span>
              <select
                name="aduanaTransito"
                required
                value={datos.aduanaTransito}
                onChange={(e) => patch("aduanaTransito", e.target.value)}
                className={inputClass}
              >
                <option value="">Selecciona aduana</option>
                {ADUANAS_VENEZUELA.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm text-slate-400">Aduana *</span>
            <select
              name="aduana"
              required
              value={datos.aduana}
              onChange={(e) => patch("aduana", e.target.value)}
              className={inputClass}
            >
              <option value="">Selecciona aduana</option>
              {ADUANAS_VENEZUELA.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm text-slate-400">Nº BL / Guía *</span>
            <input
              name="numeroBl"
              required
              value={datos.numeroBl}
              onChange={(e) => patch("numeroBl", e.target.value.toUpperCase())}
              placeholder="Del escaneo del BL o captura manual"
              className={`${inputClass} font-mono uppercase`}
            />
            <span className="block text-xs text-slate-500">
              Se extrae al cargar el BL; también puedes escribirlo.
            </span>
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className="text-sm text-slate-400">País de origen *</span>
            <select
              name="paisOrigen"
              required
              value={datos.paisOrigen}
              onChange={(e) => patch("paisOrigen", e.target.value)}
              className={inputClass}
            >
              <option value="">Selecciona país</option>
              {PAISES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Observaciones</span>
            <textarea
              name="observaciones"
              rows={3}
              value={datos.observaciones}
              onChange={(e) => patch("observaciones", e.target.value)}
              placeholder="Notas de la unidad / llave…"
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <PlanillaFaseActions
        pending={pending}
        disabled={!canContinue}
        continueLabel="Continuar a Llegada"
        onAction={(after) => onComplete(datos, after)}
      />
    </div>
  );
}

function Fase2Llegada({
  vehiculoId,
  serialCarroceria,
  docs,
  setDocs,
  fotosCount,
  fechaIngresoInicial,
  partidaArancelariaInicial,
  initialImprontaEstado,
  initialImprontaLeido,
  checklist,
  setChecklist,
  checklistNotas,
  setChecklistNotas,
  checklistMarked,
  otrosNotas,
  setOtrosNotas,
  pending,
  canForzarImpronta,
  onSave,
  onUploadedMessage,
}: {
  vehiculoId: string;
  serialCarroceria: string | null;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  fotosCount: number;
  fechaIngresoInicial: string;
  partidaArancelariaInicial: string;
  initialImprontaEstado: "coincide" | "no_coincide" | "no_leido" | null;
  initialImprontaLeido: string | null;
  checklist: LlegadaChecklistState;
  setChecklist: Dispatch<SetStateAction<LlegadaChecklistState>>;
  checklistNotas: LlegadaChecklistNotasState;
  setChecklistNotas: Dispatch<SetStateAction<LlegadaChecklistNotasState>>;
  checklistMarked: number;
  otrosNotas: string;
  setOtrosNotas: (v: string) => void;
  pending: boolean;
  /** Solo operadores con permiso de mutación (admin/taller). */
  canForzarImpronta: boolean;
  onSave: (
    fechaIngreso: string,
    partidaArancelaria: string,
    after: PlanillaAfterSave,
    forzarImprontaSinVerificar: boolean
  ) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  const [fecha, setFecha] = useState(fechaIngresoInicial);
  const [partidaArancelaria, setPartidaArancelaria] = useState(
    partidaArancelariaInicial
  );
  const [improntaEstado, setImprontaEstado] = useState(initialImprontaEstado);
  const [improntaLeido, setImprontaLeido] = useState(initialImprontaLeido);
  const [forzarImpronta, setForzarImpronta] = useState(false);

  useEffect(() => {
    setFecha((prev) => fechaIngresoInicial || prev);
    setPartidaArancelaria((prev) => partidaArancelariaInicial || prev);
  }, [fechaIngresoInicial, partidaArancelariaInicial]);

  useEffect(() => {
    setImprontaEstado(initialImprontaEstado);
    setImprontaLeido(initialImprontaLeido);
  }, [initialImprontaEstado, initialImprontaLeido]);

  const expectedSerial = (serialCarroceria ?? "").trim();
  const improntaOk = improntaEstado === "coincide";
  const canForce =
    canForzarImpronta &&
    Boolean(docs.foto_impronta?.url) &&
    (improntaEstado === "no_leido" || improntaEstado == null);
  const llegadaDocsCount = PL_LLEGADA_DOCUMENTO_TIPOS.filter(
    (t) => Boolean(docs[t]?.url)
  ).length;
  const llegadaDocsOk = llegadaDocsCount === PL_LLEGADA_DOCUMENTO_TIPOS.length;
  const memoriaCompleta = fotosCount === MEMORIA_FOTOGRAFICA_TIPOS.length;
  const cuestionarioCompleto = isLlegadaChecklistCompleto(checklist);
  const datosLlegadaOk =
    Boolean(fecha.trim()) && Boolean(partidaArancelaria.trim());
  const canContinue =
    datosLlegadaOk &&
    llegadaDocsOk &&
    memoriaCompleta &&
    cuestionarioCompleto &&
    improntaEstado !== "no_coincide" &&
    (improntaOk || (canForce && forzarImpronta));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="text-lg font-semibold leading-snug text-slate-100">
          Datos de llegada
        </h2>
        <div className="mt-4 min-w-0 w-full">
          <PlanillaFechaField
            label="Fecha de ingreso al PL *"
            value={fecha}
            onChange={setFecha}
            required
            name="fechaIngreso"
            className="min-w-0 w-full"
          />
        </div>
        <label className="mt-5 block min-w-0 space-y-1.5">
          <span className="text-sm text-slate-400">Partida arancelaria *</span>
          <input
            name="partidaArancelaria"
            type="text"
            required
            value={partidaArancelaria}
            placeholder="Ej. 8703.23.91"
            onChange={(e) => setPartidaArancelaria(e.target.value.toUpperCase())}
            className="box-border w-full max-w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm uppercase text-slate-100 outline-none focus:border-cyan-500/60"
          />
          <span className="block text-xs text-slate-500">
            Código arancelario del vehículo (SENIAT).
          </span>
        </label>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-snug text-slate-100">
          <FileUp className="h-5 w-5 shrink-0 text-cyan-400" />
          Documentos de llegada
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {llegadaDocsCount}/{PL_LLEGADA_DOCUMENTO_TIPOS.length}
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Acta de recepción (AR) y reconocimiento / constancia del estado de la
          carga.
        </p>
        <div className="mt-5 grid gap-3">
          {PL_LLEGADA_DOCUMENTO_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              acceptMode="both"
              hint="PDF o foto · máx. 10 MB"
              actionLabel={docs[tipo]?.url ? "Reemplazar" : "Cargar"}
              onUploaded={(next) => {
                setDocs(next);
                onUploadedMessage("Documento de llegada guardado");
              }}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-snug text-slate-100">
          <Camera className="h-5 w-5 shrink-0 text-cyan-400" />
          Memoria descriptiva
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {fotosCount}/{MEMORIA_FOTOGRAFICA_TIPOS.length}
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Fotos del vehículo al llegar. La impronta debe coincidir con el serial
          del expediente.
        </p>
        <div className="mt-5 grid gap-3">
          {MEMORIA_FOTOGRAFICA_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              hint=""
              actionLabel="Tomar / subir foto"
              annotateBeforeUpload
              verifySerialAgainstExpediente={tipo === "foto_impronta"}
              initialImprontaVerify={
                tipo === "foto_impronta" && improntaEstado
                  ? {
                      estado: improntaEstado,
                      expected: expectedSerial,
                      leido: improntaLeido,
                      message:
                        improntaEstado === "coincide"
                          ? `Serial verificado: coincide con el del expediente (${expectedSerial}).`
                          : improntaEstado === "no_coincide"
                            ? `El serial leído (${improntaLeido ?? "—"}) no coincide con el precargado (${expectedSerial || "—"}).`
                            : "No se pudo leer el serial en la foto anterior. Vuelve a tomarla.",
                    }
                  : null
              }
              onImprontaVerified={(result) => {
                setImprontaEstado(result.estado);
                setImprontaLeido(result.leido);
                if (result.estado === "coincide") setForzarImpronta(false);
              }}
              onUploaded={(next) => {
                setDocs(next);
                onUploadedMessage(
                  tipo === "foto_impronta"
                    ? "Foto de impronta guardada · verificación de serial"
                    : "Foto guardada"
                );
              }}
            />
          ))}
        </div>

        {improntaEstado === "no_coincide" ? (
          <p className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            No puedes continuar mientras el serial de la impronta no coincida.
            Corrige el serial en Registro o toma otra foto.
          </p>
        ) : null}

        {canForce && !improntaOk ? (
          <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-sm text-amber-100">
            <input
              type="checkbox"
              checked={forzarImpronta}
              onChange={(e) => setForzarImpronta(e.target.checked)}
              className="mt-1"
            />
            <span>
              Confirmo que revisé la impronta manualmente (OCR no pudo leer el
              serial con claridad).
            </span>
          </label>
        ) : null}

        {!canForzarImpronta &&
        !improntaOk &&
        improntaEstado !== "no_coincide" &&
        Boolean(docs.foto_impronta?.url) ? (
          <p className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
            El OCR no verificó el serial. Un operador del taller debe confirmar
            la impronta o debes tomar otra foto más clara.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="text-lg font-semibold leading-snug text-slate-100">
          Cuestionario de revisión del vehículo
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Marca cada ítem (OK / Daño). Obligatorio completar los{" "}
          {LLEGADA_CHECKLIST_ITEMS.length} puntos para continuar.
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

      <PlanillaFaseActions
        pending={pending}
        disabled={!canContinue}
        continueLabel="Continuar a Desaduanamiento"
        onAction={(after) =>
          onSave(fecha, partidaArancelaria.trim(), after, forzarImpronta && canForce)
        }
      />
    </div>
  );
}

function DesaduanamientoDocSlot({
  index,
  tipo,
  regimen,
  docs,
  vehiculoId,
  setDocs,
  onUploadedMessage,
  importadorDocumento,
}: {
  index: number;
  tipo: DocumentoTipo;
  regimen: string | null | undefined;
  docs: VehiculosDocumentos;
  vehiculoId: string;
  setDocs: (d: VehiculosDocumentos) => void;
  onUploadedMessage: (msg: string) => void;
  /** Snapshot del RIF/cédula capturado en Registro (solo informativo). */
  importadorDocumento?: string;
}) {
  const origen = origenDocDesaduanamiento(
    regimen,
    tipo,
    PL_DESADUANAMIENTO_ORIGEN
  );
  const loaded = Boolean(docs[tipo]?.url);
  const showImportadorHint =
    (tipo === "cedula_importador" || tipo === "rif_importador") &&
    Boolean(importadorDocumento?.trim());

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100">
            {index}. {DOCUMENTO_LABELS[tipo]}
          </p>
          {origen ? (
            <p className="mt-0.5 text-xs text-slate-500">{origen}</p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">
              Cargar en PDF o foto / escaneo
            </p>
          )}
          {showImportadorHint ? (
            <p className="mt-1 text-xs text-cyan-400/90">
              En registro: {importadorDocumento}
              {loaded ? " · archivo ya cargado" : " · falta el archivo escaneado"}
            </p>
          ) : null}
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
}

function Fase3Aduana({
  vehiculoId,
  docs,
  setDocs,
  docsCount,
  docTipos,
  regimenLabel,
  regimen,
  importadorNombre,
  importadorDocumento,
  pending,
  canComplete,
  agenteAduanalInicial,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  docsCount: number;
  docTipos: DocumentoTipo[];
  regimenLabel: string;
  regimen: string | null | undefined;
  importadorNombre: string;
  importadorDocumento: string;
  pending: boolean;
  canComplete: boolean;
  agenteAduanalInicial: string;
  onComplete: (agenteAduanal: string, after: PlanillaAfterSave) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  const [agenteAduanal, setAgenteAduanal] = useState(agenteAduanalInicial);
  const agenteOk = agenteAduanal.trim().length >= 2;

  const pdfTipos = docTipos.filter((t) => t !== PL_PASE_SALIDA_TIPO);
  const paseLoaded = Boolean(docs[PL_PASE_SALIDA_TIPO]?.url);
  const pdfLoaded = pdfTipos.filter((t) => Boolean(docs[t]?.url)).length;

  useEffect(() => {
    setAgenteAduanal((prev) => agenteAduanalInicial || prev);
  }, [agenteAduanalInicial]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Desaduanamiento — Expediente SENIAT
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {pdfLoaded}/{pdfTipos.length} en PDF
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Régimen: <span className="text-slate-200">{regimenLabel}</span>. Estos
          documentos forman el Expediente PDF: cédula y RIF del importador, lista
          de empaque, DUA, DAV, SENCAMER, constancia del agente, reconocimiento,
          pago de tasas o impuestos y constancia de residencia permanente
          {docTipos.includes("registro_puerto_libre")
            ? " (+ registro PL si aplica)"
            : ""}
          .
        </p>

        <div className="mt-4">
          <PuertoLibreDescargarDesaduanamientoPdf vehiculoId={vehiculoId} />
        </div>

        {(importadorNombre.trim() || importadorDocumento.trim()) && (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Importador (desde Registro)
            </p>
            {importadorNombre.trim() ? (
              <p className="mt-1 text-slate-100">{importadorNombre}</p>
            ) : null}
            {importadorDocumento.trim() ? (
              <p className="font-mono text-cyan-300">{importadorDocumento}</p>
            ) : null}
          </div>
        )}

        <label className="mt-5 block space-y-1.5">
          <span className="text-sm text-slate-400">
            Nombre del agente de aduanas *
          </span>
          <input
            id="agente-aduanal"
            value={agenteAduanal}
            onChange={(e) => setAgenteAduanal(e.target.value)}
            placeholder="Nombre del agente / agencia"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
          />
        </label>

        <ul className="mt-5 space-y-3">
          {pdfTipos.map((tipo, index) => (
            <DesaduanamientoDocSlot
              key={tipo}
              index={index + 1}
              tipo={tipo}
              regimen={regimen}
              docs={docs}
              vehiculoId={vehiculoId}
              setDocs={setDocs}
              onUploadedMessage={onUploadedMessage}
              importadorDocumento={importadorDocumento}
            />
          ))}
        </ul>

        <div className="mt-6">
          <PuertoLibreDescargarDesaduanamientoPdf vehiculoId={vehiculoId} />
        </div>
      </section>

      <section className="rounded-2xl border border-amber-900/40 bg-amber-950/10 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          Pase de salida
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-normal ${
              paseLoaded
                ? "bg-emerald-950/60 text-emerald-300"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {paseLoaded ? "Listo" : "Pendiente"}
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Cárgalo en esta misma pantalla. No forma parte del Expediente PDF
          SENIAT; queda en el expediente digital del vehículo.
        </p>
        <ul className="mt-5 space-y-3">
          <DesaduanamientoDocSlot
            index={1}
            tipo={PL_PASE_SALIDA_TIPO}
            regimen={regimen}
            docs={docs}
            vehiculoId={vehiculoId}
            setDocs={setDocs}
            onUploadedMessage={onUploadedMessage}
          />
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Carpeta completa: {docsCount}/{docTipos.length} (incluye pase de
          salida).
        </p>
      </section>

      <label className="block space-y-1.5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <span className="text-sm font-medium text-slate-200">
          Nombre del agente de aduanas *
        </span>
        <input
          value={agenteAduanal}
          onChange={(e) => setAgenteAduanal(e.target.value)}
          placeholder="Nombre del agente / agencia"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
        />
      </label>

      <PlanillaFaseActions
        pending={pending}
        disabled={!canComplete || !agenteOk}
        blockedReason={
          !canComplete
            ? `Faltan documentos (${docsCount}/${docTipos.length})`
            : !agenteOk
              ? "Escribe el nombre del agente de aduanas para continuar"
              : null
        }
        continueLabel="Continuar a Propietario"
        onAction={(after) => onComplete(agenteAduanal.trim(), after)}
      />
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
  compradorFechaNacimiento,
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
  compradorFechaNacimiento: string | null;
  compradorDireccion: string | null;
  pending: boolean;
  onComplete: (
    payload: {
      nombreCliente: string;
      telefonoCliente: string;
      cedulaPropietario: string;
      emailPropietario: string;
      direccion: string;
      fechaNacimientoPropietario: string;
    },
    after: PlanillaAfterSave
  ) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  const [nombreCliente, setNombreCliente] = useState(compradorNombre ?? "");
  const [cedulaPropietario, setCedulaPropietario] = useState(
    compradorCedula ?? ""
  );
  const [telefonoCliente, setTelefonoCliente] = useState(
    compradorTelefono ?? ""
  );
  const [direccion, setDireccion] = useState(compradorDireccion ?? "");
  const [emailPropietario, setEmailPropietario] = useState(
    compradorEmail ?? ""
  );
  const [fechaNacimientoPropietario, setFechaNacimientoPropietario] =
    useState(compradorFechaNacimiento ?? "");

  function applyScanned(fields: {
    nombreCliente?: string;
    cedulaPropietario?: string;
    fechaNacimientoPropietario?: string;
  }) {
    if (fields.nombreCliente) setNombreCliente(fields.nombreCliente);
    if (fields.cedulaPropietario) setCedulaPropietario(fields.cedulaPropietario);
    if (fields.fechaNacimientoPropietario) {
      setFechaNacimientoPropietario(fields.fechaNacimientoPropietario);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <User className="h-5 w-5 text-cyan-400" />
          Datos del comprador / propietario
        </h2>

        <div className="mt-4">
          <PropietarioCedulaScan
            vehiculoId={vehiculoId}
            existingUrl={docs.cedula?.url}
            onExtracted={applyScanned}
            onDocumentUploaded={(next) => {
              setDocs(next);
              onUploadedMessage("Cédula leída y guardada");
            }}
          />
        </div>

        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          action={(fd) => {
            onComplete(
              {
                nombreCliente: String(fd.get("nombreCliente") ?? ""),
                telefonoCliente: String(fd.get("telefonoCliente") ?? ""),
                cedulaPropietario: String(fd.get("cedulaPropietario") ?? ""),
                emailPropietario: String(fd.get("emailPropietario") ?? ""),
                direccion: String(fd.get("direccion") ?? ""),
                fechaNacimientoPropietario: String(
                  fd.get("fechaNacimientoPropietario") ?? ""
                ),
              },
              afterFromFormData(fd)
            );
          }}
        >
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Nombre *</span>
            <input
              name="nombreCliente"
              required
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">Cédula</span>
            <input
              name="cedulaPropietario"
              value={cedulaPropietario}
              onChange={(e) => setCedulaPropietario(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <PlanillaFechaField
            label="Fecha de nacimiento"
            name="fechaNacimientoPropietario"
            value={fechaNacimientoPropietario}
            onChange={setFechaNacimientoPropietario}
            className="sm:col-span-1"
          />
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">WhatsApp</span>
            <input
              name="telefonoCliente"
              value={telefonoCliente}
              onChange={(e) => setTelefonoCliente(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Dirección</span>
            <input
              name="direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Email</span>
            <input
              name="emailPropietario"
              type="email"
              value={emailPropietario}
              onChange={(e) => setEmailPropietario(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>

          <div className="sm:col-span-2">
            <PlanillaFaseActions
              pending={pending}
              continueLabel="Continuar a Seguro"
              asFormSubmit
            />
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
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  initialSeguro: SeguroData;
  pending: boolean;
  onComplete: (
    payload: {
      aseguradora: string;
      numeroPoliza: string | null;
      tipoCobertura: string | null;
      vigenciaDesde: string | null;
      vigenciaHasta: string | null;
      montoAsegurado: number | null;
      telefonoAseguradora: string | null;
      corredor: string | null;
    },
    after: PlanillaAfterSave
  ) => void;
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
            onComplete(
              {
                aseguradora: String(fd.get("aseguradora") ?? ""),
                numeroPoliza: String(fd.get("numeroPoliza") ?? "") || null,
                tipoCobertura: String(fd.get("tipoCobertura") ?? "") || null,
                vigenciaDesde: String(fd.get("vigenciaDesde") ?? "") || null,
                vigenciaHasta: String(fd.get("vigenciaHasta") ?? "") || null,
                montoAsegurado: montoRaw ? Number(montoRaw) : null,
                telefonoAseguradora:
                  String(fd.get("telefonoAseguradora") ?? "") || null,
                corredor: String(fd.get("corredor") ?? "") || null,
              },
              afterFromFormData(fd)
            );
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
            <div className="mt-3 grid gap-3">
              {SEGURO_DOCUMENTO_TIPOS.map((tipo) => (
                <ImportDocumentoUpload
                  key={tipo}
                  vehiculoId={vehiculoId}
                  tipo={tipo}
                  existingUrl={docs[tipo]?.url}
                  hint="Foto o PDF · máx. 10 MB"
                  onUploaded={(next) => {
                    setDocs(next);
                    onUploadedMessage("Documento de seguro guardado");
                  }}
                />
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <PlanillaFaseActions
              pending={pending}
              continueLabel="Continuar a Matriculación"
              asFormSubmit
            />
          </div>
        </form>
      </section>
    </div>
  );
}

function MatriculacionDocRow({
  vehiculoId,
  tipo,
  docs,
  setDocs,
  origen,
  onUploadedMessage,
}: {
  vehiculoId: string;
  tipo: DocumentoTipo;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  origen?: string;
  onUploadedMessage: (msg: string) => void;
}) {
  const loaded = Boolean(docs[tipo]?.url);
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100">
            {DOCUMENTO_LABELS[tipo]}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {origen ?? "Cargar en PDF o foto / escaneo"}
          </p>
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
}

function MatriculacionReferenciaRow({
  tipo,
  docs,
}: {
  tipo: DocumentoTipo;
  docs: VehiculosDocumentos;
}) {
  const loaded = Boolean(docs[tipo]?.url);
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100">
            {DOCUMENTO_LABELS[tipo]}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {PL_MATRICULACION_ORIGEN[tipo] ?? "Cargado en una fase anterior"}
          </p>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
            loaded
              ? "bg-emerald-950/60 text-emerald-300"
              : "bg-amber-950/50 text-amber-200"
          }`}
        >
          {loaded ? "En expediente" : "No encontrado"}
        </span>
      </div>
      {loaded && docs[tipo]?.url ? (
        <a
          href={docs[tipo]!.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex text-xs text-cyan-400 hover:underline"
        >
          Ver documento
        </a>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Vuelve a la fase de origen para cargarlo; aquí solo se referencia.
        </p>
      )}
    </li>
  );
}

function Fase6Matriculacion({
  vehiculoId,
  docs,
  setDocs,
  requiereHomologacionInicial,
  pending,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  requiereHomologacionInicial: boolean;
  pending: boolean;
  onComplete: (
    requiereHomologacion: boolean,
    after: PlanillaAfterSave
  ) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  const [requiereHomologacion, setRequiereHomologacion] = useState(
    requiereHomologacionInicial
  );
  const stats = countMatriculacionCarpeta(docs, requiereHomologacion);
  const carpetaCompleta = stats.listos === stats.total;
  const liquidacionListo = tieneLiquidacionOExencion(docs);
  const refsListos = PL_MATRICULACION_REFERENCIA_TIPOS.filter((t) =>
    Boolean(docs[t]?.url)
  ).length;

  useEffect(() => {
    setRequiereHomologacion(requiereHomologacionInicial);
  }, [requiereHomologacionInicial]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Matriculación — trámite INTT
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {stats.listos}/{stats.total}
          </span>
        </h2>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-300">
          Cargar en esta fase
        </h3>
        <ul className="mt-3 space-y-3">
          {PL_MATRICULACION_CARGAR_TIPOS.map((tipo) => (
            <MatriculacionDocRow
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              docs={docs}
              setDocs={setDocs}
              origen={PL_MATRICULACION_ORIGEN[tipo]}
              onUploadedMessage={onUploadedMessage}
            />
          ))}
          <li className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={requiereHomologacion}
                onChange={(e) => setRequiereHomologacion(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/40"
              />
              <span>
                <span className="block text-sm font-medium text-slate-100">
                  Este vehículo requiere homologación
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Márcalo solo si aplica; entonces la homologación es obligatoria.
                </span>
              </span>
            </label>
          </li>
          {requiereHomologacion ? (
            <MatriculacionDocRow
              vehiculoId={vehiculoId}
              tipo="homologacion"
              docs={docs}
              setDocs={setDocs}
              origen={PL_MATRICULACION_ORIGEN.homologacion}
              onUploadedMessage={onUploadedMessage}
            />
          ) : null}
          <li className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100">
                  Liquidación / exención y oficio SENIAT
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Basta con la liquidación o el oficio de exención del SENIAT
                </p>
              </div>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  liquidacionListo
                    ? "bg-emerald-950/60 text-emerald-300"
                    : "bg-red-950/50 text-red-300"
                }`}
              >
                {liquidacionListo ? "Listo" : "Pendiente"}
              </span>
            </div>
            <div className="space-y-3">
              {PL_MATRICULACION_LIQUIDACION_EXENCION_TIPOS.map((tipo) => {
                const loaded = Boolean(docs[tipo]?.url);
                return (
                  <div
                    key={tipo}
                    className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-100">
                          {DOCUMENTO_LABELS[tipo]}
                        </p>
                        {PL_MATRICULACION_ORIGEN[tipo] ? (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {PL_MATRICULACION_ORIGEN[tipo]}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          loaded
                            ? "bg-emerald-950/60 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {loaded ? "Cargado" : "Opcional si ya hay el otro"}
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
                  </div>
                );
              })}
            </div>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-100">
          Referencia — ya en el expediente
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {refsListos}/{PL_MATRICULACION_REFERENCIA_TIPOS.length}
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          No se vuelven a cargar aquí. Si figuran como “En expediente”, entran
          al PDF de la carpeta INTT.
        </p>
        <ul className="mt-4 space-y-2.5">
          {PL_MATRICULACION_REFERENCIA_TIPOS.map((tipo) => (
            <MatriculacionReferenciaRow key={tipo} tipo={tipo} docs={docs} />
          ))}
        </ul>

        <div className="mt-6 space-y-3">
          <PuertoLibreDescargarMatriculacionPdf
            vehiculoId={vehiculoId}
            variant="compact"
          />
          <p className="text-xs text-slate-500">
            El PDF incluye portada, índice, los documentos de esta fase y las
            referencias cargadas en fases anteriores.
          </p>
        </div>
      </section>

      <PlanillaFaseActions
        pending={pending}
        disabled={!carpetaCompleta}
        continueLabel="Finalizar y nacionalizar"
        onAction={(after) => onComplete(requiereHomologacion, after)}
      />
    </div>
  );
}

