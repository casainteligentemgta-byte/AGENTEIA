import { formatCedulaDisplay } from "@/lib/validations/cedula";
import type { ImportadorTipo } from "@/lib/schemas/importador";
import { IMPORTADOR_TIPO_LABELS } from "@/lib/schemas/importador";

export type ImportadorFichaFuente = {
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
};

export type ImportadorFichaDato = {
  label: string;
  value: string;
};

function row(label: string, value: string | null | undefined): ImportadorFichaDato | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return { label, value: v };
}

/** Campos visibles de la ficha (sin PDFs). */
export function importadorFichaDatos(
  c: ImportadorFichaFuente
): ImportadorFichaDato[] {
  const tipo = IMPORTADOR_TIPO_LABELS[c.tipo];
  if (c.tipo === "juridica") {
    return [
      row("Tipo", tipo),
      row("Denominación comercial", c.denominacionComercial || c.nombre),
      row("Razón social", c.razonSocial),
      row("RIF", c.documento),
      row("Registro Puerto Libre", c.registroPuertoLibre),
      row("Vence registro PL", c.registroPlVence),
      row("Domicilio", c.empresaDomicilio || c.direccion),
      row("Teléfono empresa", c.empresaTelefono || c.telefono),
      row("Correo empresa", c.empresaEmail || c.email),
      row("Representante legal", c.repLegalNombre),
      row(
        "Cédula del representante",
        c.repLegalCedula ? formatCedulaDisplay(c.repLegalCedula) : c.cedula
      ),
      row("Teléfono representante", c.repLegalTelefono),
      row("Correo representante", c.repLegalEmail),
    ].filter((x): x is ImportadorFichaDato => Boolean(x));
  }

  return [
    row("Tipo", tipo),
    row("Nombre", c.nombre),
    row("RIF", c.documento),
    row("Cédula", c.cedula ? formatCedulaDisplay(c.cedula) : null),
    row("Teléfono", c.telefono),
    row("Correo", c.email),
    row("Dirección", c.direccion),
    row("Instagram", c.instagram),
  ].filter((x): x is ImportadorFichaDato => Boolean(x));
}
