"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  attachImportadorDocumentoAction,
  upsertImportadorAction,
} from "@/app/actions/nfc/importadores";
import {
  ImportadorDocScan,
  type ImportadorDocKind,
} from "@/components/nfc/ImportadorDocScan";
import type { ImportadorScanFields } from "@/lib/extract-identidad-ve";
import type { ImportadorDocumentos } from "@/lib/importadores/upload-documento";
import {
  IMPORTADOR_TIPO_LABELS,
  IMPORTADOR_TIPOS,
  type ImportadorTipo,
} from "@/lib/schemas/importador";
import {
  CEDULA_FORMAT_HINT,
  CEDULA_PLACEHOLDER,
} from "@/lib/validations/cedula";
import { RIF_FORMAT_HINT, RIF_PLACEHOLDER } from "@/lib/validations/rif";

export type ImportadorFormValues = {
  id?: string;
  tipo: ImportadorTipo;
  nombresApellidos: string;
  rif: string;
  cedula: string;
  email: string;
  telefono: string;
  direccion: string;
  instagram: string;
  denominacionComercial: string;
  razonSocial: string;
  repLegalNombre: string;
  repLegalCedula: string;
  repLegalEmail: string;
  repLegalTelefono: string;
  empresaTelefono: string;
  empresaEmail: string;
  empresaDomicilio: string;
  registroPuertoLibre: string;
  registroPlVence: string;
};

type SavedImportador = {
  id: string;
  tipo: ImportadorTipo;
  nombre: string;
  documento: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  instagram: string | null;
  denominacionComercial: string | null;
  razonSocial: string | null;
  repLegalNombre: string | null;
  repLegalCedula: string | null;
  repLegalEmail: string | null;
  repLegalTelefono: string | null;
  empresaTelefono: string | null;
  empresaEmail: string | null;
  empresaDomicilio: string | null;
  registroPuertoLibre: string | null;
  registroPlVence: string | null;
  documentos?: ImportadorDocumentos;
};

type Props = {
  initial?: Partial<ImportadorFormValues>;
  initialDocumentos?: ImportadorDocumentos;
  submitLabel?: string;
  onSaved: (importador: SavedImportador) => void;
};

const inputClass =
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-cyan-500/60";
const monoClass = `${inputClass} font-mono uppercase`;

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-zinc-400">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function applyIfPresent(
  value: string | undefined,
  setter: (v: string) => void
) {
  if (value != null && value.trim()) setter(value.trim());
}

export function ImportadorForm({
  initial,
  initialDocumentos,
  submitLabel = "Guardar cliente",
  onSaved,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<ImportadorTipo>(initial?.tipo ?? "natural");
  const [documentos, setDocumentos] = useState<ImportadorDocumentos>(
    initialDocumentos ?? {}
  );
  const [pendingFiles, setPendingFiles] = useState<
    Partial<Record<ImportadorDocKind, File>>
  >({});

  const [nombresApellidos, setNombresApellidos] = useState(
    initial?.nombresApellidos ?? ""
  );
  const [rif, setRif] = useState(initial?.rif ?? "");
  const [cedula, setCedula] = useState(initial?.cedula ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");
  const [direccion, setDireccion] = useState(initial?.direccion ?? "");
  const [instagram, setInstagram] = useState(initial?.instagram ?? "");

  const [denominacionComercial, setDenominacionComercial] = useState(
    initial?.denominacionComercial ?? ""
  );
  const [razonSocial, setRazonSocial] = useState(initial?.razonSocial ?? "");
  const [repLegalNombre, setRepLegalNombre] = useState(
    initial?.repLegalNombre ?? ""
  );
  const [repLegalCedula, setRepLegalCedula] = useState(
    initial?.repLegalCedula ?? ""
  );
  const [repLegalEmail, setRepLegalEmail] = useState(
    initial?.repLegalEmail ?? ""
  );
  const [repLegalTelefono, setRepLegalTelefono] = useState(
    initial?.repLegalTelefono ?? ""
  );
  const [empresaTelefono, setEmpresaTelefono] = useState(
    initial?.empresaTelefono ?? ""
  );
  const [empresaEmail, setEmpresaEmail] = useState(initial?.empresaEmail ?? "");
  const [empresaDomicilio, setEmpresaDomicilio] = useState(
    initial?.empresaDomicilio ?? ""
  );
  const [registroPuertoLibre, setRegistroPuertoLibre] = useState(
    initial?.registroPuertoLibre ?? ""
  );
  const [registroPlVence, setRegistroPlVence] = useState(
    initial?.registroPlVence ?? ""
  );

  function patchFromScan(
    fields: ImportadorScanFields,
    tipoDoc: ImportadorDocKind,
    file: File
  ) {
    if (fields.tipo) setTipo(fields.tipo);
    applyIfPresent(fields.nombresApellidos, setNombresApellidos);
    applyIfPresent(fields.rif, setRif);
    applyIfPresent(fields.cedula, setCedula);
    applyIfPresent(fields.email, setEmail);
    applyIfPresent(fields.telefono, setTelefono);
    applyIfPresent(fields.direccion, setDireccion);
    applyIfPresent(fields.denominacionComercial, setDenominacionComercial);
    applyIfPresent(fields.razonSocial, setRazonSocial);
    applyIfPresent(fields.repLegalNombre, setRepLegalNombre);
    applyIfPresent(fields.repLegalCedula, setRepLegalCedula);
    applyIfPresent(fields.repLegalEmail, setRepLegalEmail);
    applyIfPresent(fields.repLegalTelefono, setRepLegalTelefono);
    applyIfPresent(fields.empresaTelefono, setEmpresaTelefono);
    applyIfPresent(fields.empresaEmail, setEmpresaEmail);
    applyIfPresent(fields.empresaDomicilio, setEmpresaDomicilio);
    setPendingFiles((prev) => ({ ...prev, [tipoDoc]: file }));
  }

  async function uploadPendingDocs(importadorId: string): Promise<{
    documentos: ImportadorDocumentos;
    attachError: string | null;
  }> {
    let nextDocs = { ...documentos };
    let attachError: string | null = null;
    for (const tipoDoc of ["rif", "cedula"] as const) {
      const file = pendingFiles[tipoDoc];
      if (!file) continue;
      const fd = new FormData();
      fd.set("importadorId", importadorId);
      fd.set("tipoDoc", tipoDoc);
      fd.set("file", file);
      const up = await attachImportadorDocumentoAction(fd);
      if (!up.success) {
        attachError = up.error;
        continue;
      }
      nextDocs = up.documentos;
    }
    return { documentos: nextDocs, attachError };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload =
        tipo === "natural"
          ? {
              id: initial?.id,
              tipo: "natural" as const,
              nombresApellidos,
              rif,
              cedula,
              email,
              telefono,
              direccion,
              instagram,
            }
          : {
              id: initial?.id,
              tipo: "juridica" as const,
              denominacionComercial,
              razonSocial,
              rif,
              repLegalNombre,
              repLegalCedula,
              repLegalEmail,
              repLegalTelefono,
              empresaTelefono,
              empresaEmail,
              empresaDomicilio,
              registroPuertoLibre,
              registroPlVence,
            };

      const result = await upsertImportadorAction(payload);
      if (!result.success) {
        setError(result.error);
        return;
      }

      let saved: SavedImportador = result.importador;
      if (Object.keys(pendingFiles).length > 0) {
        const { documentos: nextDocs, attachError } = await uploadPendingDocs(
          saved.id
        );
        setDocumentos(nextDocs);
        setPendingFiles({});
        saved = { ...saved, documentos: nextDocs };
        if (attachError) {
          setError(
            `Cliente guardado, pero no se pudo adjuntar un documento: ${attachError}`
          );
          onSaved(saved);
          return;
        }
      }

      onSaved(saved);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <Field label="Tipo *">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as ImportadorTipo)}
          className={inputClass}
        >
          {IMPORTADOR_TIPOS.map((t) => (
            <option key={t} value={t}>
              {IMPORTADOR_TIPO_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <ImportadorDocScan
        tipoCliente={tipo}
        existingDocumentos={documentos}
        onExtracted={patchFromScan}
      />

      {tipo === "natural" ? (
        <>
          <Field label="Nombres y apellidos *">
            <input
              value={nombresApellidos}
              onChange={(e) => setNombresApellidos(e.target.value)}
              required
              className={inputClass}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="RIF *" hint={RIF_FORMAT_HINT}>
              <input
                value={rif}
                onChange={(e) => setRif(e.target.value.toUpperCase())}
                required
                placeholder={RIF_PLACEHOLDER}
                className={monoClass}
              />
            </Field>
            <Field label="Cédula *" hint={CEDULA_FORMAT_HINT}>
              <input
                value={cedula}
                onChange={(e) => setCedula(e.target.value.toUpperCase())}
                required
                placeholder={CEDULA_PLACEHOLDER}
                className={monoClass}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono">
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Dirección">
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Instagram">
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@usuario"
              className={inputClass}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Denominación comercial *">
            <input
              value={denominacionComercial}
              onChange={(e) => setDenominacionComercial(e.target.value)}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Razón social *">
            <input
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              required
              className={inputClass}
            />
          </Field>
          <Field label="RIF *" hint={RIF_FORMAT_HINT}>
            <input
              value={rif}
              onChange={(e) => setRif(e.target.value.toUpperCase())}
              required
              placeholder={RIF_PLACEHOLDER}
              className={monoClass}
            />
          </Field>

          <p className="pt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Representante legal
          </p>
          <Field label="Nombres y apellidos *">
            <input
              value={repLegalNombre}
              onChange={(e) => setRepLegalNombre(e.target.value)}
              required
              className={inputClass}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cédula *" hint={CEDULA_FORMAT_HINT}>
              <input
                value={repLegalCedula}
                onChange={(e) => setRepLegalCedula(e.target.value.toUpperCase())}
                required
                placeholder={CEDULA_PLACEHOLDER}
                className={monoClass}
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={repLegalTelefono}
                onChange={(e) => setRepLegalTelefono(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Email">
            <input
              type="email"
              value={repLegalEmail}
              onChange={(e) => setRepLegalEmail(e.target.value)}
              className={inputClass}
            />
          </Field>

          <p className="pt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Empresa
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono de la empresa">
              <input
                value={empresaTelefono}
                onChange={(e) => setEmpresaTelefono(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Email de la empresa">
              <input
                type="email"
                value={empresaEmail}
                onChange={(e) => setEmpresaEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Domicilio de la empresa">
            <input
              value={empresaDomicilio}
              onChange={(e) => setEmpresaDomicilio(e.target.value)}
              className={inputClass}
            />
          </Field>

          <p className="pt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Registro Puerto Libre
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nº de registro *">
              <input
                value={registroPuertoLibre}
                onChange={(e) => setRegistroPuertoLibre(e.target.value)}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Fecha de vencimiento *">
              <input
                type="date"
                value={registroPlVence}
                onChange={(e) => setRegistroPlVence(e.target.value)}
                required
                className={inputClass}
              />
            </Field>
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
      >
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
