import { JacCarPhoto } from "@/components/jac/jac-car-photo";
import { getBrand } from "@/lib/brand";
import { JAC_CHIPS } from "@/lib/brand/jac-theme";
import type { Mantenimiento, Recordatorio, Vehiculo } from "@/lib/data/dashboard";

export type JacWorkshopChip = "bahia" | "esperando" | "confirmada" | "porConfirmar";

export type JacWorkshopRow = {
  id: string;
  modelo: string;
  dueno: string;
  placa: string;
  servicio: string;
  hora: string;
  chip: JacWorkshopChip;
};

type JacWorkshopBoardProps = {
  tallerNombre: string;
  bahia: number;
  citas: number;
  porConfirmar: number;
  rows: JacWorkshopRow[];
};

function chipStyle(chip: JacWorkshopChip) {
  if (chip === "bahia") return JAC_CHIPS.bahia;
  if (chip === "esperando") return JAC_CHIPS.esperando;
  if (chip === "confirmada") return JAC_CHIPS.confirmada;
  return JAC_CHIPS.porConfirmar;
}

function chipLabel(chip: JacWorkshopChip) {
  const copy = getBrand().copy.workshop;
  if (chip === "bahia") return copy.chipBahia;
  if (chip === "esperando") return copy.chipEsperando;
  if (chip === "confirmada") return copy.chipConfirmada;
  return copy.chipPorConfirmar;
}

function formatHora(iso: string): string {
  return new Intl.DateTimeFormat("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function buildJacWorkshopRows(
  vehiculos: Vehiculo[],
  mantenimientos: Mantenimiento[],
  recordatorios: Recordatorio[]
): JacWorkshopRow[] {
  const byPlaca = new Map(vehiculos.map((v) => [v.placa, v]));
  const rows: JacWorkshopRow[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const m of mantenimientos.slice(0, 8)) {
    const veh = m.placa ? byPlaca.get(m.placa) : undefined;
    rows.push({
      id: `m-${m.id}`,
      modelo: veh?.modelo || veh?.nick || "JAC",
      dueno: m.nombre_cliente || veh?.nombre_cliente || "Dueño",
      placa: m.placa || "—",
      servicio: m.descripcion || m.descripcion_servicio || "Servicio",
      hora: formatHora(m.created_at),
      chip: "bahia",
    });
  }

  for (const r of recordatorios.filter((x) => x.estado === "pendiente").slice(0, 8)) {
    const fecha = new Date(r.fecha_programada);
    fecha.setHours(0, 0, 0, 0);
    const chip: JacWorkshopChip =
      fecha.getTime() <= today.getTime() ? "esperando" : "confirmada";
    rows.push({
      id: `r-${r.id}`,
      modelo: "JAC",
      dueno: r.vehiculos?.nombre_cliente || "Dueño",
      placa: r.vehiculos?.placa || "—",
      servicio: "Cita",
      hora: formatHora(r.fecha_programada),
      chip,
    });
  }

  return rows.slice(0, 12);
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="jac-card flex-1 p-4">
      <p className="text-[12px] font-medium text-[#6a6a74]">{label}</p>
      <p className="jac-title mt-1 text-[28px] text-[#1c1c22]">{value}</p>
    </div>
  );
}

function StatusChip({ chip }: { chip: JacWorkshopChip }) {
  const style = chipStyle(chip);
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {chipLabel(chip)}
    </span>
  );
}

function RowThumb({ modelo }: { modelo: string }) {
  return (
    <div className="relative h-11 w-[72px] shrink-0 overflow-hidden rounded-[10px] bg-[#eceef3]">
      <JacCarPhoto modelo={modelo} alt={modelo} sizes="72px" />
    </div>
  );
}

export function JacWorkshopBoard({
  tallerNombre,
  bahia,
  citas,
  porConfirmar,
  rows,
}: JacWorkshopBoardProps) {
  const copy = getBrand().copy.workshop;
  const fecha = new Intl.DateTimeFormat("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="min-h-full bg-[#f3f4f8] text-[#1c1c22]">
      <header className="px-4 pt-5 md:px-8 md:pt-8">
        <p className="text-[13px] font-medium text-[#6a6a74]">{tallerNombre}</p>
        <h1 className="jac-title mt-1 text-[28px] md:text-[32px]">{copy.today}</h1>
        <p className="mt-1 text-[13px] text-[#5b5b66] first-letter:uppercase">{fecha}</p>
      </header>

      <div className="mt-5 grid grid-cols-3 gap-2 px-4 md:gap-3 md:px-8">
        <Kpi label={copy.kpiBahia} value={bahia} />
        <Kpi label={copy.kpiCitas} value={citas} />
        <Kpi label={copy.kpiConfirmar} value={porConfirmar} />
      </div>

      <section className="mt-6 px-4 pb-10 md:hidden">
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="jac-card flex items-center gap-3 p-3">
              <RowThumb modelo={row.modelo} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">{row.modelo}</p>
                <p className="truncate text-[12px] text-[#5b5b66]">
                  {copy.ownerPlate(row.dueno, row.placa)}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-[#6a6a74]">
                  {row.servicio} · {row.hora}
                </p>
              </div>
              <StatusChip chip={row.chip} />
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 hidden px-8 pb-12 md:block">
        <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_6px_20px_rgba(20,20,30,.05)]">
          <div className="border-b border-[#eceef3] px-6 py-4">
            <h2 className="jac-title text-lg">{copy.tableTitle}</h2>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#eceef3]">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <RowThumb modelo={row.modelo} />
                      <div>
                        <p className="font-bold">{row.modelo}</p>
                        <p className="text-[12px] text-[#5b5b66]">
                          {copy.ownerPlate(row.dueno, row.placa)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#5b5b66]">{row.servicio}</td>
                  <td className="px-4 py-3 text-[#5b5b66]">{row.hora}</td>
                  <td className="px-6 py-3 text-right">
                    <StatusChip chip={row.chip} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
