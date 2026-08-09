import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  Car,
  ChevronRight,
  FileText,
  Flag,
  Plus,
  Ship,
} from "lucide-react";
import {
  listPuertoLibreVehiculos,
  type PuertoLibreVehiculoListItem,
} from "@/app/actions/nfc/puerto-libre-vehiculo";
import { PuertoLibreDeleteExpediente } from "@/components/nfc/PuertoLibreDeleteExpediente";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

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

/** Código de expediente siempre en una sola línea (no parte en el guion). */
const EXPEDIENTE_CODE_CLASS =
  "inline-block whitespace-nowrap font-mono text-xs font-semibold tracking-wide text-zinc-100 hover:text-cyan-300 sm:text-sm";

function labelVehiculo(v: PuertoLibreVehiculoListItem): string {
  const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(" ");
  if (marcaModelo && v.color) return `${marcaModelo} ${v.color}`;
  return marcaModelo || v.color || "—";
}

function esPendienteCompletar(v: PuertoLibreVehiculoListItem): boolean {
  return v.planillaFase == null || v.planillaFase < 7;
}

/**
 * Docs de embarque listos (o legado sin fase 1A) y aún sin recepción física.
 * Fase 1 = pendiente 1A Embarque (no aparece aquí).
 */
function esPorRecibirEnPuerto(v: PuertoLibreVehiculoListItem): boolean {
  if (v.fechaIngreso) return false;
  const f = v.planillaFase;
  return f == null || f === 2;
}

/** Registrado, aún sin documentos de embarque (fase 1A). */
function esPorCargarEmbarque(v: PuertoLibreVehiculoListItem): boolean {
  return v.planillaFase === 1 && !v.fechaIngreso;
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
  if (f != null && f >= 6) return `/puerto-libre/${v.id}/planilla?fase=6`;
  if (f === 5) return `/puerto-libre/${v.id}/planilla?fase=5`;
  if (f === 4) return `/puerto-libre/${v.id}/planilla?fase=4`;
  if (f === 3) return `/puerto-libre/${v.id}/planilla?fase=3`;
  if (f === 2) return `/puerto-libre/${v.id}/planilla?fase=2`;
  return `/puerto-libre/${v.id}/planilla?fase=1`;
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

export default async function PuertoLibrePage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/puerto-libre");

  const { taller, error: tallerError } = await ensureTallerForUser(user.id);
  if (!taller) {
    return (
      <PuertoLibreShell>
        <div className="rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {tallerError ?? "No se pudo cargar tu taller."}
        </div>
      </PuertoLibreShell>
    );
  }

  const list = await listPuertoLibreVehiculos();
  const vehiculos = list.success ? list.vehiculos : [];
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

  return (
    <PuertoLibreShell>
      <header className="mb-5 space-y-4">
        <div>
          <Link
            href="/dashboard"
            className="mb-2 inline-flex rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight text-zinc-50 sm:text-2xl">
            Expediente Importación Vehicular
          </h1>
        </div>
        <div className="flex w-full max-w-md flex-col gap-2">
          <Link
            href="/puerto-libre/vehiculos/nuevo"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(8,145,178,0.28)] transition hover:bg-cyan-500"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            Registrar vehículo
          </Link>
          <Link
            href="/puerto-libre/carga-masiva"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-100"
          >
            <FileText className="h-4 w-4 text-cyan-400" />
            Carga masiva (Excel / PDFs)
          </Link>
        </div>
      </header>

      {!list.success ? (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {list.error}. Si acabas de instalar el módulo, ejecuta también{" "}
          <code className="text-red-100">20260728_puerto_libre_importacion.sql</code>.
        </div>
      ) : vehiculos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-14 text-center">
          <Car className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-zinc-300">No hay vehículos registrados</p>
          <p className="mt-1 text-sm text-zinc-500">
            Registra uno o usa{" "}
            <Link href="/puerto-libre/carga-masiva" className="text-cyan-400 hover:underline">
              carga masiva
            </Link>{" "}
            con plantilla Excel o PDFs.
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {porEmbarque.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  Por cargar docs de embarque
                </h2>
                <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500">
                  {porEmbarque.length}
                </span>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-3 font-medium whitespace-nowrap">Expediente</th>
                      <th className="px-3 py-3 font-medium">Vehículo</th>
                      <th className="px-3 py-3 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {porEmbarque.map((v) => {
                      const href = `/puerto-libre/${v.id}/planilla?fase=1a`;
                      return (
                        <tr key={v.id} className="align-top hover:bg-zinc-900/50">
                          <td className="px-3 py-3 whitespace-nowrap">
                            <Link href={href} className={EXPEDIENTE_CODE_CLASS}>
                              {labelExpediente(v)}
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-zinc-300">
                            <p className="text-xs leading-snug sm:text-sm">
                              {labelVehiculo(v)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <Link
                              href={href}
                              className="inline-flex rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-cyan-300 transition hover:border-cyan-500/60"
                            >
                              Cargar
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <Ship className="h-4 w-4 text-cyan-400" />
                Por recibir en puerto
              </h2>
              <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500">
                {porRecibir.length}
              </span>
            </div>
            {porRecibir.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No hay vehículos pendientes de recepción en puerto.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-3 font-medium whitespace-nowrap">Expediente</th>
                      <th className="px-3 py-3 font-medium">Vehículo</th>
                      <th className="px-3 py-3 font-medium">Llegada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {porRecibir.map((v) => {
                      const llegadaHref = `/puerto-libre/${v.id}/planilla?fase=2`;
                      return (
                        <tr key={v.id} className="align-top hover:bg-zinc-900/50">
                          <td className="px-3 py-3 whitespace-nowrap">
                            <Link href={llegadaHref} className={EXPEDIENTE_CODE_CLASS}>
                              {labelExpediente(v)}
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-zinc-300">
                            <p className="text-xs leading-snug sm:text-sm">
                              {labelVehiculo(v)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="inline-flex flex-col items-center gap-1.5">
                              <p className="text-xs whitespace-nowrap text-zinc-300 sm:text-sm">
                                {formatFechaDia(v.fechaLlegadaBuque)}
                              </p>
                              <Link
                                href={llegadaHref}
                                className="inline-flex rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:border-cyan-500/60"
                              >
                                Recibir
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-200">
                Pendiente a completar
              </h2>
              <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500">
                {pendientes.length}
              </span>
            </div>
            {pendientes.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay expedientes pendientes.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-3 font-medium whitespace-nowrap">Expediente</th>
                      <th className="px-3 py-3 font-medium">Vehículo</th>
                      <th className="px-3 py-3 font-medium">Modificado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {pendientes.map((v) => {
                      const href = completarHref(v);
                      return (
                        <tr key={v.id} className="align-top hover:bg-zinc-900/50">
                          <td className="px-3 py-3 whitespace-nowrap">
                            <Link href={href} className={EXPEDIENTE_CODE_CLASS}>
                              {labelExpediente(v)}
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-zinc-300">
                            <p className="text-xs leading-snug sm:text-sm">
                              {labelVehiculo(v)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="inline-flex flex-col items-center gap-1.5">
                              <Link
                                href={href}
                                className="inline-flex rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:border-cyan-500/60"
                              >
                                Completar
                              </Link>
                              <p className="text-xs whitespace-nowrap text-zinc-400 sm:text-sm">
                                {formatFechaHoraCorta(v.updated_at ?? v.created_at)}
                              </p>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <Flag className="h-4 w-4 text-amber-400" />
                Por nacionalizar
              </h2>
              <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500">
                {porNacionalizar.length}
              </span>
            </div>
            {porNacionalizar.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No hay vehículos pendientes de nacionalización.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-amber-900/30 bg-zinc-950/40">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-3 font-medium whitespace-nowrap">Expediente</th>
                      <th className="px-3 py-3 font-medium">Vehículo</th>
                      <th className="px-3 py-3 font-medium">Límite</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {porNacionalizar.map((v) => {
                      const href = `/puerto-libre/${v.id}/nacionalizar`;
                      const urgente =
                        v.diasNacionalizacion != null && v.diasNacionalizacion <= 7;
                      return (
                        <tr key={v.id} className="align-top hover:bg-zinc-900/50">
                          <td className="px-3 py-3 whitespace-nowrap">
                            <Link href={href} className={EXPEDIENTE_CODE_CLASS}>
                              {labelExpediente(v)}
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-zinc-300">
                            <p className="text-xs leading-snug sm:text-sm">
                              {labelVehiculo(v)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p
                              className={`text-xs whitespace-nowrap sm:text-sm ${
                                urgente ? "text-red-300" : "text-zinc-300"
                              }`}
                            >
                              {formatFechaDia(v.fechaLimiteNacionalizacion)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">
                              {etiquetaDias(
                                v.diasNacionalizacion,
                                "Límite 3 años (permanencia)"
                              )}
                            </p>
                            <Link
                              href={href}
                              className="mt-1.5 inline-flex rounded-lg border border-amber-700/40 bg-amber-950/30 px-2.5 py-1 text-xs font-medium text-amber-200 transition hover:border-amber-500/50"
                            >
                              Nacionalizar
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <Building2 className="h-4 w-4 text-sky-400" />
                Por presentación SENIAT
              </h2>
              <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500">
                {porSeniat.length}
              </span>
            </div>
            {porSeniat.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No hay presentaciones SENIAT pendientes o agendadas.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-sky-900/30 bg-zinc-950/40">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-3 font-medium whitespace-nowrap">Expediente</th>
                      <th className="px-3 py-3 font-medium">Vehículo</th>
                      <th className="px-3 py-3 font-medium">Presentación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {porSeniat.map((v) => {
                      /** Carpeta de requisitos ante SENIAT (vía de nacionalización). */
                      const href = `/puerto-libre/${v.id}/nacionalizar`;
                      const urgente = v.diasSeniat != null && v.diasSeniat <= 7;
                      return (
                        <tr key={v.id} className="align-top hover:bg-zinc-900/50">
                          <td className="px-3 py-3 whitespace-nowrap">
                            <Link href={href} className={EXPEDIENTE_CODE_CLASS}>
                              {labelExpediente(v)}
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-zinc-300">
                            <p className="text-xs leading-snug sm:text-sm">
                              {labelVehiculo(v)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="inline-flex flex-col items-start gap-1.5">
                              <Link
                                href={href}
                                className="inline-flex rounded-lg border border-sky-700/40 bg-sky-950/30 px-2.5 py-1 text-xs font-medium text-sky-200 transition hover:border-sky-500/50"
                              >
                                Gestionar
                              </Link>
                              <p
                                className={`text-xs whitespace-nowrap sm:text-sm ${
                                  urgente ? "text-red-300" : "text-zinc-300"
                                }`}
                              >
                                {formatFechaDia(v.fechaPresentacionSeniat)}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                {etiquetaDias(v.diasSeniat, "Sin fecha")}
                              </p>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Todos ({vehiculos.length})
            </h2>
            <ul className="space-y-1">
              {vehiculos.map((v) => (
                <li key={v.id}>
                  <div className="flex items-center gap-1 rounded-xl px-2 py-1.5 transition hover:bg-zinc-900/50">
                    <Link
                      href={`/puerto-libre/${v.id}`}
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
