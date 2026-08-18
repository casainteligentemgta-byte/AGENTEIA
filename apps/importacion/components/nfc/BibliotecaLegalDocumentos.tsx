"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import {
  deleteBibliotecaLegalDocumentoAction,
  listBibliotecaLegalDocumentosAction,
  uploadBibliotecaLegalPdfAction,
} from "@/app/actions/nfc/biblioteca-legal";
import {
  BIBLIOTECA_LEGAL_CATEGORIA_LABELS,
  BIBLIOTECA_LEGAL_CATEGORIAS,
  formatFileSize,
  type BibliotecaLegalCategoria,
  type BibliotecaLegalDocumento,
} from "@/lib/importacion/biblioteca-legal-docs";
import type { NormaLegal } from "@/lib/importacion/normas-legales";

type Props = {
  normas: NormaLegal[];
  onDocumentosChange?: (docs: BibliotecaLegalDocumento[]) => void;
};

export function BibliotecaLegalDocumentos({ normas, onDocumentosChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [canUpload, setCanUpload] = useState(false);
  const [documentos, setDocumentos] = useState<BibliotecaLegalDocumento[]>([]);
  const [filter, setFilter] = useState<BibliotecaLegalCategoria | "todas">(
    "todas"
  );
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] =
    useState<BibliotecaLegalCategoria>("decreto");
  const [organismo, setOrganismo] = useState("");
  const [anio, setAnio] = useState("");
  const [normaId, setNormaId] = useState("");
  const [fileLabel, setFileLabel] = useState("Ningún PDF seleccionado");

  function applyDocs(
    next:
      | BibliotecaLegalDocumento[]
      | ((prev: BibliotecaLegalDocumento[]) => BibliotecaLegalDocumento[])
  ) {
    setDocumentos((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      onDocumentosChange?.(resolved);
      return resolved;
    });
  }

  useEffect(() => {
    startTransition(async () => {
      const result = await listBibliotecaLegalDocumentosAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCanUpload(result.canUpload);
      applyDocs(result.documentos);
    });
    // Solo carga inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUpload(form: HTMLFormElement) {
    setError(null);
    setMessage(null);
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Selecciona un PDF");
      return;
    }

    startTransition(async () => {
      const result = await uploadBibliotecaLegalPdfAction(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      applyDocs((prev) => [result.documento, ...prev]);
      setMessage("PDF guardado en la biblioteca");
      setTitulo("");
      setOrganismo("");
      setAnio("");
      setNormaId("");
      setFileLabel("Ningún PDF seleccionado");
      form.reset();
      setCategoria("decreto");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function handleDelete(id: string) {
    setError(null);
    setMessage(null);
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteBibliotecaLegalDocumentoAction(id);
      setDeletingId(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      applyDocs((prev) => prev.filter((d) => d.id !== id));
      setMessage("PDF eliminado");
    });
  }

  const visible =
    filter === "todas"
      ? documentos
      : documentos.filter((d) => d.categoria === filter);

  return (
    <section className="space-y-4 rounded-2xl border border-cyan-900/40 bg-cyan-950/15 p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Paperclip className="h-4 w-4 text-cyan-400" />
          Textos oficiales (PDF)
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Decretos, leyes, anexos, aranceles y gacetas. Máx. 10 MB por archivo.
        </p>
      </div>

      {canUpload ? (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleUpload(e.currentTarget);
          }}
        >
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs text-slate-400">Título *</span>
            <input
              name="titulo"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Decreto de aranceles 2026"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Tipo *</span>
            <select
              name="categoria"
              value={categoria}
              onChange={(e) =>
                setCategoria(e.target.value as BibliotecaLegalCategoria)
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            >
              {BIBLIOTECA_LEGAL_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {BIBLIOTECA_LEGAL_CATEGORIA_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Organismo</span>
            <input
              name="organismo"
              value={organismo}
              onChange={(e) => setOrganismo(e.target.value)}
              placeholder="SENIAT, INTT, Gaceta…"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Año</span>
            <input
              name="anio"
              type="number"
              min={1900}
              max={2100}
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              placeholder="2026"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Vincular a norma</span>
            <select
              name="normaId"
              value={normaId}
              onChange={(e) => setNormaId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
            >
              <option value="">Sin vincular</option>
              {normas.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.codigo} · {n.titulo}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <input
              ref={fileRef}
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFileLabel(f ? f.name : "Ningún PDF seleccionado");
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-500/40 bg-cyan-950/30 px-3 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-950/50"
            >
              <Upload className="h-4 w-4 shrink-0" />
              {fileLabel}
            </button>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {pending && !deletingId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {pending && !deletingId ? "Subiendo…" : "Subir PDF"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      {documentos.length > 0 ? (
        <div className="flex gap-1 overflow-x-auto pb-1">
          <FilterChip
            active={filter === "todas"}
            label={`Todos (${documentos.length})`}
            onClick={() => setFilter("todas")}
          />
          {BIBLIOTECA_LEGAL_CATEGORIAS.map((c) => {
            const count = documentos.filter((d) => d.categoria === c).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={c}
                active={filter === c}
                label={`${BIBLIOTECA_LEGAL_CATEGORIA_LABELS[c]} (${count})`}
                onClick={() => setFilter(c)}
              />
            );
          })}
        </div>
      ) : null}

      {pending && documentos.length === 0 && !error ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando documentos…
        </p>
      ) : null}

      {visible.length > 0 ? (
        <ul className="space-y-2">
          {visible.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-100">
                    {doc.titulo}
                  </p>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                    {BIBLIOTECA_LEGAL_CATEGORIA_LABELS[doc.categoria]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[
                    doc.organismo,
                    doc.anio ? String(doc.anio) : null,
                    doc.fileName,
                    formatFileSize(doc.fileSize),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-cyan-300 underline hover:text-cyan-100"
                  >
                    Ver PDF
                  </a>
                  {canUpload ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(doc.id)}
                      className="inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-100 disabled:opacity-50"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : !pending && !error ? (
        <p className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-center text-sm text-slate-500">
          Aún no hay PDFs. Sube decretos, leyes, anexos o aranceles.
        </p>
      ) : null}
    </section>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
        active
          ? "bg-cyan-500/20 text-cyan-100"
          : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
