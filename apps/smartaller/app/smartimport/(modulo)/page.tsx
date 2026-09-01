import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Plus,
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
import {
  cargaBlPath,
  groupByCargaBl,
} from "@/lib/importacion/expediente-lote";
import { completarEtapaLabel } from "@/lib/importacion/dashboard-completar-etapa";

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

function esPendienteCompletar(v: PuertoLibreVehiculoListItem): boolean {
  return v.planillaFase == null || v.planillaFase < 8;
}

/** Fase 3 (llegada) pendiente: docs de embarque listos, sin fecha de ingreso. */
function esPorRecibirEnPuerto(v: PuertoLibreVehiculoListItem): boolean {
  if (v.fechaIngreso) return false;
  const f = v.planillaFase;
  return f == null || f === 3;
}

/** Fase 1: registro (datos + factura + certificado de origen). */
function esPorCompletarRegistro(v: PuertoLibreVehiculoListItem): boolean {
  return v.planillaFase === 1 && !v.fechaIngreso;
}

/** Fase 2: docs de embarque (BL, lista, DAV, póliza). */
function esPorCargarEmbarque(v: PuertoLibreVehiculoListItem): boolean {
  return v.planillaFase === 2 && !v.fechaIngreso;
}

function sortPorLlegadaBuque(items: PuertoLibreVehiculoListItem[]) {
  return [...items].sort((a, b) => {
    const fa = a.fechaLlegadaBuque ?? "9999-99-99";
    const fb = b.fechaLlegadaBuque ?? "9999-99-99";
    if (fa !== fb) return fa.localeCompare(fb);
    return a.created_at.localeCompare(b.created_at);
  });
}

function completarHref(v: PuertoLibreVehiculoListItem): string {
  const f = v.planillaFase;
  if (f != null && f >= 7) return `/smartimport/${v.id}/planilla?fase=7`;
  if (f === 6) return `/smartimport/${v.id}/planilla?fase=6`;
  if (f === 5) return `/smartimport/${v.id}/planilla?fase=5`;
  if (f === 4) return `/smartimport/${v.id}/planilla?fase=4`;
  if (f === 3) return `/smartimport/${v.id}/planilla?fase=3`;
  if (f === 2) return cargaBlPath(v.numeroBl, v.id);
  return `/smartimport/${v.id}/planilla?fase=1`;
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
  const porRegistro = sortPorLlegadaBuque(
    vehiculos.filter(esPorCompletarRegistro)
  );
  const porEmbarque = sortPorLlegadaBuque(vehiculos.filter(esPorCargarEmbarque));
  const porRecibir = sortPorLlegadaBuque(vehiculos.filter(esPorRecibirEnPuerto));
  const pendientes = vehiculos.filter(esPendienteCompletar);
  const porNacionalizar = sortByFechaAsc(
    vehiculos.filter((v) => v.proximoNacionalizar),
    (v) => v.fechaLimiteNacionalizacion,
    (v) => v.diasNacionalizacion
  );
  const porSeniat = sortByFechaAsc(
    vehiculos.filter((v) => v.proximoSeniat),
    (v) => v.fechaPresentacionSeniat,
    (v) => v.diasSeniat
  );
  const rechazadosSeniat = [...vehiculos.filter((v) => v.rechazadoSeniat)].sort(
    (a, b) => {
      const fa = a.fechaRechazoSeniat ?? "";
      const fb = b.fechaRechazoSeniat ?? "";
      return fb.localeCompare(fa);
    }
  );

  const rowsPorRegistro: DashboardBucketRow[] = porRegistro.map((v) => {
    const expediente = labelExpediente(v);
    const vehiculo = labelVehiculo(v);
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
        vehiculo,
        accion: completarEtapaLabel(1),
      },
      subcells: pend ? { vehiculo: pend } : undefined,
      searchText: `${expediente} ${vehiculo} ${v.nombre_cliente ?? ""} ${v.datosPendientes.join(" ")}`,
      actionLabel: completarEtapaLabel(1),
      actionTone: completitudTone(v.completitudDatos),
    };
  });

  const rowsPorEmbarque: DashboardBucketRow[] = groupByCargaBl(porEmbarque).flatMap(
    (group): DashboardBucketRow[] => {
      if (!group.blKey) {
        return group.items.map((v) => {
          const expediente = labelExpediente(v);
          const vehiculo = labelVehiculo(v);
          return {
            id: v.id,
            href: cargaBlPath(null, v.id),
            cells: { expediente, vehiculo, accion: "Asignar BL" },
            searchText: `${expediente} ${vehiculo} ${v.nombre_cliente ?? ""}`,
            actionLabel: "Asignar BL",
            actionTone: "amber",
          };
        });
      }
      const first = group.items[0]!;
      const vehiculo =
        group.items.length === 1
          ? labelVehiculo(first)
          : `${group.items.length} expedientes`;
      return [
        {
          id: `bl-${group.blKey}`,
          href: cargaBlPath(group.blKey),
          cells: {
            expediente: group.label,
            vehiculo,
            accion: "Cargar",
          },
          searchText: `${group.label} ${group.items
            .map((v) => `${labelExpediente(v)} ${labelVehiculo(v)} ${v.nombre_cliente ?? ""}`)
            .join(" ")}`,
          actionLabel: "Cargar",
          actionTone: "red",
        },
      ];
    }
  );

  const rowsPorRecibir: DashboardBucketRow[] = porRecibir.map((v) => {
    const expediente = labelExpediente(v);
    const vehiculo = labelVehiculo(v);
    return {
      id: v.id,
      href: `/smartimport/${v.id}/planilla?fase=3`,
      cells: {
        expediente,
        vehiculo,
        llegada: formatFechaDia(v.fechaLlegadaBuque),
      },
      dateValue: v.fechaLlegadaBuque,
      searchText: `${expediente} ${vehiculo} ${v.nombre_cliente ?? ""}`,
      actionLabel: completarEtapaLabel(3),
      actionTone: "cyan",
    };
  });

  const rowsPendientes: DashboardBucketRow[] = pendientes.map((v) => {
    const expediente = labelExpediente(v);
    const vehiculo = labelVehiculo(v);
    const modificadoIso = (v.updated_at ?? v.created_at).slice(0, 10);
    return {
      id: v.id,
      href: completarHref(v),
      cells: {
        expediente,
        vehiculo,
        modificado: formatFechaHoraCorta(v.updated_at ?? v.created_at),
      },
      dateValue: modificadoIso || null,
      searchText: `${expediente} ${vehiculo} ${v.nombre_cliente ?? ""} fase ${v.planillaFase ?? ""}`,
      actionLabel: completarEtapaLabel(v.planillaFase),
      actionTone: "cyan",
    };
  });

  const rowsRechazados: DashboardBucketRow[] = rechazadosSeniat.map((v) => {
    const expediente = labelExpediente(v);
    const vehiculo = labelVehiculo(v);
    return {
      id: v.id,
      href: `/smartimport/${v.id}`,
      cells: {
        expediente,
        vehiculo,
        rechazo: formatFechaDia(v.fechaRechazoSeniat?.slice(0, 10) ?? null),
      },
      subcells: v.motivoRechazoSeniat
        ? { vehiculo: v.motivoRechazoSeniat }
        : undefined,
      dateValue: v.fechaRechazoSeniat?.slice(0, 10) ?? null,
      searchText: `${expediente} ${vehiculo} ${v.motivoRechazoSeniat ?? ""} ${v.nombre_cliente ?? ""}`,
      actionLabel: "Corregir",
      actionTone: "red",
    };
  });

  const rowsPorSeniat: DashboardBucketRow[] = porSeniat.map((v) => {
    const expediente = labelExpediente(v);
    const vehiculo = labelVehiculo(v);
    return {
      id: v.id,
      href: `/smartimport/${v.id}/nacionalizar`,
      cells: {
        expediente,
        vehiculo,
        presentacion: formatFechaDia(v.fechaPresentacionSeniat),
      },
      subcells: {
        presentacion: etiquetaDias(v.diasSeniat, "Sin fecha"),
      },
      dateValue: v.fechaPresentacionSeniat,
      searchText: `${expediente} ${vehiculo} ${v.nombre_cliente ?? ""}`,
      actionLabel: "Gestionar",
      actionTone: "sky",
      urgent: v.diasSeniat != null && v.diasSeniat <= 7,
    };
  });

  const rowsPorNacionalizar: DashboardBucketRow[] = porNacionalizar.map((v) => {
    const expediente = labelExpediente(v);
    const vehiculo = labelVehiculo(v);
    return {
      id: v.id,
      href: `/smartimport/${v.id}/nacionalizar`,
      cells: {
        expediente,
        vehiculo,
        limite: formatFechaDia(v.fechaLimiteNacionalizacion),
      },
      subcells: {
        limite: etiquetaDias(
          v.diasNacionalizacion,
          "Límite 3 años (permanencia)"
        ),
      },
      dateValue: v.fechaLimiteNacionalizacion,
      searchText: `${expediente} ${vehiculo} ${v.nombre_cliente ?? ""}`,
      actionLabel: "Nacionalizar",
      actionTone: "amber",
      urgent:
        v.diasNacionalizacion != null &&
        v.diasNacionalizacion <= 30,
    };
  });

  return (
    <PuertoLibreShell>
      <header className="mb-3 space-y-3">
        <div className="flex items-center gap-1.5">
          <Link
            href="/portales"
            className="inline-flex shrink-0 rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
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
            <div className="grid grid-cols-2 gap-1.5">
              <Link
                href="/smartimport/instructivo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-500/30 hover:text-cyan-100"
              >
                <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                Instructivo
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

      <div className="divide-y divide-zinc-800/70 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
        <PuertoLibreDashboardBucket
          dense
          title="Pendiente a completar"
          emptyMessage="No hay expedientes pendientes."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 1.2 },
            { key: "vehiculo", header: "Vehículo", pdfWidth: 2 },
            { key: "modificado", header: "Modificado", pdfWidth: 1.2 },
          ]}
          rows={rowsPendientes}
          dateFilterLabel="Modificado"
          actionColumnKey="modificado"
        />

        {porRegistro.length > 0 ? (
          <PuertoLibreDashboardBucket
            dense
            title="Por completar registro"
            icon="file"
            emptyMessage="No hay vehículos por completar registro."
            columns={[
              { key: "expediente", header: "Expediente", pdfWidth: 1.2 },
              { key: "vehiculo", header: "Vehículo", pdfWidth: 2 },
              { key: "accion", header: "Acción", pdfWidth: 0.8 },
            ]}
            rows={rowsPorRegistro}
            actionColumnKey="accion"
          />
        ) : null}

        {porEmbarque.length > 0 ? (
          <PuertoLibreDashboardBucket
            dense
            title="Por cargar docs de la carga"
            icon="file"
            emptyMessage="No hay cargas por anexar documentos de BL."
            columns={[
              { key: "expediente", header: "BL", pdfWidth: 1.2 },
              { key: "vehiculo", header: "Unidades", pdfWidth: 2 },
              { key: "accion", header: "Acción", pdfWidth: 0.8 },
            ]}
            rows={rowsPorEmbarque}
            actionColumnKey="accion"
          />
        ) : null}

        <PuertoLibreDashboardBucket
          dense
          title="Por recibir en puerto"
          icon="ship"
          emptyMessage="No hay vehículos pendientes de recepción en puerto."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 1.2 },
            { key: "vehiculo", header: "Vehículo", pdfWidth: 2 },
            { key: "llegada", header: "Llegada", pdfWidth: 1.2 },
          ]}
          rows={rowsPorRecibir}
          dateFilterLabel="Llegada"
          actionColumnKey="llegada"
        />

        <PuertoLibreDashboardBucket
          dense
          title="Por presentación SENIAT"
          icon="building"
          emptyMessage="No hay presentaciones SENIAT pendientes o agendadas."
          columns={[
            { key: "expediente", header: "Expediente", pdfWidth: 1.2 },
            { key: "vehiculo", header: "Vehículo", pdfWidth: 2 },
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
            { key: "expediente", header: "Expediente", pdfWidth: 1.2 },
            { key: "vehiculo", header: "Vehículo", pdfWidth: 2.2 },
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
            { key: "expediente", header: "Expediente", pdfWidth: 1.2 },
            { key: "vehiculo", header: "Vehículo", pdfWidth: 2 },
            { key: "limite", header: "Límite", pdfWidth: 1.3 },
          ]}
          rows={rowsPorNacionalizar}
          dateFilterLabel="Límite"
          borderClassName="border-amber-900/30"
          actionColumnKey="limite"
        />

        <PuertoLibreDashboardTodosList
          items={vehiculos.map((v) => ({
            id: v.id,
            href: `/smartimport/${v.id}`,
            codigo: labelExpediente(v),
            vehiculo: labelVehiculo(v),
            codigoExpediente: v.codigoExpediente,
            created_at: v.created_at,
          }))}
          emptyMessage={
            puedeMutar
              ? "No hay importaciones. Usa «Importación» en el dashboard para registrar una o varias unidades."
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
    <main className="smartimport-typography min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-3 pb-6 pt-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg sm:max-w-2xl lg:max-w-3xl">{children}</div>
    </main>
  );
}
