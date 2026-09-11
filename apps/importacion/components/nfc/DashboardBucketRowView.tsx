"use client";

import Link from "next/link";
import { BuqueTrackingChip } from "@/components/nfc/BuqueTrackingChip";
import { DashboardBlLineas } from "@/components/nfc/DashboardBlLineas";
import type { DashboardBucketRow } from "@/components/nfc/PuertoLibreDashboardBucket";

const EXPEDIENTE_CODE_CLASS =
  "smartimport-expediente-title inline-block break-words font-mono tracking-wide text-zinc-100 hover:text-cyan-300";

const ACTION_TONE: Record<
  NonNullable<DashboardBucketRow["actionTone"]>,
  string
> = {
  cyan: "border-cyan-700/50 bg-cyan-950/40 text-cyan-300 hover:border-cyan-500/60",
  red: "border-red-800/50 bg-red-950/30 text-red-200 hover:border-red-600/50",
  sky: "border-sky-700/40 bg-sky-950/30 text-sky-200 hover:border-sky-500/50",
  amber:
    "border-amber-700/40 bg-amber-950/30 text-amber-200 hover:border-amber-500/50",
};

export function DashboardBucketExpediente({
  row,
  framed = true,
}: {
  row: DashboardBucketRow;
  framed?: boolean;
}) {
  const value = row.cells.expediente ?? "—";
  const sub = row.subcells?.expediente;

  if (row.lineas && row.lineas.length > 0) {
    return (
      <DashboardBlLineas
        blLabel={value}
        href={row.href}
        lineas={row.lineas}
        resumen={sub}
        titleClassName={EXPEDIENTE_CODE_CLASS}
        numeroBl={row.numeroBl}
        fechaLlegadaBuque={row.fechaLlegadaBuque}
        framed={framed}
      />
    );
  }

  const ficha = row.ficha;
  return (
    <div className="min-w-0 space-y-1.5">
      <Link href={row.href} className={`${EXPEDIENTE_CODE_CLASS} block`}>
        {value}
      </Link>
      {ficha ? (
        <div className="space-y-0.5">
          {ficha.marca ? (
            <p className="smartimport-vehiculo-description block text-zinc-400">
              {ficha.marca}
            </p>
          ) : null}
          {ficha.modelo ? (
            <p className="smartimport-vehiculo-description block text-zinc-400">
              {ficha.modelo}
            </p>
          ) : null}
          {ficha.color ? (
            <p className="smartimport-vehiculo-description block text-zinc-400">
              {ficha.color}
            </p>
          ) : null}
          {ficha.vin ? (
            <p className="smartimport-vehiculo-description block font-mono text-zinc-400">
              {ficha.vin}
            </p>
          ) : null}
        </div>
      ) : null}
      {sub ? <p className="text-[11px] text-red-300/80">{sub}</p> : null}
      <BuqueTrackingChip
        numeroBl={row.numeroBl}
        fechaLlegadaBuque={row.fechaLlegadaBuque}
        compact
      />
    </div>
  );
}

export function DashboardBucketAction({
  row,
  columnKey,
  fullWidth = false,
}: {
  row: DashboardBucketRow;
  columnKey: string;
  fullWidth?: boolean;
}) {
  const tone = row.actionTone ?? "cyan";
  const value = row.cells[columnKey] ?? "—";
  const sub = row.subcells?.[columnKey];
  const showValue =
    Boolean(value.trim()) &&
    value.trim() !== row.actionLabel &&
    value.trim() !== "—";

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-1.5">
      <Link
        href={row.href}
        className={`inline-flex max-w-full whitespace-normal rounded-lg border px-2.5 py-1.5 text-xs font-medium leading-tight transition ${ACTION_TONE[tone]} ${
          fullWidth ? "w-full justify-center text-center" : "items-start self-start"
        }`}
      >
        {row.actionLabel}
      </Link>
      {showValue ? (
        <p
          className={`text-xs sm:text-sm ${
            row.urgent ? "text-red-300" : "text-zinc-300"
          }`}
        >
          {value}
        </p>
      ) : null}
      {sub ? <p className="text-[11px] text-zinc-500">{sub}</p> : null}
    </div>
  );
}

export function DashboardBucketGenericCell({
  row,
  columnKey,
}: {
  row: DashboardBucketRow;
  columnKey: string;
}) {
  const value = row.cells[columnKey] ?? "—";
  const sub = row.subcells?.[columnKey];
  return (
    <div className="min-w-0 text-zinc-300">
      {value.trim() ? (
        <p className="smartimport-vehiculo-description">{value}</p>
      ) : null}
      {sub ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-red-300/80">{sub}</p>
      ) : null}
    </div>
  );
}

export function DashboardBucketMobileCard({
  row,
  actionColumnKey,
  actionHeader,
  borderClassName,
}: {
  row: DashboardBucketRow;
  actionColumnKey?: string;
  actionHeader?: string;
  borderClassName: string;
}) {
  const isBlGroup = Boolean(row.lineas && row.lineas.length > 0);

  return (
    <li
      className={`min-w-0 overflow-hidden rounded-2xl border ${
        isBlGroup
          ? "border-cyan-800/50 bg-cyan-950/20"
          : `bg-zinc-950/40 ${borderClassName}`
      }`}
    >
      <div className="min-w-0 p-3">
        <DashboardBucketExpediente row={row} framed={false} />
      </div>
      {actionColumnKey ? (
        <div className="min-w-0 space-y-2 border-t border-zinc-800/70 bg-zinc-950/50 px-3 py-3">
          {actionHeader ? (
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {actionHeader}
            </p>
          ) : null}
          <DashboardBucketAction
            row={row}
            columnKey={actionColumnKey}
            fullWidth
          />
        </div>
      ) : null}
    </li>
  );
}
