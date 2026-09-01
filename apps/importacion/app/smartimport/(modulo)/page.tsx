import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  BookOpen,
  FileText,
  Plus,
  Presentation,
  Scale,
  Users,
} from "lucide-react";
import {
  listPuertoLibreVehiculos,
  type PuertoLibreVehiculoListItem,
} from "@/app/actions/nfc/importacion-vehiculo";
import { getLlmUsageSummaryAction } from "@/app/actions/nfc/llm-usage";
import { listPortalVehiculosAction } from "@/app/actions/portal";
import { listUsuarioVehiculoIdsAction } from "@/app/actions/vehiculo-compartidos";
import {
  PuertoLibreDashboardBucket,
  type DashboardBucketRow,
} from "@/components/nfc/PuertoLibreDashboardBucket";
import { PuertoLibreDashboardTodosList } from "@/components/nfc/PuertoLibreDashboardTodosList";
import { LlmUsagePanel } from "@/components/nfc/LlmUsagePanel";
import {
  canAccessAllImportacionData,
  isImportacionUsuarioOnly,
  isTallerOrConcesionario,
} from "@/lib/importacion/access";
import {
  compareExpedientesAsc,
  placaRealVisible,
  resolveCodigoExpediente,
} from "@/lib/importacion/expediente";
import {
  DASHBOARD_COLA_EMBARQUE_ID,
  DASHBOARD_COLA_LLEGADA_ID,
  DASHBOARD_COLA_MATRICULA_ID,
  DASHBOARD_COLA_PLACA_ID,
  DASHBOARD_COLA_PROPIETARIO_ID,
  DASHBOARD_COLA_SEGURO_ID,
} from "@/lib/importacion/paths";
import {
  hrefNacionalizar,
  hrefPresentacionSeniat,
  nacionalizarAccionLabel,
  seniatAccionLabel,
} from "@/lib/importacion/planilla-en-construccion";
import { listPropietariosAction } from "@/app/actions/nfc/propietarios";
import { listSegurosAction } from "@/app/actions/nfc/seguros";
import { listMatriculasAction } from "@/app/actions/nfc/matriculas";
import { FichaColaResumen } from "@/components/nfc/FichaColaResumen";
import { resolvePortalAccess } from "@/lib/portal/roles";
import { resolverFechaLimiteNacionalizacion } from "@/lib/importacion/alerta-nacionalizacion";
import {
  diasHasta,
  esProximoNacionalizar,
  esProximoSeniat,
  parseImportacion,
} from "@/lib/schemas/vehiculo-documentos";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser, getMyTaller } from "@/lib/taller";
import { cargaBlPath } from "@/lib/importacion/expediente-lote";
import {
  collapseColaPorBl,
  fechaLlegadaCargaBl,
  fichaHomogeneaBl,
  latestIso,
  lineasMercanciaBl,
  mercanciaDelMismoBl,
  resumenUnidadesBl,
} from "@/lib/importacion/dashboard-cola-bl";
import {
  completarEtapaLabel,
  porCompletarEtapaTitle,
} from "@/lib/importacion/dashboard-completar-etapa";
import {
  dashboardFichaIdentidad,
  dashboardFichaSearchText,
} from "@/lib/importacion/dashboard-ficha";
import {
  esEnColaEmbarque,
  esEntregaPlacaListaEnDashboard,
  esNacionalizado,
  placaAccionLabel,
  esPorCompletarEtapa,
  esPorPresentacionSeniat,
  esRechazadoSeniat,
  faseColaPlanilla,
  registroAccionLabel,
  type PlanillaFasePendiente,
} from "@/lib/importacion/dashboard-clasificacion";

export const dynamic = "force-dynamic";

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

/** Ej. "23 marzo 09:30" */
function formatFechaHoraCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dia = d.getDate();
  const mes = MESES_ES[d.getMonth()] ?? "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dia} ${mes} ${hh}:${mm}`;
}

/** Fecha YYYY-MM-DD → "30 julio 2026" */
function formatFechaDia(isoDate: string | null): string {
  if (!isoDate?.trim()) return "Sin fecha";
  const parts = isoDate.trim().slice(0, 10).split("-");
  if (parts.length !== 3) return isoDate;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return isoDate;
  const mes = MESES_ES[month - 1] ?? "";
  return `${day} ${mes} ${year}`;
}

/** Solo nomenclatura PL-Año.Mes.Número (ej. PL-2026.7.1). */
function labelExpediente(v: PuertoLibreVehiculoListItem): string {
  return v.codigoExpediente ?? "—";
}

function labelVehiculo(v: PuertoLibreVehiculoListItem): string {
  const marca =
    v.marca && !/^POR-COMPLETAR$/i.test(v.marca) ? v.marca : null;
  const modelo =
    v.modelo && !/^POR-COMPLETAR$/i.test(v.modelo) ? v.modelo : null;
  const color =
    v.color && !/^POR-COMPLETAR$/i.test(v.color) ? v.color : null;
  const marcaModelo = [marca, modelo].filter(Boolean).join(" ");
  if (marcaModelo && color) return `${marcaModelo} ${color}`;
  return marcaModelo || color || "Datos pendientes";
}

function fichaDe(v: PuertoLibreVehiculoListItem) {
  return dashboardFichaIdentidad({
    marca: v.marca,
    modelo: v.modelo,
    color: v.color,
    vin: v.vin,
  });
}

function completitudTone(
  nivel: PuertoLibreVehiculoListItem["completitudDatos"]
): "cyan" | "red" | "amber" {
  if (nivel === "rojo") return "red";
  if (nivel === "ambar") return "amber";
  return "cyan";
}

function completitudDot(nivel: PuertoLibreVehiculoListItem["completitudDatos"]): string {
  if (nivel === "rojo") return "●";
  if (nivel === "ambar") return "●";
  if (nivel === "verde") return "●";
  return "";
}

function sortPorExpediente(items: PuertoLibreVehiculoListItem[]) {
  return [...items].sort(compareExpedientesAsc);
}

function completarHref(v: PuertoLibreVehiculoListItem): string {
  const f = faseColaPlanilla(v);
  if (f === 8) return `/smartimport/${v.id}/planilla?fase=8`;
  if (f >= 7) return `/smartimport/matriculas?expediente=${v.id}`;
  if (f === 6) return `/smartimport/seguros?expediente=${v.id}`;
  if (f === 5) return `/smartimport/propietarios?expediente=${v.id}`;
  if (f === 4) return `/smartimport/${v.id}/planilla?fase=4`;
  if (f === 3) return `/smartimport/${v.id}/planilla?fase=3`;
  if (f === 2) return cargaBlPath(v.numeroBl, v.id);
  return `/smartimport/${v.id}/planilla?fase=1`;
}

function rowPorCompletarFase(
  v: PuertoLibreVehiculoListItem,
  fase: PlanillaFasePendiente
): DashboardBucketRow {
  const expediente = labelExpediente(v);
  const ficha = fichaDe(v);
  const modificadoIso = (v.updated_at ?? v.created_at).slice(0, 10);
  return {
    id: v.id,
    href: completarHref(v),
    cells: {
      expediente,
      modificado: formatFechaHoraCorta(v.updated_at ?? v.created_at),
    },
    ficha,
    dateValue: modificadoIso || null,
    searchText: `${expediente} ${dashboardFichaSearchText(ficha)} ${v.nombre_cliente ?? ""} fase ${fase}`,
    actionLabel:
      fase === 8
        ? placaAccionLabel(esEntregaPlacaListaEnDashboard(v))
        : completarEtapaLabel(fase),
    actionTone: "cyan",
  };
}

function rowLlegadaUnidad(v: PuertoLibreVehiculoListItem): DashboardBucketRow {
  const expediente = labelExpediente(v);
  const ficha = fichaDe(v);
  return {
    id: v.id,
    href: `/smartimport/${v.id}/planilla?fase=3`,
    cells: {
      expediente,
      llegada: formatFechaDia(v.fechaLlegadaBuque),
    },
    ficha,
    dateValue: v.fechaLlegadaBuque,
    searchText: `${expediente} ${dashboardFichaSearchText(ficha)} ${v.nombre_cliente ?? ""}`,
    actionLabel: completarEtapaLabel(3),
    actionTone: "cyan",
  };
}

function rowColaGrupoBl(
  blKey: string,
  label: string,
  items: PuertoLibreVehiculoListItem[],
  opts?: {
    cola?: 2 | 3;
    actionLabel?: string;
    lineaHref?: (id: string) => string;
  }
): DashboardBucketRow {
  const cola = opts?.cola ?? 2;
  const sorted = [...items];
  const ficha = fichaHomogeneaBl(sorted);
  const mercancia = lineasMercanciaBl(sorted);
  const resumen = resumenUnidadesBl(sorted);
  const modificadoIso = latestIso(sorted).slice(0, 10);
  const searchMercancia = mercancia.map((m) => m.searchText).join(" ");
  const yaEnLlegada = sorted.every((item) => faseColaPlanilla(item) >= 3);
  const lineaHref =
    opts?.lineaHref ?? ((id: string) => `/smartimport/${id}`);
  const href =
    (cola === 3 || yaEnLlegada) && sorted[0]
      ? `/smartimport/${sorted[0].id}/planilla?fase=3`
      : cargaBlPath(blKey);
  return {
    id: `bl-${cola}-${blKey}`,
    href,
    cells: {
      expediente: `BL ${label}`,
      modificado: formatFechaHoraCorta(latestIso(sorted)),
      llegada: formatFechaDia(fechaLlegadaCargaBl(sorted)),
    },
    ficha,
    lineas: mercancia.map((m) => ({
      href: lineaHref(m.id),
      titulo: m.expediente,
      detalle: m.detalle || undefined,
    })),
    subcells: { expediente: resumen },
    dateValue:
      cola === 3
        ? fechaLlegadaCargaBl(sorted)
        : modificadoIso || null,
    searchText: `BL ${label} ${resumen} ${searchMercancia}`,
    actionLabel:
      opts?.actionLabel ??
      (yaEnLlegada ? completarEtapaLabel(3) : completarEtapaLabel(2)),
    actionTone: "cyan",
  };
}

function rowsColaEmbarque(
  items: PuertoLibreVehiculoListItem[],
  todos?: PuertoLibreVehiculoListItem[]
): DashboardBucketRow[] {
  const catalogo = todos ?? items;
  return collapseColaPorBl(items).map((group) => {
    if (group.kind === "bl") {
      const mercancia = mercanciaDelMismoBl(group.blKey, catalogo);
      return rowColaGrupoBl(
        group.blKey,
        group.label,
        mercancia.length > 0 ? mercancia : group.items,
        { cola: 2 }
      );
    }
    return rowPorCompletarFase(group.item, 2);
  });
}

function rowsColaLlegada(
  items: PuertoLibreVehiculoListItem[],
  todos?: PuertoLibreVehiculoListItem[]
): DashboardBucketRow[] {
  const catalogo = todos ?? items;
  return collapseColaPorBl(items, { sort: "llegada" }).map((group) => {
    if (group.kind === "bl") {
      const mercancia = mercanciaDelMismoBl(group.blKey, catalogo).filter(
        (v) => esPorCompletarEtapa(v, 3)
      );
      return rowColaGrupoBl(
        group.blKey,
        group.label,
        mercancia.length > 0 ? mercancia : group.items,
        {
          cola: 3,
          actionLabel: completarEtapaLabel(3),
          lineaHref: (id) => `/smartimport/${id}/planilla?fase=3`,
        }
      );
    }
    return rowLlegadaUnidad(group.item);
  });
}

function etiquetaDias(dias: number | null, sinFecha: string) {
  if (dias == null) return sinFecha;
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} d`;
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

function sortByFechaAsc(
  items: PuertoLibreVehiculoListItem[],
  getFecha: (v: PuertoLibreVehiculoListItem) => string | null,
  getDias: (v: PuertoLibreVehiculoListItem) => number | null
) {
  return [...items].sort((a, b) => {
    const da = getDias(a);
    const db = getDias(b);
    if (da == null && db == null) {
      const fa = getFecha(a) ?? "9999";
      const fb = getFecha(b) ?? "9999";
      return fa.localeCompare(fb);
    }
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db;
  });
}

async function loadVehiculosForImportacion(
  userId: string
): Promise<
  | { ok: true; vehiculos: PuertoLibreVehiculoListItem[]; error?: undefined }
  | { ok: false; vehiculos: []; error: string }
> {
  const access = await resolvePortalAccess();
  if (!access) {
    return { ok: false, vehiculos: [], error: "No autenticado" };
  }

  if (canAccessAllImportacionData(access) || access.roles.includes("admin")) {
    const role = access.roles.includes("master")
      ? "master"
      : access.roles.includes("admin")
        ? "admin"
        : "aduanera";
    const portal = await listPortalVehiculosAction(role);
    if (!portal.success) {
      return { ok: false, vehiculos: [], error: portal.error };
    }
    return {
      ok: true,
      vehiculos: portal.vehiculos.map(
        (v): PuertoLibreVehiculoListItem => ({
          id: v.id,
          placa: v.placa ?? "",
          vin: v.serialCarroceria,
          marca: v.marca,
          modelo: v.modelo,
          color: v.color,
          nombre_cliente: v.nombreCliente,
          telefono_cliente: v.telefonoCliente,
          kilometraje_ultimo: null,
          created_at: v.createdAt,
          updated_at: null,
          tienePin: false,
          docsCount: 0,
          docsFaltantes: 0,
          planillaFase: v.planillaFase,
          fechaLlegadaBuque: v.fechaLlegadaBuque,
          fechaIngreso: v.fechaIngreso,
          numeroBl: v.numeroBl,
          stickerToken: null,
          regimen: v.regimen,
          estadoNacionalizacion: v.estadoNacionalizacion,
          fechaLimiteNacionalizacion: v.fechaLimiteNacionalizacion,
          estadoSeniat: v.estadoSeniat,
          fechaPresentacionSeniat: v.fechaPresentacionSeniat,
          fechaRechazoSeniat: v.fechaRechazoSeniat,
          motivoRechazoSeniat: v.motivoRechazoSeniat,
          diasNacionalizacion: diasHasta(
            v.fechaLimiteNacionalizacion ??
              (v.fechaIngreso
                ? resolverFechaLimiteNacionalizacion({
                    fechaIngreso: v.fechaIngreso,
                    fechaLimiteNacionalizacion: v.fechaLimiteNacionalizacion,
                    regimen: v.regimen,
                  })
                : null)
          ),
          diasSeniat: diasHasta(v.fechaPresentacionSeniat),
          proximoNacionalizar: esProximoNacionalizar({
            planillaFase: v.planillaFase,
            estadoNacionalizacion: v.estadoNacionalizacion as
              | "pendiente"
              | "en_proceso"
              | "nacionalizado"
              | "no_aplica"
              | null
              | undefined,
          }),
          proximoSeniat: esProximoSeniat({
            estadoSeniat: v.estadoSeniat as
              | "pendiente"
              | "agendada"
              | "presentada"
              | "rechazada"
              | "no_aplica"
              | null
              | undefined,
          }),
          rechazadoSeniat: v.estadoSeniat === "rechazada",
          codigoExpediente: v.codigoExpediente,
          fotoUrl: null,
          completitudDatos: null,
          datosPendientes: [],
          registroCompleto: false,
          entregaPlacaCompleta: false,
        })
      ),
    };
  }

  if (isTallerOrConcesionario(access)) {
    const taller = access.tallerPropio ?? (await getMyTaller());
    if (!taller) {
      const ensured = await ensureTallerForUser(userId);
      if (!ensured.taller) {
        return {
          ok: false,
          vehiculos: [],
          error: ensured.error ?? "No se pudo cargar tu taller.",
        };
      }
    }
    const list = await listPuertoLibreVehiculos();
    if (!list.success) {
      return { ok: false, vehiculos: [], error: list.error };
    }
    return { ok: true, vehiculos: list.vehiculos };
  }

  if (isImportacionUsuarioOnly(access)) {
    const idsRes = await listUsuarioVehiculoIdsAction();
    if (!idsRes.success) {
      return { ok: false, vehiculos: [], error: idsRes.error };
    }
    if (idsRes.vehiculoIds.length === 0) {
      return { ok: true, vehiculos: [] };
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("vehiculos")
      .select(
        "id, placa, serial_carroceria, marca, modelo, color, nombre_cliente, telefono_cliente, kilometraje_ultimo, created_at, importacion"
      )
      .in("id", idsRes.vehiculoIds)
      .order("created_at", { ascending: false });
    if (error) {
      return { ok: false, vehiculos: [], error: error.message };
    }
    return {
      ok: true,
      vehiculos: (data ?? [])
        .map((row): PuertoLibreVehiculoListItem => {
          const imp = parseImportacion(row.importacion);
          const placaRaw = (row.placa as string | null) ?? "";
          const codigoExpediente = resolveCodigoExpediente({
            codigoExpediente: imp.codigoExpediente,
            placa: placaRaw,
          });
          return {
            id: row.id as string,
            placa: placaRealVisible(placaRaw, codigoExpediente) ?? placaRaw ?? "",
            vin: (row.serial_carroceria as string | null) ?? null,
            marca: (row.marca as string | null) ?? null,
            modelo: (row.modelo as string | null) ?? null,
            color: (row.color as string | null) ?? null,
            nombre_cliente: (row.nombre_cliente as string | null) ?? null,
            telefono_cliente: (row.telefono_cliente as string | null) ?? null,
            kilometraje_ultimo:
              typeof row.kilometraje_ultimo === "number"
                ? row.kilometraje_ultimo
                : null,
            created_at: String(row.created_at ?? ""),
            updated_at: null,
            tienePin: false,
            docsCount: 0,
            docsFaltantes: 0,
            planillaFase: imp.planillaFase ?? null,
            fechaLlegadaBuque: imp.fechaLlegadaBuque ?? null,
            fechaIngreso: imp.fechaIngreso ?? null,
            numeroBl: imp.numeroBl ?? null,
            stickerToken: null,
            regimen: imp.regimen ?? null,
            estadoNacionalizacion: imp.estadoNacionalizacion ?? null,
            fechaLimiteNacionalizacion:
              resolverFechaLimiteNacionalizacion(imp) ??
              imp.fechaLimiteNacionalizacion ??
              null,
            estadoSeniat: imp.estadoSeniat ?? null,
            fechaPresentacionSeniat: imp.fechaPresentacionSeniat ?? null,
            fechaRechazoSeniat: imp.fechaRechazoSeniat ?? null,
            motivoRechazoSeniat: imp.motivoRechazoSeniat ?? null,
            diasNacionalizacion: diasHasta(
              resolverFechaLimiteNacionalizacion(imp)
            ),
            diasSeniat: diasHasta(imp.fechaPresentacionSeniat),
            proximoNacionalizar: esProximoNacionalizar(imp),
            proximoSeniat: esProximoSeniat(imp),
            rechazadoSeniat: (imp.estadoSeniat ?? "pendiente") === "rechazada",
            codigoExpediente,
            fotoUrl: null,
            completitudDatos: imp.completitudDatos ?? null,
            datosPendientes: imp.datosPendientes ?? [],
            registroCompleto: false,
            entregaPlacaCompleta: false,
          };
        })
        .sort(compareExpedientesAsc),
    };
  }

  return {
    ok: false,
    vehiculos: [],
    error: "No tienes un rol válido para este módulo.",
  };
}

export default async function PuertoLibrePage() {
  const user = await getUser();
  if (!user) redirect("/smartimport/login?redirectTo=/smartimport");

  const loaded = await loadVehiculosForImportacion(user.id);
  if (!loaded.ok) {
    return (
      <PuertoLibreShell>
        <div className="rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {loaded.error}
        </div>
      </PuertoLibreShell>
    );
  }

  const access = await resolvePortalAccess();
  const puedeMutar =
    access != null &&
    !isImportacionUsuarioOnly(access) &&
    (canAccessAllImportacionData(access) ||
      isTallerOrConcesionario(access) ||
      access.roles.includes("admin"));

  const llmUsage =
    puedeMutar && isTallerOrConcesionario(access!)
      ? await getLlmUsageSummaryAction()
      : null;

  const vehiculos = loaded.vehiculos;
  const propietariosListed = await listPropietariosAction();
  const propietarios = propietariosListed.success
    ? propietariosListed.propietarios
    : [];
  const [segurosListed, matriculasListed] = await Promise.all([
    listSegurosAction(),
    listMatriculasAction(),
  ]);
  const seguros = segurosListed.success ? segurosListed.fichas : [];
  const matriculas = matriculasListed.success ? matriculasListed.fichas : [];
  const porRegistro = sortPorExpediente(
    vehiculos.filter((v) => esPorCompletarEtapa(v, 1))
  );
  const porEmbarque = sortPorExpediente(
    vehiculos.filter((v) => esEnColaEmbarque(v))
  );
  const porRecibir = sortPorExpediente(
    vehiculos.filter((v) => esPorCompletarEtapa(v, 3))
  );
  const porNacionalizar = sortByFechaAsc(
    vehiculos.filter((v) => v.proximoNacionalizar),
    (v) => v.fechaLimiteNacionalizacion,
    (v) => v.diasNacionalizacion
  );
  const porSeniat = sortByFechaAsc(
    vehiculos.filter(esPorPresentacionSeniat),
    (v) => v.fechaPresentacionSeniat,
    (v) => v.diasSeniat
  );
  const rechazadosSeniat = [...vehiculos.filter(esRechazadoSeniat)].sort(
    (a, b) => {
      const fa = a.fechaRechazoSeniat ?? "";
      const fb = b.fechaRechazoSeniat ?? "";
      return fb.localeCompare(fa);
    }
  );
  const nacionalizados = [...vehiculos.filter(esNacionalizado)].sort((a, b) =>
    (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at)
  );

  const rowsPorRegistro: DashboardBucketRow[] = porRegistro.map((v) => {
    const expediente = labelExpediente(v);
    const ficha = fichaDe(v);
    const pend =
      v.datosPendientes.length > 0
        ? `Falta: ${v.datosPendientes.slice(0, 4).join(", ")}`
        : v.completitudDatos === "verde"
          ? "Datos del vehículo listos"
          : undefined;
    return {
      id: v.id,
      href: `/smartimport/${v.id}/planilla?fase=1`,
      cells: {
        expediente: v.completitudDatos
          ? `${completitudDot(v.completitudDatos)} ${expediente}`
          : expediente,
        accion: registroAccionLabel(v.completitudDatos),
      },
      ficha,
      subcells: pend ? { expediente: pend } : undefined,
      searchText: `${expediente} ${dashboardFichaSearchText(ficha)} ${v.nombre_cliente ?? ""} ${v.datosPendientes.join(" ")}`,
      actionLabel: registroAccionLabel(v.completitudDatos),
      actionTone: completitudTone(v.completitudDatos),
    };
  });

  const rowsPorEmbarque: DashboardBucketRow[] = rowsColaEmbarque(
    porEmbarque,
    vehiculos
  );

  const rowsPorRecibir: DashboardBucketRow[] = rowsColaLlegada(
    porRecibir,
    vehiculos
  );

  const rowsPorDesaduanamiento: DashboardBucketRow[] = sortPorExpediente(
    vehiculos.filter((v) => esPorCompletarEtapa(v, 4))
  ).map((v) => rowPorCompletarFase(v, 4));
  const rowsPorPropietario: DashboardBucketRow[] = sortPorExpediente(
    vehiculos.filter((v) => esPorCompletarEtapa(v, 5))
  ).map((v) => rowPorCompletarFase(v, 5));
  const rowsPorSeguro: DashboardBucketRow[] = sortPorExpediente(
    vehiculos.filter((v) => esPorCompletarEtapa(v, 6))
  ).map((v) => rowPorCompletarFase(v, 6));
  const rowsPorMatricula: DashboardBucketRow[] = sortPorExpediente(
    vehiculos.filter((v) => esPorCompletarEtapa(v, 7))
  ).map((v) => rowPorCompletarFase(v, 7));
  const rowsPorPlaca: DashboardBucketRow[] = sortPorExpediente(
    vehiculos.filter((v) => esPorCompletarEtapa(v, 8))
  ).map((v) => rowPorCompletarFase(v, 8));

  const rowsRechazados: DashboardBucketRow[] = rechazadosSeniat.map((v) => {
    const expediente = labelExpediente(v);
    const ficha = fichaDe(v);
    return {
      id: v.id,
      href: `/smartimport/${v.id}`,
      cells: {
        expediente,
        rechazo: formatFechaDia(v.fechaRechazoSeniat?.slice(0, 10) ?? null),
      },
      ficha,
      subcells: v.motivoRechazoSeniat
        ? { expediente: v.motivoRechazoSeniat }
        : undefined,
      dateValue: v.fechaRechazoSeniat?.slice(0, 10) ?? null,
      searchText: `${expediente} ${dashboardFichaSearchText(ficha)} ${v.motivoRechazoSeniat ?? ""} ${v.nombre_cliente ?? ""}`,
      actionLabel: "Corregir",
      actionTone: "red",
    };
  });

  const rowsPorSeniat: DashboardBucketRow[] = porSeniat.map((v) => {
    const expediente = labelExpediente(v);
    const ficha = fichaDe(v);
    return {
      id: v.id,
      href: hrefPresentacionSeniat(v.id),
      cells: {
        expediente,
        presentacion: formatFechaDia(v.fechaPresentacionSeniat),
      },
      ficha,
      subcells: {
        presentacion: etiquetaDias(v.diasSeniat, "Sin fecha"),
      },
      dateValue: v.fechaPresentacionSeniat,
      searchText: `${expediente} ${dashboardFichaSearchText(ficha)} ${v.nombre_cliente ?? ""}`,
      actionLabel: seniatAccionLabel(),
      actionTone: "sky",
      urgent: v.diasSeniat != null && v.diasSeniat <= 7,
    };
  });

  const rowsPorNacionalizar: DashboardBucketRow[] = porNacionalizar.map((v) => {
    const expediente = labelExpediente(v);
    const ficha = fichaDe(v);
    return {
      id: v.id,
      href: hrefNacionalizar(v.id),
      cells: {
        expediente,
        limite: formatFechaDia(v.fechaLimiteNacionalizacion),
      },
      ficha,
      subcells: {
        limite: etiquetaDias(
          v.diasNacionalizacion,
          "Límite 3 años (permanencia)"
        ),
      },
      dateValue: v.fechaLimiteNacionalizacion,
      searchText: `${expediente} ${dashboardFichaSearchText(ficha)} ${v.nombre_cliente ?? ""}`,
      actionLabel: nacionalizarAccionLabel(),
      actionTone: "amber",
      urgent:
        v.diasNacionalizacion != null &&
        v.diasNacionalizacion <= 30,
    };
  });

  const rowsNacionalizados: DashboardBucketRow[] = nacionalizados.map((v) => {
    const expediente = labelExpediente(v);
    const ficha = fichaDe(v);
    return {
      id: v.id,
      href: `/smartimport/${v.id}`,
      cells: {
        expediente,
        modificado: formatFechaHoraCorta(v.updated_at ?? v.created_at),
      },
      ficha,
      dateValue: (v.updated_at ?? v.created_at).slice(0, 10),
      searchText: `${expediente} ${dashboardFichaSearchText(ficha)} ${v.nombre_cliente ?? ""}`,
      actionLabel: "Ver",
      actionTone: "cyan",
    };
  });

  return (
    <PuertoLibreShell>
      <header className="mb-3 space-y-3">
        <div className="flex items-center gap-1.5">
          <h1 className="smartimport-page-title min-w-0 flex-1 text-zinc-50">
            Expediente de Importación Vehicular
          </h1>
        </div>
        {puedeMutar ? (
          <div className="space-y-2">
            <div className="grid w-full grid-cols-3 gap-1.5">
              <Link
                href="/smartimport/clientes"
                className="inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-950/50 px-1.5 py-2.5 text-center text-[11px] font-medium leading-tight text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-100 sm:flex-row sm:gap-1.5 sm:text-xs"
              >
                <Users className="h-4 w-4 shrink-0 text-cyan-400" />
                <span className="truncate">Clientes</span>
              </Link>
              <Link
                href="/smartimport/importaciones/nueva"
                className="inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-cyan-600 px-1.5 py-2.5 text-center text-[11px] font-semibold leading-tight text-white shadow-[0_8px_24px_rgba(8,145,178,0.28)] transition hover:bg-cyan-500 sm:flex-row sm:gap-1.5 sm:text-xs"
              >
                <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span className="truncate">Importación</span>
              </Link>
              <Link
                href="/smartimport/biblioteca-legal"
                className="inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-950/50 px-1.5 py-2.5 text-center text-[11px] font-medium leading-tight text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-100 sm:flex-row sm:gap-1.5 sm:text-xs"
              >
                <Scale className="h-4 w-4 shrink-0 text-cyan-400" />
                <span className="truncate">Biblioteca</span>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Link
                href="/smartimport/instructivo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-500/30 hover:text-cyan-100"
              >
                <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                Instructivo
              </Link>
              <Link
                href="/smartimport/demo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-500/30 hover:text-cyan-100"
              >
                <Presentation className="h-3.5 w-3.5 text-cyan-400" />
                Demo
              </Link>
              <Link
                href="/smartimport/lote"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-500/30 hover:text-cyan-100"
              >
                <FileText className="h-3.5 w-3.5 text-cyan-400" />
                Docs de carga
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-500">
              Vista de solo lectura: vehículos de tu propiedad o compartidos contigo.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/smartimport/instructivo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-100"
              >
                <BookOpen className="h-4 w-4 text-cyan-400" />
                Instructivo
              </Link>
              <Link
                href="/smartimport/biblioteca-legal"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-100"
              >
                <Scale className="h-4 w-4 text-cyan-400" />
                Biblioteca
              </Link>
            </div>
          </div>
        )}
      </header>

      <div className="min-w-0 divide-y divide-zinc-800/70 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
        <PuertoLibreDashboardBucket
          dense
          title={porCompletarEtapaTitle(1)}
          icon="file"
          emptyMessage={`No hay vehículos ${porCompletarEtapaTitle(1).toLowerCase()}.`}
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 2.4 },
            { key: "accion", header: "Acción", pdfWidth: 0.8 },
          ]}
          rows={rowsPorRegistro}
          actionColumnKey="accion"
          defaultExpedienteSort="asc"
        />

        <PuertoLibreDashboardBucket
          dense
          sectionId={DASHBOARD_COLA_EMBARQUE_ID}
          title={porCompletarEtapaTitle(2)}
          icon="file"
          emptyMessage="No hay cargas por completar embarque. Al guardar un BL se queda aquí; al cerrarlo aparece una copia en llegada."
          columns={[
            { key: "expediente", header: "BL / expediente", pdfWidth: 2.4 },
            { key: "modificado", header: "Modificado", pdfWidth: 1.2 },
          ]}
          rows={rowsPorEmbarque}
          dateFilterLabel="Modificado"
          actionColumnKey="modificado"
          defaultExpedienteSort="asc"
          defaultOpen={rowsPorEmbarque.length > 0}
          searchPlaceholder="Filtrar BL, expediente, VIN, marca…"
        />

        <PuertoLibreDashboardBucket
          dense
          sectionId={DASHBOARD_COLA_LLEGADA_ID}
          title={porCompletarEtapaTitle(3)}
          icon="ship"
          emptyMessage="No hay cargas por completar llegada. Al cerrar el embarque pasan aquí."
          defaultOpen={rowsPorRecibir.length > 0}
          columns={[
            { key: "expediente", header: "BL / expediente", pdfWidth: 2.4 },
            { key: "llegada", header: "Llegada", pdfWidth: 1.2 },
          ]}
          rows={rowsPorRecibir}
          dateFilterLabel="Llegada"
          actionColumnKey="llegada"
        />

        <PuertoLibreDashboardBucket
          dense
          title={porCompletarEtapaTitle(4)}
          icon="file"
          emptyMessage={`No hay vehículos ${porCompletarEtapaTitle(4).toLowerCase()}.`}
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 2.4 },
            { key: "modificado", header: "Modificado", pdfWidth: 1.2 },
          ]}
          rows={rowsPorDesaduanamiento}
          dateFilterLabel="Modificado"
          actionColumnKey="modificado"
          defaultExpedienteSort="asc"
        />

        <PuertoLibreDashboardBucket
          dense
          sectionId={DASHBOARD_COLA_PROPIETARIO_ID}
          title={porCompletarEtapaTitle(5)}
          icon="file"
          emptyMessage="No hay expedientes por completar propietario. Crea una ficha y asígnale un expediente."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 2.4 },
            { key: "modificado", header: "Modificado", pdfWidth: 1.2 },
          ]}
          rows={rowsPorPropietario}
          dateFilterLabel="Modificado"
          actionColumnKey="modificado"
          defaultExpedienteSort="asc"
          headerActions={
            puedeMutar ? (
              <Link
                href="/smartimport/propietarios/nueva"
                className="inline-flex items-center rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-2 py-1 text-[11px] font-medium text-cyan-200 hover:border-cyan-500/60"
              >
                Nueva ficha
              </Link>
            ) : null
          }
          leadingContent={
            propietarios.length > 0 ? (
              <ul className="space-y-1.5">
                {propietarios.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/smartimport/propietarios/${p.id}`}
                      className="block rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-1.5 hover:border-cyan-700/40"
                    >
                      <span className="text-sm text-zinc-100">{p.nombre}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-zinc-400">
                        {p.cedula || "Sin cédula"}
                        {" · "}
                        {p.expedientesCount} expediente
                        {p.expedientesCount === 1 ? "" : "s"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500">
                Crea una ficha de propietario y asígnale un expediente.
              </p>
            )
          }
        />

        <PuertoLibreDashboardBucket
          dense
          sectionId={DASHBOARD_COLA_SEGURO_ID}
          title={porCompletarEtapaTitle(6)}
          icon="file"
          emptyMessage="No hay expedientes por completar seguro. Crea una ficha y enlázala."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 2.4 },
            { key: "modificado", header: "Modificado", pdfWidth: 1.2 },
          ]}
          rows={rowsPorSeguro}
          dateFilterLabel="Modificado"
          actionColumnKey="modificado"
          defaultExpedienteSort="asc"
          headerActions={
            puedeMutar ? (
              <Link
                href="/smartimport/seguros/nueva"
                className="inline-flex items-center rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-2 py-1 text-[11px] font-medium text-cyan-200 hover:border-cyan-500/60"
              >
                Nueva ficha
              </Link>
            ) : null
          }
          leadingContent={
            <FichaColaResumen
              items={seguros.map((s) => ({
                id: s.id,
                titulo: s.aseguradora,
                detalle: `${s.numeroPoliza || "Sin póliza"} · ${s.expedientesCount} expediente${s.expedientesCount === 1 ? "" : "s"}`,
              }))}
              hrefFor={(id) => `/smartimport/seguros/${id}`}
              emptyText="Crea una ficha de seguro y asígnale un expediente."
            />
          }
        />

        <PuertoLibreDashboardBucket
          dense
          sectionId={DASHBOARD_COLA_MATRICULA_ID}
          title={porCompletarEtapaTitle(7)}
          icon="file"
          emptyMessage="No hay expedientes por completar matrícula. Crea una ficha y enlázala."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 2.4 },
            { key: "modificado", header: "Modificado", pdfWidth: 1.2 },
          ]}
          rows={rowsPorMatricula}
          dateFilterLabel="Modificado"
          actionColumnKey="modificado"
          defaultExpedienteSort="asc"
          headerActions={
            puedeMutar ? (
              <Link
                href="/smartimport/matriculas/nueva"
                className="inline-flex items-center rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-2 py-1 text-[11px] font-medium text-cyan-200 hover:border-cyan-500/60"
              >
                Nueva ficha
              </Link>
            ) : null
          }
          leadingContent={
            <FichaColaResumen
              items={matriculas.map((m) => ({
                id: m.id,
                titulo: m.placa || "Sin placa",
                detalle: `${m.oficinaIntt || "Sin oficina"} · ${m.expedientesCount} expediente${m.expedientesCount === 1 ? "" : "s"}`,
              }))}
              hrefFor={(id) => `/smartimport/matriculas/${id}`}
              emptyText="Crea una ficha de matrícula y asígnale un expediente."
            />
          }
        />

        <PuertoLibreDashboardBucket
          dense
          sectionId={DASHBOARD_COLA_PLACA_ID}
          title={porCompletarEtapaTitle(8)}
          icon="file"
          emptyMessage="No hay expedientes por completar placa y título."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 2.4 },
            { key: "modificado", header: "Modificado", pdfWidth: 1.2 },
          ]}
          rows={rowsPorPlaca}
          dateFilterLabel="Modificado"
          actionColumnKey="modificado"
          defaultExpedienteSort="asc"
        />

        <PuertoLibreDashboardBucket
          dense
          title="Por presentación SENIAT"
          icon="building"
          emptyMessage="No hay presentaciones SENIAT pendientes o agendadas."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 2.4 },
            { key: "presentacion", header: "Presentación", pdfWidth: 1.3 },
          ]}
          rows={rowsPorSeniat}
          dateFilterLabel="Presentación"
          borderClassName="border-sky-900/30"
          actionColumnKey="presentacion"
        />

        <PuertoLibreDashboardBucket
          dense
          title="Rechazados SENIAT"
          icon="alert"
          emptyMessage="No hay expedientes con rechazo SENIAT pendiente de corrección."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 2.6 },
            { key: "rechazo", header: "Rechazo", pdfWidth: 1 },
          ]}
          rows={rowsRechazados}
          dateFilterLabel="Rechazo"
          borderClassName="border-red-900/30"
          actionColumnKey="rechazo"
        />

        <PuertoLibreDashboardBucket
          dense
          title="Por nacionalizar"
          icon="flag"
          emptyMessage="No hay vehículos pendientes de nacionalización."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 2.4 },
            { key: "limite", header: "Límite", pdfWidth: 1.3 },
          ]}
          rows={rowsPorNacionalizar}
          dateFilterLabel="Límite"
          borderClassName="border-amber-900/30"
          actionColumnKey="limite"
        />

        <PuertoLibreDashboardBucket
          dense
          title="Nacionalizados"
          icon="check"
          badgeTone="ok"
          emptyMessage="Aún no hay expedientes nacionalizados."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 2.4 },
            { key: "modificado", header: "Modificado", pdfWidth: 1.2 },
          ]}
          rows={rowsNacionalizados}
          dateFilterLabel="Modificado"
          actionColumnKey="modificado"
        />

        <PuertoLibreDashboardTodosList
          items={vehiculos.map((v) => ({
            id: v.id,
            href: `/smartimport/${v.id}`,
            codigo: labelExpediente(v),
            vehiculo: labelVehiculo(v),
            ficha: fichaDe(v),
            codigoExpediente: v.codigoExpediente,
            created_at: v.created_at,
          }))}
          emptyMessage={
            puedeMutar
              ? "No hay importaciones. Usa Importación o carga masiva desde el alta."
              : "Cuando te asignen o compartan un vehículo, aparecerá aquí."
          }
        />
      </div>
      {puedeMutar && llmUsage?.success ? (
        <div className="mt-3">
          <LlmUsagePanel summary={llmUsage.summary} />
        </div>
      ) : null}
    </PuertoLibreShell>
  );
}

function PuertoLibreShell({ children }: { children: ReactNode }) {
  return (
    <main className="smartimport-typography min-h-screen overflow-x-hidden bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:px-10">
      <div className="mx-auto w-full min-w-0 max-w-lg sm:max-w-2xl lg:max-w-3xl">
        {children}
      </div>
    </main>
  );
}
