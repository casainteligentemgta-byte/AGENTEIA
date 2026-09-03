"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  Download,
  Flag,
  Loader2,
  Search,
  Share2,
  Ship,
  FileText,
} from "lucide-react";
import {
  buildListaDashboardPdf,
  listaDashboardPdfFileName,
} from "@/lib/importacion/lista-dashboard-pdf";
import {
  dashboardFichaLineas,
  type DashboardFichaIdentidad,
} from "@/lib/importacion/dashboard-ficha";
import { compareExpedienteLabelsAsc } from "@/lib/importacion/expediente";
import {
  DashboardBlLineas,
  type DashboardBucketLinea,
} from "@/components/nfc/DashboardBlLineas";

export type DashboardBucketColumn = {
  key: string;
  header: string;
  /** Fracción de ancho en PDF. */
  pdfWidth?: number;
};

export type DashboardBucketRow = {
  id: string;
  href: string;
  cells: Record<string, string>;
  /** Marca / modelo / color / VIN bajo el número de expediente. */
  ficha?: DashboardFichaIdentidad;
  /** Texto secundario bajo una celda (p. ej. motivo, countdown). */
  subcells?: Record<string, string>;
  /** YYYY-MM-DD para filtro por fecha. */
  dateValue?: string | null;
  /** Texto libre indexado por el buscador. */
  searchText: string;
  /** Mercancía apilada bajo el BL (expediente + ficha). */
  lineas?: DashboardBucketLinea[];
  actionLabel: string;
  actionTone?: "cyan" | "red" | "sky" | "amber";
  urgent?: boolean;
};

export type { DashboardBucketLinea };

type IconName = "ship" | "alert" | "building" | "flag" | "file" | "check" | "none";

type ExpedienteSortDir = "asc" | "desc";

type Props = {
  title: string;
  icon?: IconName;
  emptyMessage: string;
  columns: DashboardBucketColumn[];
  rows: DashboardBucketRow[];
  /** Si se indica, muestra filtros desde/hasta sobre `dateValue`. */
  dateFilterLabel?: string;
  borderClassName?: string;
  /** Clave de la columna que lleva el enlace de acción + fecha. */
  actionColumnKey?: string;
  /**
   * Fila compacta (móvil): título + contador.
   * Vacío = una línea; con filas = accordion expandible.
   */
  dense?: boolean;
  /** Orden inicial por expediente (menor → mayor). */
  defaultExpedienteSort?: ExpedienteSortDir | null;
  /** Rojo = cola de trabajo; ok = inventario cerrado (nacionalizados). */
  badgeTone?: "alert" | "ok";
  /** Ancla para deep-link (p. ej. #cola-embarque). */
  sectionId?: string;
  /** Botón extra junto al título (p. ej. Nueva ficha). */
  headerActions?: ReactNode;
  /** Contenido encima de la tabla (fichas, avisos). */
  leadingContent?: ReactNode;
  /** Placeholder del buscador de la cola. */
  searchPlaceholder?: string;
  /** Abre el acordeón denso en el primer render. */
  defaultOpen?: boolean;
};

const EXPEDIENTE_CODE_CLASS =
  "smartimport-expediente-title inline-block whitespace-nowrap font-mono tracking-wide text-zinc-100 hover:text-cyan-300";

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

function BucketIcon({ name }: { name: IconName }) {
  if (name === "ship") return <Ship className="h-4 w-4 text-cyan-400" />;
  if (name === "alert") return <AlertTriangle className="h-4 w-4 text-red-400" />;
  if (name === "building") return <Building2 className="h-4 w-4 text-sky-400" />;
  if (name === "flag") return <Flag className="h-4 w-4 text-amber-400" />;
  if (name === "file") return <FileText className="h-4 w-4 text-cyan-400" />;
  if (name === "check") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  return null;
}

function matchesDate(
  dateValue: string | null | undefined,
  from: string,
  to: string
): boolean {
  if (!from && !to) return true;
  if (!dateValue) return false;
  const d = dateValue.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PuertoLibreDashboardBucket({
  title,
  icon = "none",
  emptyMessage,
  columns,
  rows,
  dateFilterLabel,
  borderClassName = "border-zinc-800/80",
  actionColumnKey,
  dense = false,
  defaultExpedienteSort = null,
  badgeTone = "alert",
  sectionId,
  headerActions,
  leadingContent,
  searchPlaceholder = "Filtrar por expediente, vehículo…",
  defaultOpen,
}: Props) {
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expedienteSort, setExpedienteSort] = useState<ExpedienteSortDir | null>(
    defaultExpedienteSort
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !row.searchText.toLowerCase().includes(q)) return false;
      if (!matchesDate(row.dateValue, dateFrom, dateTo)) return false;
      return true;
    });
  }, [rows, query, dateFrom, dateTo]);

  const displayed = useMemo(() => {
    if (!expedienteSort) return filtered;
    const dir = expedienteSort === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) =>
        dir *
        compareExpedienteLabelsAsc(
          a.cells.expediente ?? "",
          b.cells.expediente ?? ""
        )
    );
  }, [filtered, expedienteSort]);

  const hasFilters = Boolean(query.trim() || dateFrom || dateTo);
  const showTable = rows.length > 0;
  const showPanel = showTable || Boolean(leadingContent);
  const [detailsOpen, setDetailsOpen] = useState(
    defaultOpen ??
      (Boolean(leadingContent) || rows.some((r) => r.urgent))
  );

  function toggleExpedienteSort() {
    setExpedienteSort((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  const countBadge = (
    <span
      className={`rounded-md px-2 py-0.5 text-xs tabular-nums ${
        showTable
          ? badgeTone === "ok"
            ? "bg-emerald-950/50 text-emerald-300"
            : "bg-red-950/50 text-red-300"
          : "bg-zinc-900 text-zinc-500"
      }`}
    >
      {showTable
        ? hasFilters
          ? `${filtered.length}/${rows.length}`
          : rows.length
        : 0}
    </span>
  );

  const titleRow = (
    <h2 className="smartimport-bucket-title flex min-w-0 items-center gap-2 text-zinc-200">
      <BucketIcon name={icon} />
      <span className="truncate">{title}</span>
    </h2>
  );

  function buildPdfBytes() {
    return buildListaDashboardPdf({
      title,
      subtitle: hasFilters
        ? `Filtros aplicados · ${displayed.length} de ${rows.length} registro(s)`
        : undefined,
      columns: columns.map((c) => ({
        key: c.key,
        header: c.header,
        width: c.pdfWidth,
      })),
      rows: displayed.map((r) => ({
        cells: Object.fromEntries(
          columns.map((c) => {
            const main = r.cells[c.key] ?? "";
            const sub = r.subcells?.[c.key];
            if (c.key === "expediente" && r.lineas && r.lineas.length > 0) {
              const stacked = [
                main,
                ...r.lineas.map((l) =>
                  l.detalle ? `${l.titulo} · ${l.detalle}` : l.titulo
                ),
              ].join("\n");
              return [c.key, sub ? `${stacked}\n${sub}` : stacked];
            }
            if (c.key === "expediente" && r.ficha) {
              const stacked = [main, ...dashboardFichaLineas(r.ficha)].join("\n");
              return [c.key, sub ? `${stacked}\n${sub}` : stacked];
            }
            return [c.key, sub ? `${main} · ${sub}` : main];
          })
        ),
      })),
    });
  }

  function handleDownload() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      try {
        const bytes = await buildPdfBytes();
        const fileName = listaDashboardPdfFileName(title);
        downloadBlob(
          new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }),
          fileName
        );
        setStatus(`PDF descargado (${displayed.length} registro${displayed.length === 1 ? "" : "s"}).`);
      } catch {
        setError("No se pudo generar el PDF.");
      }
    });
  }

  function handleShare() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      try {
        const bytes = await buildPdfBytes();
        const fileName = listaDashboardPdfFileName(title);
        const blob = new Blob([Uint8Array.from(bytes)], {
          type: "application/pdf",
        });
        const file = new File([blob], fileName, { type: "application/pdf" });

        if (
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function" &&
          (!navigator.canShare || navigator.canShare({ files: [file] }))
        ) {
          try {
            await navigator.share({
              files: [file],
              title,
              text: `${title} · ${displayed.length} registro(s)`,
            });
            setStatus("Lista compartida.");
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
              return;
            }
            /* fallback a descarga */
          }
        }

        downloadBlob(blob, fileName);
        setStatus(
          "Este dispositivo no permite compartir archivos; se descargó el PDF."
        );
      } catch {
        setError("No se pudo compartir el PDF.");
      }
    });
  }

  const tablePanel = showTable ? (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Filtrar {title}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-700/50 focus:outline-none focus:ring-1 focus:ring-cyan-700/40"
          />
        </label>
        {dateFilterLabel ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
              {dateFilterLabel} desde
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-sm text-zinc-100 focus:border-cyan-700/50 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
              hasta
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-sm text-zinc-100 focus:border-cyan-700/50 focus:outline-none"
              />
            </label>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={pending || displayed.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-cyan-700/50 hover:text-cyan-100 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Descargar PDF
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={pending || displayed.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-cyan-700/50 hover:text-cyan-100 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            Compartir PDF
          </button>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDateFrom("");
                setDateTo("");
              }}
              className="inline-flex items-center rounded-xl px-2 py-2 text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {status ? <p className="text-xs text-zinc-400">{status}</p> : null}

      {displayed.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Ningún registro coincide con los filtros.
        </p>
      ) : (
        <div
          className={`overflow-x-auto rounded-2xl border bg-zinc-950/40 ${borderClassName}`}
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                {columns.map((col) => {
                  const isExpedienteCol = col.key === "expediente";
                  return (
                    <th
                      key={col.key}
                      onDoubleClick={
                        isExpedienteCol ? toggleExpedienteSort : undefined
                      }
                      title={
                        isExpedienteCol
                          ? "Doble clic para ordenar por expediente"
                          : undefined
                      }
                      className={`px-3 py-3 font-medium ${
                        isExpedienteCol
                          ? "cursor-pointer select-none whitespace-nowrap"
                          : ""
                      } ${
                        isExpedienteCol && expedienteSort
                          ? "text-cyan-400"
                          : ""
                      }`}
                    >
                      {isExpedienteCol ? (
                        <span className="inline-flex items-center gap-1">
                          {col.header}
                          {expedienteSort === "asc" ? (
                            <ArrowUp
                              className="h-3 w-3"
                              aria-label="Orden ascendente"
                            />
                          ) : null}
                          {expedienteSort === "desc" ? (
                            <ArrowDown
                              className="h-3 w-3"
                              aria-label="Orden descendente"
                            />
                          ) : null}
                        </span>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {displayed.map((row) => {
                const tone = row.actionTone ?? "cyan";
                return (
                  <tr key={row.id} className="align-top hover:bg-zinc-900/50">
                    {columns.map((col) => {
                      const isExpediente = col.key === "expediente";
                      const isActionCol =
                        actionColumnKey != null && col.key === actionColumnKey;
                      const value = row.cells[col.key] ?? "—";
                      const sub = row.subcells?.[col.key];

                      if (isExpediente) {
                        const ficha = row.ficha;
                        if (row.lineas && row.lineas.length > 0) {
                          return (
                            <td key={col.key} className="px-3 py-3">
                              <DashboardBlLineas
                                blLabel={value}
                                href={row.href}
                                lineas={row.lineas}
                                resumen={sub}
                                titleClassName={EXPEDIENTE_CODE_CLASS}
                              />
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className="px-3 py-3">
                            <Link
                              href={row.href}
                              className={`${EXPEDIENTE_CODE_CLASS} block`}
                            >
                              {value}
                            </Link>
                            {ficha ? (
                              <div className="mt-1.5 space-y-0.5">
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
                            {sub ? (
                              <p className="mt-1 text-[11px] text-red-300/80">
                                {sub}
                              </p>
                            ) : null}
                          </td>
                        );
                      }

                      if (isActionCol) {
                        const showValue =
                          Boolean(value.trim()) &&
                          value.trim() !== row.actionLabel &&
                          value.trim() !== "—";
                        return (
                          <td key={col.key} className="px-3 py-3">
                            <div className="inline-flex flex-col items-start gap-1.5">
                              <Link
                                href={row.href}
                                className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium transition ${ACTION_TONE[tone]}`}
                              >
                                {row.actionLabel}
                              </Link>
                              {showValue ? (
                                <p
                                  className={`text-xs whitespace-nowrap sm:text-sm ${
                                    row.urgent ? "text-red-300" : "text-zinc-300"
                                  }`}
                                >
                                  {value}
                                </p>
                              ) : null}
                              {sub ? (
                                <p className="text-[11px] text-zinc-500">{sub}</p>
                              ) : null}
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={col.key} className="px-3 py-3 text-zinc-300">
                          {value.trim() ? (
                            <p className="smartimport-vehiculo-description">
                              {value}
                            </p>
                          ) : null}
                          {sub ? (
                            <p className="mt-1 line-clamp-2 text-[11px] text-red-300/80">
                              {sub}
                            </p>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  ) : null;

  const headerExtras = (
    <div className="flex shrink-0 items-center gap-2">
      {headerActions ? (
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {headerActions}
        </div>
      ) : null}
      {countBadge}
    </div>
  );

  if (dense) {
    if (!showPanel) {
      return (
        <div
          id={sectionId}
          className="flex items-center justify-between gap-3 px-3 py-2.5"
        >
          {titleRow}
          {headerExtras}
        </div>
      );
    }

    return (
      <details
        id={sectionId}
        className="group"
        open={detailsOpen}
        onToggle={(e) =>
          setDetailsOpen((e.currentTarget as HTMLDetailsElement).open)
        }
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
          {titleRow}
          {headerExtras}
        </summary>
        <div className="space-y-3 border-t border-zinc-800/60 px-3 pb-3 pt-2">
          {leadingContent}
          {tablePanel}
          {!showTable ? (
            <p className="text-sm text-zinc-500">{emptyMessage}</p>
          ) : null}
        </div>
      </details>
    );
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {titleRow}
        <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500">
          {showTable
            ? hasFilters
              ? `${filtered.length}/${rows.length}`
              : rows.length
            : 0}
        </span>
      </div>

      {!showTable ? (
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        tablePanel
      )}
    </section>
  );
}
