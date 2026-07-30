import Link from "next/link";
import { ExternalLink, FileText, ImageIcon, Pencil } from "lucide-react";
import type { PuertoLibreFicha } from "@/app/actions/nfc/puerto-libre-vehiculo";
import {
  DOCUMENTO_LABELS,
  ESTADO_NACIONALIZACION_LABELS,
  ESTADO_SENIAT_LABELS,
  MEMORIA_FOTOGRAFICA_TIPOS,
  PL_REGISTRO_DOCUMENTO_TIPOS,
  SEGURO_DOCUMENTO_TIPOS,
  type DocumentoTipo,
  type EstadoNacionalizacion,
  type EstadoSeniat,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

type Props = {
  ficha: PuertoLibreFicha;
};

function valor(v: string | number | null | undefined, fallback = "—") {
  if (v == null) return fallback;
  if (typeof v === "string" && !v.trim()) return fallback;
  return String(v);
}

function DocRow({
  tipo,
  docs,
}: {
  tipo: DocumentoTipo;
  docs: VehiculosDocumentos;
}) {
  const ref = docs[tipo];
  const label = DOCUMENTO_LABELS[tipo];
  if (!ref?.url) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5">
        <span className="text-sm text-zinc-400">{label}</span>
        <span className="text-xs text-zinc-600">Sin cargar</span>
      </li>
    );
  }
  const isImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(ref.url) || tipo.startsWith("foto_");
  return (
    <li>
      <a
        href={ref.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5 transition hover:border-cyan-700/50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 text-zinc-500">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ref.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{label}</span>
        <ExternalLink className="h-4 w-4 shrink-0 text-cyan-400" />
      </a>
    </li>
  );
}

export function PuertoLibreExpedienteView({ ficha }: Props) {
  const imp = ficha.importacion;
  const codigo = ficha.codigoExpediente ?? ficha.placa;
  const titulo =
    [ficha.marca, ficha.modelo].filter(Boolean).join(" ") || "Expediente Puerto Libre";

  const docTipos: DocumentoTipo[] = [
    ...PL_REGISTRO_DOCUMENTO_TIPOS,
    "cedula",
    "titulo",
    ...SEGURO_DOCUMENTO_TIPOS,
  ];
  const docsCargados = docTipos.filter((t) => Boolean(ficha.documentos[t]?.url));
  const fotosCargadas = MEMORIA_FOTOGRAFICA_TIPOS.filter((t) =>
    Boolean(ficha.documentos[t]?.url)
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm tracking-wide text-cyan-400">{codigo}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            {titulo}
          </h1>
          {ficha.color || imp.anio ? (
            <p className="mt-1 text-sm text-zinc-400">
              {[ficha.color, imp.anio].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        <Link
          href={`/puerto-libre/${ficha.id}?edit=1`}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Link>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">Datos del vehículo</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Dato label="Marca" value={ficha.marca} />
          <Dato label="Modelo" value={ficha.modelo} />
          <Dato label="Color" value={ficha.color} />
          <Dato label="Año" value={imp.anio} />
          <Dato label="Serial motor" value={ficha.serial_motor} mono />
          <Dato label="Serial carrocería" value={ficha.serial_carroceria} mono />
          <Dato label="Kilometraje" value={ficha.kilometraje_ultimo} />
          <Dato label="Placa" value={ficha.placa} mono />
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">Importador / comprador</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Dato label="Nombre" value={imp.importadorNombre ?? ficha.nombre_cliente} />
          <Dato
            label="Documento"
            value={imp.importadorDocumento ?? ficha.cedula_propietario}
          />
          <Dato label="Teléfono" value={imp.importadorTelefono ?? ficha.telefono_cliente} />
          <Dato label="Email" value={imp.importadorEmail ?? ficha.email_propietario} />
          <Dato label="Dirección" value={imp.compradorDireccion} wide />
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">Importación</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Dato label="Régimen" value={imp.regimen} />
          <Dato label="Aduana" value={imp.aduana} />
          <Dato label="Fecha llegada buque" value={imp.fechaLlegadaBuque} />
          <Dato label="Fecha ingreso al PL" value={imp.fechaIngreso} />
          <Dato label="Nº BL / Guía" value={imp.numeroBl} />
          <Dato label="País origen" value={imp.paisOrigen} />
          <Dato label="Valor CIF" value={imp.valorCif} />
          <Dato
            label="Nacionalización"
            value={
              ESTADO_NACIONALIZACION_LABELS[
                (imp.estadoNacionalizacion as EstadoNacionalizacion) ?? "pendiente"
              ]
            }
          />
          <Dato
            label="SENIAT"
            value={
              ESTADO_SENIAT_LABELS[(imp.estadoSeniat as EstadoSeniat) ?? "pendiente"]
            }
          />
          <Dato label="Observaciones" value={imp.observaciones} wide />
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-200">Documentos</h2>
          <span className="text-xs text-zinc-500">
            {docsCargados.length}/{docTipos.length} cargados
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {docTipos.map((tipo) => (
            <DocRow key={tipo} tipo={tipo} docs={ficha.documentos} />
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <ImageIcon className="h-4 w-4 text-cyan-400" />
            Memoria fotográfica
          </h2>
          <span className="text-xs text-zinc-500">
            {fotosCargadas.length}/{MEMORIA_FOTOGRAFICA_TIPOS.length}
          </span>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MEMORIA_FOTOGRAFICA_TIPOS.map((tipo) => {
            const url = ficha.documentos[tipo]?.url;
            return (
              <li key={tipo}>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={DOCUMENTO_LABELS[tipo]}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <p className="truncate px-2 py-1.5 text-[11px] text-zinc-400">
                      {DOCUMENTO_LABELS[tipo]}
                    </p>
                  </a>
                ) : (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 px-2 text-center">
                    <ImageIcon className="h-5 w-5 text-zinc-700" />
                    <p className="mt-1 text-[11px] text-zinc-600">
                      {DOCUMENTO_LABELS[tipo]}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {(imp.planillaFase == null || imp.planillaFase < 4) && (
        <Link
          href={
            imp.planillaFase != null && imp.planillaFase >= 3
              ? `/puerto-libre/${ficha.id}/planilla?fase=3`
              : `/puerto-libre/${ficha.id}/planilla?fase=2`
          }
          className="flex w-full items-center justify-center rounded-xl border border-cyan-800/50 bg-cyan-950/30 px-4 py-3 text-sm font-medium text-cyan-300 transition hover:border-cyan-600/50"
        >
          {imp.planillaFase != null && imp.planillaFase >= 3
            ? "Continuar fase 3 — Docs y comprador"
            : "Continuar llegada — Fase 2"}
        </Link>
      )}
    </div>
  );
}

function Dato({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd
        className={`mt-0.5 text-sm text-zinc-100 ${mono ? "font-mono" : ""} ${
          wide ? "whitespace-pre-wrap" : ""
        }`}
      >
        {valor(value)}
      </dd>
    </div>
  );
}
