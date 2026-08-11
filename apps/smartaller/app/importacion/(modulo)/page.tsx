import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Car,
  ChevronRight,
  FileText,
  Plus,
  Scale,
  Users,
} from "lucide-react";
import {
  listPuertoLibreVehiculos,
  type PuertoLibreVehiculoListItem,
} from "@/app/actions/nfc/importacion-vehiculo";
import { listPortalVehiculosAction } from "@/app/actions/portal";
import { listUsuarioVehiculoIdsAction } from "@/app/actions/vehiculo-compartidos";
import {
  PuertoLibreDashboardBucket,
  type DashboardBucketRow,
} from "@/components/nfc/PuertoLibreDashboardBucket";
import { PuertoLibreDeleteExpediente } from "@/components/nfc/PuertoLibreDeleteExpediente";
import {
  canAccessAllImportacionData,
  isImportacionUsuarioOnly,
  isTallerOrConcesionario,
} from "@/lib/importacion/access";
import {
  placaRealVisible,
  resolveCodigoExpediente,
} from "@/lib/importacion/expediente";
import { resolvePortalAccess } from "@/lib/portal/roles";
import {
  diasHasta,
  esProximoNacionalizar,
  esProximoSeniat,
  parseImportacion,
} from "@/lib/schemas/vehiculo-documentos";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser, getMyTaller } from "@/lib/taller";

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
  const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(" ");
  if (marcaModelo && v.color) return `${marcaModelo} ${v.color}`;
  return marcaModelo || v.color || "—";
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
  if (f != null && f >= 7) return `/importacion/${v.id}/planilla?fase=7`;
  if (f === 6) return `/importacion/${v.id}/planilla?fase=6`;
  if (f === 5) return `/importacion/${v.id}/planilla?fase=5`;
  if (f === 4) return `/importacion/${v.id}/planilla?fase=4`;
  if (f === 3) return `/importacion/${v.id}/planilla?fase=3`;
  if (f === 2) return `/importacion/${v.id}/planilla?fase=2`;
  return `/importacion/${v.id}/planilla?fase=1`;
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
          stickerToken: null,
          regimen: v.regimen,
          estadoNacionalizacion: v.estadoNacionalizacion,
          fechaLimiteNacionalizacion: v.fechaLimiteNacionalizacion,
          estadoSeniat: v.estadoSeniat,
          fechaPresentacionSeniat: v.fechaPresentacionSeniat,
          fechaRechazoSeniat: v.fechaRechazoSeniat,
          motivoRechazoSeniat: v.motivoRechazoSeniat,
          diasNacionalizacion: diasHasta(v.fechaLimiteNacionalizacion),
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
        "id, placa, marca, modelo, color, nombre_cliente, telefono_cliente, kilometraje_ultimo, created_at, importacion"
      )
      .in("id", idsRes.vehiculoIds)
      .order("created_at", { ascending: false });
    if (error) {
      return { ok: false, vehiculos: [], error: error.message };
    }
    return {
      ok: true,
      vehiculos: (data ?? []).map((row): PuertoLibreVehiculoListItem => {
        const imp = parseImportacion(row.importacion);
        const placaRaw = (row.placa as string | null) ?? "";
        const codigoExpediente = resolveCodigoExpediente({
          codigoExpediente: imp.codigoExpediente,
          placa: placaRaw,
        });
        return {
          id: row.id as string,
          placa: placaRealVisible(placaRaw, codigoExpediente) ?? placaRaw ?? "",
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
          stickerToken: null,
          regimen: imp.regimen ?? null,
          estadoNacionalizacion: imp.estadoNacionalizacion ?? null,
          fechaLimiteNacionalizacion: imp.fechaLimiteNacionalizacion ?? null,
          estadoSeniat: imp.estadoSeniat ?? null,
          fechaPresentacionSeniat: imp.fechaPresentacionSeniat ?? null,
          fechaRechazoSeniat: imp.fechaRechazoSeniat ?? null,
          motivoRechazoSeniat: imp.motivoRechazoSeniat ?? null,
          diasNacionalizacion: diasHasta(imp.fechaLimiteNacionalizacion),
          diasSeniat: diasHasta(imp.fechaPresentacionSeniat),
          proximoNacionalizar: esProximoNacionalizar(imp),
          proximoSeniat: esProximoSeniat(imp),
          rechazadoSeniat: (imp.estadoSeniat ?? "pendiente") === "rechazada",
          codigoExpediente,
          fotoUrl: null,
        };
      }),
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
  if (!user) redirect("/importacion/login?redirectTo=/importacion");

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
    return {
      id: v.id,
      href: `/importacion/${v.id}/planilla?fase=1`,
      cells: { expediente, vehiculo, accion: "Completar" },
      searchText: `${expediente} ${vehiculo} ${v.nombre_cliente ?? ""}`,
      actionLabel: "Completar",
      actionTone: "cyan",
    };
  });

  const rowsPorEmbarque: DashboardBucketRow[] = porEmbarque.map((v) => {
    const expediente = labelExpediente(v);
    const vehiculo = labelVehiculo(v);
    return {
      id: v.id,
      href: `/importacion/${v.id}/planilla?fase=2`,
      cells: { expediente, vehiculo, accion: "Cargar" },
      searchText: `${expediente} ${vehiculo} ${v.nombre_cliente ?? ""}`,
      actionLabel: "Cargar",
      actionTone: "cyan",
    };
  });

  const rowsPorRecibir: DashboardBucketRow[] = porRecibir.map((v) => {
    const expediente = labelExpediente(v);
    const vehiculo = labelVehiculo(v);
    return {
      id: v.id,
      href: `/importacion/${v.id}/planilla?fase=3`,
      cells: {
        expediente,
        vehiculo,
        llegada: formatFechaDia(v.fechaLlegadaBuque),
      },
      dateValue: v.fechaLlegadaBuque,
      searchText: `${expediente} ${vehiculo} ${v.nombre_cliente ?? ""}`,
      actionLabel: "Recibir",
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
      actionLabel: "Completar",
      actionTone: "cyan",
    };
  });

  const rowsRechazados: DashboardBucketRow[] = rechazadosSeniat.map((v) => {
    const expediente = labelExpediente(v);
    const vehiculo = labelVehiculo(v);
    return {
      id: v.id,
      href: `/importacion/${v.id}`,
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
      href: `/importacion/${v.id}/nacionalizar`,
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
      href: `/importacion/${v.id}/nacionalizar`,
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
      urgent: v.diasNacionalizacion != null && v.diasNacionalizacion <= 7,
    };
  });

  return (
    <PuertoLibreShell>
      <header className="mb-5 space-y-4">
        <div>
          <Link
            href="/portales"
            className="mb-2 inline-flex rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight text-zinc-50 sm:text-2xl">
            Expediente Importación Vehicular
          </h1>
        </div>
        {puedeMutar ? (
        <div className="flex w-full max-w-md flex-col gap-2">
          <Link
            href="/importacion/importaciones/nueva"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(8,145,178,0.28)] transition hover:bg-cyan-500"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            Registrar importación
          </Link>
          <Link
            href="/importacion/clientes"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-100"
          >
            <Users className="h-4 w-4 text-cyan-400" />
            Clientes
          </Link>
          <Link
            href="/importacion/carga-masiva"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-100"
          >
            <FileText className="h-4 w-4 text-cyan-400" />
            Carga masiva (Excel / PDFs)
          </Link>
        </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Vista de solo lectura: vehículos de tu propiedad o compartidos contigo.
          </p>
        )}
        <Link
          href="/importacion/biblioteca-legal"
          className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-100"
        >
          <Scale className="h-4 w-4 text-cyan-400" />
          Biblioteca legal
        </Link>
      </header>

      {vehiculos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-14 text-center">
          <Car className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-zinc-300">No hay importaciones registradas</p>
          {puedeMutar ? (
            <p className="mt-1 text-sm text-zinc-500">
              Registra una importación (cliente primero) o usa{" "}
              <Link href="/importacion/carga-masiva" className="text-cyan-400 hover:underline">
                carga masiva
              </Link>{" "}
              con plantilla Excel o PDFs.
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">
              Cuando un administrador te asigne o comparta un vehículo, aparecerá aquí.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-7">
          {porRegistro.length > 0 ? (
            <PuertoLibreDashboardBucket
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
              title="Por cargar docs de embarque"
              icon="file"
              emptyMessage="No hay vehículos por cargar docs de embarque."
              columns={[
                { key: "expediente", header: "Expediente", pdfWidth: 1.2 },
                { key: "vehiculo", header: "Vehículo", pdfWidth: 2 },
                { key: "accion", header: "Acción", pdfWidth: 0.8 },
              ]}
              rows={rowsPorEmbarque}
              actionColumnKey="accion"
            />
          ) : null}

          <PuertoLibreDashboardBucket
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

          <PuertoLibreDashboardBucket
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

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Todos ({vehiculos.length})
            </h2>
            <ul className="space-y-1">
              {vehiculos.map((v) => (
                <li key={v.id}>
                  <div className="flex items-center gap-1 rounded-xl px-2 py-1.5 transition hover:bg-zinc-900/50">
                    <Link
                      href={`/importacion/${v.id}`}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 px-1 py-1 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="inline-block whitespace-nowrap font-mono font-medium text-zinc-300">
                          {labelExpediente(v)}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">
                          {labelVehiculo(v)}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                    </Link>
                    <PuertoLibreDeleteExpediente
                      vehiculoId={v.id}
                      codigo={labelExpediente(v)}
                      variant="icon"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </PuertoLibreShell>
  );
}

function PuertoLibreShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg sm:max-w-2xl lg:max-w-3xl">{children}</div>
    </main>
  );
}
