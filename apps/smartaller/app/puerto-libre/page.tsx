import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Building2,
  Car,
  ChevronRight,
  FileText,
  Flag,
  Nfc,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  listPuertoLibreVehiculos,
  type PuertoLibreVehiculoListItem,
} from "@/app/actions/nfc/puerto-libre-vehiculo";
import { PuertoLibreDashboardEyebrow } from "@/components/nfc/PuertoLibreDashboardEyebrow";
import {
  ESTADO_NACIONALIZACION_LABELS,
  ESTADO_SENIAT_LABELS,
  type EstadoNacionalizacion,
  type EstadoSeniat,
} from "@/lib/schemas/vehiculo-documentos";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

function etiquetaDias(dias: number | null, sinFecha: string) {
  if (dias == null) return sinFecha;
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} d`;
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
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

  const proximosNacionalizar = sortByFechaAsc(
    vehiculos.filter((v) => v.proximoNacionalizar),
    (v) => v.fechaLimiteNacionalizacion,
    (v) => v.diasNacionalizacion
  ).slice(0, 8);

  const proximosSeniat = sortByFechaAsc(
    vehiculos.filter((v) => v.proximoSeniat),
    (v) => v.fechaPresentacionSeniat,
    (v) => v.diasSeniat
  ).slice(0, 8);

  return (
    <PuertoLibreShell>
      <div className="mb-8 space-y-5">
        <div>
          <PuertoLibreDashboardEyebrow />
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            Puerto Libre NFC
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Expediente de importación, próximos a nacionalizar y presentaciones SENIAT.
          </p>
        </div>
        <div className="flex max-w-md flex-col gap-2">
          <Link
            href="/puerto-libre/vehiculos/nuevo"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            Registrar vehículo
          </Link>
          <Link
            href="/puerto-libre/hoja-inspeccion"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
          >
            <FileText className="h-4 w-4" />
            Planilla recepción transportista
          </Link>
        </div>
      </div>

      {!list.success ? (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {list.error}. Si acabas de instalar el módulo, ejecuta también{" "}
          <code className="text-red-100">20260728_puerto_libre_importacion.sql</code>.
        </div>
      ) : vehiculos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-16 text-center">
          <Car className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-zinc-300">No hay vehículos registrados</p>
          <p className="mt-1 text-sm text-zinc-500">
            Registra un vehículo para armar su expediente Puerto Libre.
          </p>
          <Link
            href="/puerto-libre/vehiculos/nuevo"
            className="mt-6 inline-flex rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Registrar primer vehículo
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 lg:grid-cols-2">
            <AgendaPanel
              title="Próximos a nacionalizar"
              empty="No hay vehículos pendientes de nacionalización."
              icon={<Flag className="h-4 w-4" />}
              accent="amber"
              items={proximosNacionalizar.map((v) => ({
                id: v.id,
                placa: v.placa,
                subtitle:
                  ESTADO_NACIONALIZACION_LABELS[
                    (v.estadoNacionalizacion as EstadoNacionalizacion) ?? "pendiente"
                  ],
                fecha: v.fechaLimiteNacionalizacion,
                diasLabel: etiquetaDias(v.diasNacionalizacion, "Sin fecha límite"),
                urgente: v.diasNacionalizacion != null && v.diasNacionalizacion <= 7,
              }))}
            />
            <AgendaPanel
              title="Presentación SENIAT"
              empty="No hay presentaciones SENIAT pendientes o agendadas."
              icon={<Building2 className="h-4 w-4" />}
              accent="violet"
              items={proximosSeniat.map((v) => ({
                id: v.id,
                placa: v.placa,
                subtitle:
                  ESTADO_SENIAT_LABELS[(v.estadoSeniat as EstadoSeniat) ?? "pendiente"],
                fecha: v.fechaPresentacionSeniat,
                diasLabel: etiquetaDias(v.diasSeniat, "Sin fecha de presentación"),
                urgente: v.diasSeniat != null && v.diasSeniat <= 7,
              }))}
            />
          </div>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Vehículos registrados ({vehiculos.length})
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {vehiculos.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/puerto-libre/${v.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-cyan-500/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-2xl font-bold tracking-wide text-cyan-400">
                          {v.placa}
                        </p>
                        <p className="mt-1 truncate text-zinc-300">
                          {v.nombre_cliente ?? "Sin propietario"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {[v.marca, v.modelo, v.color].filter(Boolean).join(" · ") ||
                            "Sin ficha"}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-zinc-600 transition group-hover:text-cyan-400" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <Badge
                        ok={v.docsCount > 0}
                        icon={<FileText className="h-3 w-3" />}
                        label={`${v.docsCount} docs`}
                      />
                      <Badge
                        ok={v.tienePin}
                        icon={<ShieldCheck className="h-3 w-3" />}
                        label={v.tienePin ? "PIN" : "Sin PIN"}
                      />
                      <Badge
                        ok={Boolean(v.stickerToken)}
                        icon={<Nfc className="h-3 w-3" />}
                        label={v.stickerToken ? "NFC" : "Sin NFC"}
                      />
                      {v.proximoNacionalizar ? (
                        <Badge
                          ok
                          tone="amber"
                          icon={<Flag className="h-3 w-3" />}
                          label={etiquetaDias(v.diasNacionalizacion, "Nacionalizar")}
                        />
                      ) : null}
                      {v.proximoSeniat ? (
                        <Badge
                          ok
                          tone="violet"
                          icon={<Building2 className="h-3 w-3" />}
                          label={etiquetaDias(v.diasSeniat, "SENIAT")}
                        />
                      ) : null}
                    </div>

                    <div className="mt-auto space-y-1 pt-4 text-xs text-zinc-500">
                      {v.regimen ? <p>Régimen: {v.regimen}</p> : <p>Sin datos de importación</p>}
                      <p>Registrado: {formatDate(v.created_at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </PuertoLibreShell>
  );
}

function AgendaPanel({
  title,
  empty,
  icon,
  accent,
  items,
}: {
  title: string;
  empty: string;
  icon: ReactNode;
  accent: "amber" | "violet";
  items: Array<{
    id: string;
    placa: string;
    subtitle: string;
    fecha: string | null;
    diasLabel: string;
    urgente: boolean;
  }>;
}) {
  const border =
    accent === "amber" ? "border-amber-900/40 bg-amber-950/20" : "border-violet-900/40 bg-violet-950/20";
  const titleColor = accent === "amber" ? "text-amber-300" : "text-violet-300";

  return (
    <section className={`rounded-2xl border ${border} p-5`}>
      <h2 className={`flex items-center gap-2 text-sm font-semibold ${titleColor}`}>
        {icon}
        {title}
        <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-xs font-normal text-zinc-400">
          {items.length}
        </span>
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/puerto-libre/${item.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5 transition hover:border-zinc-600"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-zinc-100">{item.placa}</p>
                  <p className="truncate text-xs text-zinc-500">{item.subtitle}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-xs font-medium ${
                      item.urgente ? "text-red-300" : "text-zinc-300"
                    }`}
                  >
                    {item.diasLabel}
                  </p>
                  {item.fecha ? (
                    <p className="text-[11px] text-zinc-600">{formatDate(item.fecha)}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Badge({
  ok,
  icon,
  label,
  tone,
}: {
  ok: boolean;
  icon: ReactNode;
  label: string;
  tone?: "amber" | "violet";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-500/15 text-amber-300"
      : tone === "violet"
        ? "bg-violet-500/15 text-violet-300"
        : ok
          ? "bg-cyan-500/10 text-cyan-300"
          : "bg-zinc-800 text-zinc-500";

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${toneClass}`}>
      {icon}
      {label}
    </span>
  );
}

function PuertoLibreShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-8 flex items-center justify-end text-sm">
          <Link href="/" className="text-zinc-500 transition hover:text-zinc-300">
            SmartTaller
          </Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
