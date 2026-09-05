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
  completePuertoLibreInspeccionAction,
  completePuertoLibrePagoImpuestoAction,
  savePuertoLibreCarpetaMatriculacionAction,
  savePuertoLibreEntregaPlacaAction,
  savePuertoLibreFase1RegistroAction,
  savePuertoLibreFase2LlegadaAction,
  syncPuertoLibreBlEmbarqueAction,
} from "@/app/actions/nfc/importacion-vehiculo";
import { ImportDocumentoUpload } from "@/components/nfc/ImportDocumentoUpload";
import { PrecalculoArancelesCard } from "@/components/nfc/PrecalculoArancelesCard";
import { PagoArancelesCard } from "@/components/nfc/PagoArancelesCard";
import { PostPagoInspeccionCard } from "@/components/nfc/PostPagoInspeccionCard";
import { LlegadaRevisionSections } from "@/components/nfc/LlegadaRevisionSections";
import { PropietarioCedulaScan } from "@/components/nfc/PropietarioCedulaScan";
import { PlanillaFechaField } from "@/components/nfc/PlanillaFechaField";
import {
  isLlegadaChecklistCompleto,
  LLEGADA_CHECKLIST_ITEMS,
  type LlegadaChecklistNotasState,
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
  parsePuertosDescarga,
  primaryPuertoDescarga,
  PUERTOS_DESCARGA_VENEZUELA,
  resolvePuertoDescarga,
} from "@/lib/importacion/puertos-venezuela";
import {
  DOCUMENTO_LABELS,
  MEMORIA_FOTOGRAFICA_TIPOS,
  MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS,
  MODALIDAD_TRANSITO_LABELS,
  MODALIDADES_TRANSITO,
  PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
  PL_DESADUANAMIENTO_ORIGEN,
  PL_DESADUANAMIENTO_PRECARGA_TIPOS,
  PL_EMBARQUE_DOCUMENTO_TIPOS,
  embarqueDocumentosObligatorios,
  embarqueImportadorTipos,
  PL_LLEGADA_DOCUMENTO_TIPOS,
  PL_ENTREGA_PLACA_ORIGEN,
  PL_ENTREGA_PLACA_TIPOS,
  PL_INTT_PRESENTACION_LABELS,
  PL_INTT_PRESENTACION_ORIGEN,
  PL_INTT_PRESENTACION_TIPOS,
  constanciaInspeccionLista,
  countMatriculacionCarpeta,
  inttPresentacionRef,
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
import { esEntregaPlacaCompleta } from "@/lib/importacion/entrega-placa-planilla";
import { esRegistroPlanillaCompleto } from "@/lib/importacion/registro-planilla";
import { hrefAfterFase2Embarque } from "@/lib/importacion/paths";
import { RelojesExpediente } from "@/components/nfc/RelojesExpediente";
import { RevisionVehiculoPdfCard } from "@/components/nfc/RevisionVehiculoPdfCard";
import { PL_DESADUANAMIENTO_RESERVADOS } from "@/lib/importacion/desaduanamiento-reservados";
import { puedeCompletarPagoImpuesto } from "@/lib/importacion/pago-aranceles";
import {
  toPlanillaFaseUi,
  type PlanillaFaseUi,
} from "@/lib/importacion/planilla-etapas";

export type { PlanillaFaseUi };

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
  /** Fase forzada por query (?fase=1…10). */
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
  if (forced) return forced;
  return toPlanillaFaseUi(importacion.planillaFase ?? 1);
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
  const fotosObligatoriasCount = countDocs(
    docs,
    MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS
  );
  const embarqueCount = countDocs(docs, PL_EMBARQUE_DOCUMENTO_TIPOS);
  const embarqueImportadorTiposList = embarqueImportadorTipos(
    esImportadorJuridico
  );
  const embarqueObligatorios = embarqueDocumentosObligatorios(
    esImportadorJuridico
  );
  const embarqueObligatoriosCount = countDocs(docs, embarqueObligatorios);
  const aduanaCount = countDocs(docs, desaduanamientoTipos);
  const checklistMarked = useMemo(
    () => LLEGADA_CHECKLIST_ITEMS.filter((i) => Boolean(checklist[i.id])).length,
    [checklist]
  );

  const registroCompleto = esRegistroPlanillaCompleto({
    marca,
    modelo,
    color,
    anio: initialImportacion.anio,
    serialMotor,
    vin: initialImportacion.vin,
    serialCarroceria,
    kilometraje: kilometrajeUltimo,
    condicionVehiculo: initialImportacion.condicionVehiculo,
    esSubasta: initialImportacion.esSubasta,
    importadorNombre: initialImportacion.importadorNombre,
    tieneFactura: Boolean(docs.factura_comercial?.url),
    tieneCertificado: Boolean(docs.certificado_origen?.url),
  });

  const embarqueCompleto =
    embarqueObligatoriosCount === embarqueObligatorios.length;

  const llegadaDocsCount = countDocs(docs, PL_LLEGADA_DOCUMENTO_TIPOS);
  const llegadaCompleta =
    Boolean(initialImportacion.fechaIngreso?.trim()) &&
    Boolean(initialImportacion.partidaArancelaria?.trim());

  const aduanaCompleta = aduanaCount === desaduanamientoTipos.length;
  const pagoImpuestoCompleto =
    puedeCompletarPagoImpuesto(
      initialImportacion,
      Boolean(docs.planilla_liquidacion_aduanera?.url)
    ) && Boolean(docs.pase_salida_levante?.url);
  const inspeccionCompleta =
    llegadaDocsCount === PL_LLEGADA_DOCUMENTO_TIPOS.length &&
    fotosObligatoriasCount === MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS.length &&
    isLlegadaChecklistCompleto(checklist) &&
    constanciaInspeccionLista(docs);
  const propietarioCompleto = Boolean(compradorNombre?.trim());
  const seguroCompleto = Boolean(
    initialSeguro.aseguradora?.trim() ||
      (initialImportacion.planillaFase != null &&
        initialImportacion.planillaFase >= 9)
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
    matriculacionStats.listos === matriculacionStats.total ||
    (initialImportacion.planillaFase != null &&
      initialImportacion.planillaFase >= 10);
  const entregaPlacaCompleta = esEntregaPlacaCompleta(
    docs,
    placa,
    initialImportacion.codigoExpediente
  );

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

  function navigateAfterEmbarque(after: PlanillaAfterSave) {
    router.push(hrefAfterFase2Embarque(after, vehiculoId));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PlanillaVehiculoSelector current={selectorCurrent} vehiculos={selectorList} />

      <RelojesExpediente
        vehiculoId={vehiculoId}
        importacion={initialImportacion}
        canEdit
        compact
      />

      <div className="flex justify-end">
        <Link
          href="/smartimport/instructivo"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-cyan-300"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Cómo llenar la planilla
        </Link>
      </div>

      <div className="grid w-full grid-cols-5 gap-1 sm:grid-cols-5 lg:grid-cols-10 sm:gap-1.5">
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
          label="Pago imp."
          completo={pagoImpuestoCompleto}
          current={fase === 5}
          onClick={() => goFase(5)}
        />
        <FaseChip
          n={6}
          label="Inspección"
          completo={inspeccionCompleta}
          current={fase === 6}
          onClick={() => goFase(6)}
        />
        <FaseChip
          n={7}
          label="Propietario"
          completo={propietarioCompleto}
          current={fase === 7}
          onClick={() => goFase(7)}
        />
        <FaseChip
          n={8}
          label="Seguro"
          completo={seguroCompleto}
          current={fase === 8}
          onClick={() => goFase(8)}
        />
        <FaseChip
          n={9}
          label="Matrícula"
          completo={matriculacionCompleta}
          current={fase === 9}
          onClick={() => goFase(9)}
        />
        <FaseChip
          n={10}
          label="Placa"
          completo={entregaPlacaCompleta}
          current={fase === 10}
          onClick={() => goFase(10)}
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
          importadorDocsCount={countDocs(docs, embarqueImportadorTiposList)}
          importadorDocsTotal={embarqueImportadorTiposList.length}
          esJuridica={esImportadorJuridico}
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
              navigateAfterEmbarque(after);
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
          fechaIngresoInicial={initialImportacion.fechaIngreso?.trim() ?? ""}
          partidaArancelariaInicial={
            initialImportacion.partidaArancelaria?.trim() ?? ""
          }
          pending={pending}
          onSave={(fechaIngreso, partidaArancelaria, after) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await savePuertoLibreFase2LlegadaAction({
                vehiculoId,
                fechaIngreso,
                partidaArancelaria,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Llegada guardada");
              navigateAfterSave(after, 4);
            });
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
        <FasePagoImpuesto
          vehiculoId={vehiculoId}
          docs={docs}
          setDocs={setDocs}
          pending={pending}
          canComplete={pagoImpuestoCompleto}
          valorCif={initialImportacion.valorCif}
          arancelPct={initialImportacion.arancelPct}
          impuestoLujoPct={initialImportacion.impuestoLujoPct}
          tasaCambioBcv={initialImportacion.tasaCambioBcv}
          tasaOficialFecha={initialImportacion.tasaOficialFecha}
          pagoArancelesEstado={initialImportacion.pagoArancelesEstado}
          pagoArancelesUsd={initialImportacion.pagoArancelesUsd}
          pagoArancelesBs={initialImportacion.pagoArancelesBs}
          partidaArancelaria={initialImportacion.partidaArancelaria}
          onComplete={(after) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await completePuertoLibrePagoImpuestoAction({
                vehiculoId,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Pago de impuesto guardado");
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
        <FaseInspeccion
          vehiculoId={vehiculoId}
          serialCarroceria={serialCarroceria}
          docs={docs}
          setDocs={setDocs}
          fotosCount={fotosCount}
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
          onComplete={(after, forzarImprontaSinVerificar) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await completePuertoLibreInspeccionAction({
                vehiculoId,
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
              setMessage("Inspección guardada");
              navigateAfterSave(after, 7);
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : fase === 7 ? (
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
              navigateAfterSave(after, 8);
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : fase === 8 ? (
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
              navigateAfterSave(after, 9);
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : fase === 9 ? (
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
              setMessage(
                "Archivo INTT presentado · registra placa y circulación"
              );
              navigateAfterSave(after, 10);
            });
          }}
          onUploadedMessage={(msg) => {
            setMessage(msg);
            setError(null);
            router.refresh();
          }}
        />
      ) : (
        <Fase8EntregaPlaca
          vehiculoId={vehiculoId}
          placaInicial={placa}
          codigoExpediente={initialImportacion.codigoExpediente}
          docs={docs}
          setDocs={setDocs}
          pending={pending}
          onComplete={(after, placaValue) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await savePuertoLibreEntregaPlacaAction({
                vehiculoId,
                placa: placaValue,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setMessage("Placa y circulación listas · puedes nacionalizar");
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
  observaciones: string;
};

function Fase2Embarque({
  vehiculoId,
  docs,
  setDocs,
  docsCount,
  importadorDocsCount,
  importadorDocsTotal,
  esJuridica,
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
  importadorDocsCount: number;
  importadorDocsTotal: number;
  esJuridica: boolean;
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
  const blSyncStarted = useRef(false);
  const [blSyncPending, setBlSyncPending] = useState(false);
  const [blSyncTried, setBlSyncTried] = useState(false);

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
      observaciones: initial.observaciones || prev.observaciones,
    }));
  }, [initial]);

  function applyBlSyncToForm(result: {
    numeroBl: string | null;
    fechaLlegadaBuque: string | null;
    puerto: string | null;
    aduana: string | null;
    paisOrigen: string | null;
    modalidadTransito: "ninguno" | "transito" | "uso24" | null;
    aduanaTransito: string | null;
  }) {
    setDatos((prev) => ({
      ...prev,
      numeroBl: result.numeroBl?.trim() || prev.numeroBl,
      fechaLlegadaBuque:
        result.fechaLlegadaBuque?.trim() || prev.fechaLlegadaBuque,
      puerto: result.puerto?.trim() || prev.puerto,
      aduana: result.aduana?.trim() || prev.aduana,
      paisOrigen: result.paisOrigen?.trim() || prev.paisOrigen,
      modalidadTransito:
        result.modalidadTransito ?? prev.modalidadTransito,
      aduanaTransito: result.aduanaTransito?.trim() || prev.aduanaTransito,
    }));
  }

  function syncBlEmbarque() {
    setBlSyncPending(true);
    void syncPuertoLibreBlEmbarqueAction(vehiculoId)
      .then((result) => {
        if (result.success) applyBlSyncToForm(result);
      })
      .finally(() => {
        setBlSyncPending(false);
        setBlSyncTried(true);
      });
  }

  useEffect(() => {
    if (blSyncStarted.current) return;
    if (datos.numeroBl.trim()) return;
    if (!docs.bl_guia?.url) return;
    blSyncStarted.current = true;
    syncBlEmbarque();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculoId, docs.bl_guia?.url]);

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
  const importadorDocsFaltantes = embarqueImportadorTipos(esJuridica).filter(
    (tipo) => !docs[tipo]?.url
  );

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
        <p className="mt-1 text-xs text-slate-500">
          Obligatorios: BL y lista de empaque. La póliza de transporte es
          opcional para continuar a Llegada.
        </p>
        <div className="mt-4 grid gap-3">
          {PL_EMBARQUE_DOCUMENTO_TIPOS.map((tipo) => (
            <ImportDocumentoUpload
              key={tipo}
              vehiculoId={vehiculoId}
              tipo={tipo}
              existingUrl={docs[tipo]?.url}
              acceptMode="both"
              hint={
                docs[tipo]?.url
                  ? ""
                  : tipo === "poliza_transporte"
                    ? "Opcional · foto o PDF · máx. 10 MB"
                    : "Foto o PDF · máx. 10 MB"
              }
              actionLabel={docs[tipo]?.url ? "Sustituir" : "Escanear / PDF"}
              onUploaded={(next) => {
                setDocs(next);
                if (tipo === "bl_guia") {
                  blSyncStarted.current = true;
                  syncBlEmbarque();
                  onUploadedMessage(
                    "BL guardado · extrayendo nº BL y datos de embarque…"
                  );
                } else {
                  onUploadedMessage(
                    tipo === "poliza_transporte"
                      ? "Póliza guardada · revisa/completa los datos de embarque"
                      : "Documento guardado"
                  );
                }
              }}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Documentos faltantes del cliente
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {importadorDocsCount}/{importadorDocsTotal}
          </span>
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {importadorDocsFaltantes.length === 0
            ? "Ya están en el cliente o en este expediente. No hace falta volver a cargarlos."
            : `Solo los que faltan. Cárgalos aquí para continuar a Llegada${
                esJuridica ? " (incluye acta constitutiva)" : ""
              }.`}
        </p>
        {importadorDocsFaltantes.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {importadorDocsFaltantes.map((tipo) => (
              <ImportDocumentoUpload
                key={tipo}
                vehiculoId={vehiculoId}
                tipo={tipo}
                existingUrl={docs[tipo]?.url}
                acceptMode="both"
                hint="Foto o PDF · máx. 10 MB"
                actionLabel="Cargar"
                onUploaded={(next) => {
                  setDocs(next);
                  onUploadedMessage("Documento del cliente guardado");
                }}
              />
            ))}
          </div>
        ) : null}
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
          <label className="block min-w-0 space-y-1.5 sm:col-span-2">
            <span className="text-sm text-slate-400">Puerto de descarga *</span>
            <select
              name="puerto"
              required
              value={primaryPuertoDescarga(datos.puerto)}
              onChange={(e) => patch("puerto", e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Selecciona puerto
              </option>
              {PUERTOS_DESCARGA_VENEZUELA.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              {parsePuertosDescarga(datos.puerto)
                .filter(
                  (p) =>
                    !PUERTOS_DESCARGA_VENEZUELA.includes(
                      p as (typeof PUERTOS_DESCARGA_VENEZUELA)[number]
                    )
                )
                .map((p) => (
                  <option key={p} value={p}>
                    {resolvePuertoDescarga(p)}
                  </option>
                ))}
            </select>
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
              placeholder={
                blSyncPending
                  ? "Leyendo nº BL del documento…"
                  : "Del escaneo del BL o captura manual"
              }
              disabled={blSyncPending}
              className={`${inputClass} font-mono uppercase ${
                blSyncPending ? "text-amber-200/90" : ""
              }`}
            />
            <span className="block text-xs text-slate-500">
              {blSyncPending
                ? "Extrayendo el nº de BL / guía del PDF o foto cargado…"
                : docs.bl_guia?.url
                  ? blSyncTried && !datos.numeroBl.trim()
                    ? "No se pudo leer el nº del BL. Escríbelo a mano o reintenta."
                    : "Se extrae al cargar el BL; también puedes escribirlo."
                  : "Carga el BL arriba para intentar extraerlo automáticamente."}
              {docs.bl_guia?.url && !blSyncPending ? (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => {
                      blSyncStarted.current = true;
                      syncBlEmbarque();
                    }}
                    className="text-cyan-400 underline hover:text-cyan-300"
                  >
                    Reintentar
                  </button>
                </>
              ) : null}
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
  fechaIngresoInicial,
  partidaArancelariaInicial,
  pending,
  onSave,
}: {
  fechaIngresoInicial: string;
  partidaArancelariaInicial: string;
  pending: boolean;
  onSave: (
    fechaIngreso: string,
    partidaArancelaria: string,
    after: PlanillaAfterSave
  ) => void;
}) {
  const [fecha, setFecha] = useState(fechaIngresoInicial);
  const [partidaArancelaria, setPartidaArancelaria] = useState(
    partidaArancelariaInicial
  );

  useEffect(() => {
    setFecha((prev) => fechaIngresoInicial || prev);
    setPartidaArancelaria((prev) => partidaArancelariaInicial || prev);
  }, [fechaIngresoInicial, partidaArancelariaInicial]);

  const canContinue =
    Boolean(fecha.trim()) && Boolean(partidaArancelaria.trim());

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="text-lg font-semibold leading-snug text-slate-100">
          Datos de llegada
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Fecha de ingreso y partida arancelaria. La revisión del vehículo y los
          documentos de llegada se cargan en Inspección, después del pago del
          impuesto.
        </p>
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

      <PlanillaFaseActions
        pending={pending}
        disabled={!canContinue}
        continueLabel="Continuar a Desaduanamiento"
        onAction={(after) => onSave(fecha, partidaArancelaria.trim(), after)}
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
  const precargado =
    loaded &&
    (PL_DESADUANAMIENTO_PRECARGA_TIPOS as readonly string[]).includes(tipo);
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
          {precargado ? "Precargado" : loaded ? "Listo" : "Pendiente"}
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
  importadorDocumento: string;
  pending: boolean;
  canComplete: boolean;
  agenteAduanalInicial: string;
  onComplete: (agenteAduanal: string, after: PlanillaAfterSave) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  const [agenteAduanal, setAgenteAduanal] = useState(agenteAduanalInicial);
  const agenteOk = agenteAduanal.trim().length >= 2;
  const pdfLoaded = docTipos.filter((t) => Boolean(docs[t]?.url)).length;

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
            {pdfLoaded}/{docTipos.length} en PDF
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Régimen: <span className="text-slate-200">{regimenLabel}</span>. A
          presentar: factura, certificado de origen, BL, lista de empaque, póliza
          de seguro, cédula/RIF y DUA (la prepara el agente). Lo que ya cargaste
          en Registro o Embarque sale precargado; lo que falte, cárgalo aquí y
          genera el PDF imprimible
          {docTipos.includes("licencia_importacion_automotriz")
            ? ". Incluye licencia de importación (este régimen la pide)"
            : ""}
          . El pase de salida se carga después, en Pago impuesto (tras la
          liquidación de tributos).
        </p>

        <div className="mt-4">
          <PuertoLibreDescargarDesaduanamientoPdf vehiculoId={vehiculoId} />
        </div>

        <ul className="mt-5 space-y-3">
          {docTipos.map((tipo, index) => (
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

      <label className="block space-y-1.5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <span className="text-sm font-medium text-slate-200">
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
        continueLabel="Continuar a Pago impuesto"
        onAction={(after) => onComplete(agenteAduanal.trim(), after)}
      />
    </div>
  );
}

function FasePagoImpuesto({
  vehiculoId,
  docs,
  setDocs,
  pending,
  canComplete,
  valorCif,
  arancelPct,
  impuestoLujoPct,
  tasaCambioBcv,
  tasaOficialFecha,
  pagoArancelesEstado,
  pagoArancelesUsd,
  pagoArancelesBs,
  partidaArancelaria,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  pending: boolean;
  canComplete: boolean;
  valorCif?: number | null;
  arancelPct?: number | null;
  impuestoLujoPct?: number | null;
  tasaCambioBcv?: number | null;
  tasaOficialFecha?: string | null;
  pagoArancelesEstado?: string | null;
  pagoArancelesUsd?: number | null;
  pagoArancelesBs?: number | null;
  partidaArancelaria?: string | null;
  onComplete: (after: PlanillaAfterSave) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Pago impuesto</h2>
        <p className="mt-2 text-sm text-slate-400">
          Precálculo de aranceles y carga del pago o voucher / liquidación de
          tributos. Luego continúa a Inspección.
        </p>
      </section>

      <PrecalculoArancelesCard
        vehiculoId={vehiculoId}
        valorCif={valorCif}
        arancelPct={arancelPct}
        impuestoLujoPct={impuestoLujoPct}
        tasaCambioBcv={tasaCambioBcv}
        partidaArancelaria={partidaArancelaria}
        onSaved={() => onUploadedMessage("Precálculo de aranceles guardado")}
      />

      <PagoArancelesCard
        vehiculoId={vehiculoId}
        valorCif={valorCif}
        arancelPct={arancelPct}
        impuestoLujoPct={impuestoLujoPct}
        tasaCambioBcv={tasaCambioBcv}
        tasaOficialFecha={tasaOficialFecha}
        pagoArancelesEstado={pagoArancelesEstado}
        pagoArancelesUsd={pagoArancelesUsd}
        pagoArancelesBs={pagoArancelesBs}
        docs={docs}
        setDocs={setDocs}
        onUpdated={() => onUploadedMessage("Tasa oficial actualizada")}
        onUploadedMessage={onUploadedMessage}
      />

      <PlanillaFaseActions
        pending={pending}
        disabled={!canComplete}
        blockedReason={
          canComplete
            ? null
            : "Guarda el precálculo (CIF) y registra el pago o carga el voucher"
        }
        continueLabel="Continuar a Inspección"
        onAction={onComplete}
      />
    </div>
  );
}

function FaseInspeccion({
  vehiculoId,
  serialCarroceria,
  docs,
  setDocs,
  fotosCount,
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
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  serialCarroceria: string | null;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  fotosCount: number;
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
  canForzarImpronta: boolean;
  onComplete: (
    after: PlanillaAfterSave,
    forzarImprontaSinVerificar: boolean
  ) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  const [improntaEstado, setImprontaEstado] = useState(initialImprontaEstado);
  const [improntaLeido, setImprontaLeido] = useState(initialImprontaLeido);
  const [forzarImpronta, setForzarImpronta] = useState(false);

  useEffect(() => {
    setImprontaEstado(initialImprontaEstado);
    setImprontaLeido(initialImprontaLeido);
  }, [initialImprontaEstado, initialImprontaLeido]);

  const expectedSerial = (serialCarroceria ?? "").trim();
  const tieneImpronta = Boolean(docs.foto_impronta?.url);
  const improntaOk = improntaEstado === "coincide";
  const canForce =
    canForzarImpronta &&
    tieneImpronta &&
    (improntaEstado === "no_leido" || improntaEstado == null);
  const llegadaDocsCount = PL_LLEGADA_DOCUMENTO_TIPOS.filter((t) =>
    Boolean(docs[t]?.url)
  ).length;
  const llegadaDocsOk = llegadaDocsCount === PL_LLEGADA_DOCUMENTO_TIPOS.length;
  const memoriaCompleta =
    countDocs(docs, MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS) ===
    MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS.length;
  const cuestionarioCompleto = isLlegadaChecklistCompleto(checklist);
  const constanciaOk = constanciaInspeccionLista(docs);
  const improntaPermiteContinuar =
    !tieneImpronta || improntaOk || (canForce && forzarImpronta);
  const canContinue =
    llegadaDocsOk &&
    memoriaCompleta &&
    cuestionarioCompleto &&
    constanciaOk &&
    !(tieneImpronta && improntaEstado === "no_coincide") &&
    improntaPermiteContinuar;

  const recaudosInspeccion = PL_DESADUANAMIENTO_RESERVADOS.filter(
    (t) =>
      !(PL_LLEGADA_DOCUMENTO_TIPOS as readonly string[]).includes(t) &&
      t !== "planilla_liquidacion_aduanera"
  );
  const recaudosCount = recaudosInspeccion.filter((t) =>
    Boolean(docs[t]?.url)
  ).length;

  return (
    <div className="space-y-6">
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
          Recaudos de inspección
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {recaudosCount}/{recaudosInspeccion.length}
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          SENCAMER, registro de puerto libre, constancia del agente y constancia
          de residencia. Puedes cargarlos ahora o más adelante.
        </p>
        <div className="mt-5 grid gap-3">
          {recaudosInspeccion.map((tipo) => (
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
                onUploadedMessage("Recaudo de inspección guardado");
              }}
            />
          ))}
        </div>
      </section>

      <LlegadaRevisionSections
        vehiculoId={vehiculoId}
        docs={docs}
        setDocs={setDocs}
        fotosCount={fotosCount}
        expectedSerial={expectedSerial}
        improntaEstado={improntaEstado}
        setImprontaEstado={setImprontaEstado}
        improntaLeido={improntaLeido}
        setImprontaLeido={setImprontaLeido}
        forzarImpronta={forzarImpronta}
        setForzarImpronta={setForzarImpronta}
        canForzarImpronta={canForzarImpronta}
        canForce={canForce}
        improntaOk={improntaOk}
        checklist={checklist}
        setChecklist={setChecklist}
        checklistNotas={checklistNotas}
        setChecklistNotas={setChecklistNotas}
        checklistMarked={checklistMarked}
        otrosNotas={otrosNotas}
        setOtrosNotas={setOtrosNotas}
        onUploadedMessage={onUploadedMessage}
      />

      <PostPagoInspeccionCard
        vehiculoId={vehiculoId}
        pagado
        docs={docs}
        setDocs={setDocs}
        onUploadedMessage={onUploadedMessage}
      />

      <RevisionVehiculoPdfCard
        vehiculoId={vehiculoId}
        docs={docs}
        checklistCompleto={cuestionarioCompleto}
        canEdit
        onUploaded={(next) => {
          setDocs(next);
          onUploadedMessage("Revisión guardada en PDF");
        }}
      />

      <PlanillaFaseActions
        pending={pending}
        disabled={!canContinue}
        blockedReason={
          canContinue
            ? null
            : "Completa documentos de llegada, fotos, cuestionario y constancia de inspección"
        }
        continueLabel="Continuar a Propietario"
        onAction={(after) => onComplete(after, forzarImpronta && canForce)}
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

  useEffect(() => {
    setRequiereHomologacion(requiereHomologacionInicial);
  }, [requiereHomologacionInicial]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Archivo INTT — presentación
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {stats.listos}/{stats.total}
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Nueve recaudos, en este orden, precargados del expediente. Completa
          los que falten; la homologación solo si aplica.
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
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
              Si lo marcas, el ítem 5 entra en el archivo.
            </span>
          </span>
        </label>

        <ol className="mt-5 space-y-3">
          {PL_INTT_PRESENTACION_TIPOS.map((tipo, index) => {
            const skipped = tipo === "homologacion" && !requiereHomologacion;
            const ref = inttPresentacionRef(docs, tipo);
            const loaded = Boolean(ref?.url);
            return (
              <li
                key={tipo}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100">
                      {index + 1}. {PL_INTT_PRESENTACION_LABELS[tipo]}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {PL_INTT_PRESENTACION_ORIGEN[tipo] ??
                        "Precargado del expediente"}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      skipped
                        ? "bg-slate-800 text-slate-400"
                        : loaded
                          ? "bg-emerald-950/60 text-emerald-300"
                          : "bg-amber-950/60 text-amber-200"
                    }`}
                  >
                    {skipped
                      ? "No aplica"
                      : loaded
                        ? "En expediente"
                        : "Pendiente"}
                  </span>
                </div>
                {skipped ? null : (
                  <>
                    {loaded && ref?.url ? (
                      <a
                        href={ref.url}
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
                      existingUrl={ref?.url}
                      acceptMode="pdf"
                      hint="PDF · máx. 10 MB"
                      actionLabel={loaded ? "Reemplazar PDF" : "Cargar PDF"}
                      onUploaded={(next) => {
                        setDocs(next);
                        onUploadedMessage("Documento del archivo INTT guardado");
                      }}
                    />
                  </>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-6 space-y-3">
          <PuertoLibreDescargarMatriculacionPdf
            vehiculoId={vehiculoId}
            variant="compact"
          />
          <p className="text-xs text-slate-500">
            El PDF sale con estos recaudos, en este orden, para presentar ante
            el INTT.
          </p>
        </div>
      </section>

      <PlanillaFaseActions
        pending={pending}
        disabled={!carpetaCompleta}
        continueLabel="Continuar a Placa"
        onAction={(after) => onComplete(requiereHomologacion, after)}
      />
    </div>
  );
}

function Fase8EntregaPlaca({
  vehiculoId,
  placaInicial,
  codigoExpediente,
  docs,
  setDocs,
  pending,
  onComplete,
  onUploadedMessage,
}: {
  vehiculoId: string;
  placaInicial: string;
  codigoExpediente?: string | null;
  docs: VehiculosDocumentos;
  setDocs: (d: VehiculosDocumentos) => void;
  pending: boolean;
  onComplete: (after: PlanillaAfterSave, placa: string) => void;
  onUploadedMessage: (msg: string) => void;
}) {
  const [placaInput, setPlacaInput] = useState(
    () => placaRealVisible(placaInicial, codigoExpediente) ?? ""
  );
  const docsListos = PL_ENTREGA_PLACA_TIPOS.filter((t) =>
    Boolean(docs[t]?.url)
  ).length;
  const placaOk = Boolean(placaRealVisible(placaInput, codigoExpediente));
  const completo = docsListos === PL_ENTREGA_PLACA_TIPOS.length && placaOk;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileUp className="h-5 w-5 text-cyan-400" />
          Placa y circulación
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
            {docsListos}/{PL_ENTREGA_PLACA_TIPOS.length}
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Tras presentar el archivo al INTT, registra la placa única del
          vehículo y carga los documentos de circulación. La póliza RCV se
          precarga si ya está en Seguro.
        </p>

        <label className="mt-5 block space-y-1.5">
          <span className="text-sm text-slate-400">
            Placa vehicular (número único) *
          </span>
          <input
            value={placaInput}
            onChange={(e) => setPlacaInput(e.target.value.toUpperCase())}
            autoComplete="off"
            spellCheck={false}
            placeholder="Ej. AB123CD"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm uppercase text-slate-100 outline-none focus:border-cyan-500/60"
          />
        </label>

        <ul className="mt-5 space-y-3">
          {PL_ENTREGA_PLACA_TIPOS.map((tipo) => {
            const loaded = Boolean(docs[tipo]?.url);
            return (
              <li
                key={tipo}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100">
                      {DOCUMENTO_LABELS[tipo]} *
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {PL_ENTREGA_PLACA_ORIGEN[tipo]}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      loaded
                        ? "bg-emerald-950/60 text-emerald-300"
                        : "bg-amber-950/60 text-amber-200"
                    }`}
                  >
                    {loaded ? "En expediente" : "Pendiente"}
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
                    onUploadedMessage("Documento de circulación guardado");
                  }}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <PlanillaFaseActions
        pending={pending}
        disabled={!completo}
        continueLabel="Finalizar y nacionalizar"
        onAction={(after) => onComplete(after, placaInput)}
      />
    </div>
  );
}

