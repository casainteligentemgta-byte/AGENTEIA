import Link from "next/link";
import { ExternalLink, FileText, ImageIcon, Pencil } from "lucide-react";
import type { PuertoLibreFicha } from "@/app/actions/nfc/importacion-vehiculo";
import { PuertoLibreDeleteExpediente } from "@/components/nfc/PuertoLibreDeleteExpediente";
import { PuertoLibreDescargarPdf } from "@/components/nfc/PuertoLibreDescargarPdf";
import {
  DOCUMENTO_LABELS,
  ESTADO_NACIONALIZACION_LABELS,
  ESTADO_SENIAT_LABELS,
  MEMORIA_FOTOGRAFICA_TIPOS,
  PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
  PL_EMBARQUE_DOCUMENTO_TIPOS,
  PL_MATRICULACION_NUEVOS_TIPOS,
  PL_NACIONALIZACION_M2_TIPOS,
  PL_NACIONALIZACION_M3_TIPOS,
  SEGURO_DOCUMENTO_TIPOS,
  type DocumentoTipo,
  type EstadoNacionalizacion,
  type EstadoSeniat,
  type VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";
import { placaRealVisible } from "@/lib/importacion/expediente";
import {
  getRegimenConfig,
  labelRegimenImportacion,
} from "@/lib/importacion/regimenes";
import { SeniatRechazoPanel } from "@/components/nfc/SeniatRechazoPanel";

type Props = {
  ficha: PuertoLibreFicha;
  /** @deprecated Ya no se usa en la ficha de solo lectura. */
  baseUrl?: string;
  canMutate?: boolean;
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

export function PuertoLibreExpedienteView({ ficha, canMutate = false }: Props) {
  const imp = ficha.importacion;
  const codigo = ficha.codigoExpediente ?? "—";
  const titulo =
    [ficha.marca, ficha.modelo].filter(Boolean).join(" ") || "Expediente Puerto Libre";

  const docTipos: DocumentoTipo[] = Array.from(
    new Set<DocumentoTipo>([
      ...PL_EMBARQUE_DOCUMENTO_TIPOS,
      ...PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
      "manual_vehiculo",
      "cedula",
      "titulo",
      ...SEGURO_DOCUMENTO_TIPOS,
      ...PL_MATRICULACION_NUEVOS_TIPOS,
      ...PL_NACIONALIZACION_M2_TIPOS,
      ...PL_NACIONALIZACION_M3_TIPOS,
    ])
  );
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
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/importacion/${ficha.id}?edit=1`}
            aria-label="Editar expediente"
            title="Editar"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-white transition hover:bg-cyan-500"
          >
            <Pencil className="h-5 w-5" />
          </Link>
          <PuertoLibreDescargarPdf vehiculoId={ficha.id} variant="icon" />
        </div>
      </header>

      <SeniatRechazoPanel
        vehiculoId={ficha.id}
        importacion={imp}
        canMutate={canMutate}
      />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">Datos del vehículo</h2>
        <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-3">
          <Dato label="Marca" value={ficha.marca} />
          <Dato label="Modelo" value={ficha.modelo} />
          <Dato label="Color" value={ficha.color} />
          <Dato label="Año" value={imp.anio} />
          <Dato label="Serial motor" value={ficha.serial_motor} mono />
          <Dato label="VIN" value={imp.vin} mono />
          <Dato label="Serial carrocería" value={ficha.serial_carroceria} mono />
          <Dato label="Kilometraje" value={ficha.kilometraje_ultimo} />
          <Dato label="Partida arancelaria" value={imp.partidaArancelaria} mono />
          <Dato label="Cilindrada (cc)" value={imp.cilindradaCc} />
          <Dato
            label="Combustible"
            value={
              imp.tipoCombustible
                ? ({
                    gasolina: "Gasolina",
                    diesel: "Diésel",
                    electrico: "Eléctrico",
                    hibrido: "Híbrido",
                    gnv: "GNV / gas",
                    otro: "Otro",
                  } as const)[imp.tipoCombustible]
                : null
            }
          />
          <Dato
            label="Condición"
            value={
              imp.condicionVehiculo === "nuevo"
                ? "Nuevo"
                : imp.condicionVehiculo === "usado"
                  ? "Usado"
                  : null
            }
          />
          {imp.condicionVehiculo === "usado" ? (
            <Dato
              label="Subasta"
              value={
                imp.esSubasta === true
                  ? "Sí"
                  : imp.esSubasta === false
                    ? "No"
                    : null
              }
            />
          ) : null}
          <Dato
            label="Placa"
            value={placaRealVisible(ficha.placa, ficha.codigoExpediente)}
            mono
          />
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">Importador / comprador</h2>
        <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-3">
          <Dato label="Nombre" value={imp.importadorNombre ?? ficha.nombre_cliente} />
          <Dato
            label="RIF"
            value={imp.importadorDocumento ?? ficha.cedula_propietario}
          />
          <Dato label="Teléfono" value={imp.importadorTelefono ?? ficha.telefono_cliente} />
          <Dato label="Email" value={imp.importadorEmail ?? ficha.email_propietario} />
          <Dato label="Dirección fiscal" value={imp.importadorDireccion} wide />
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-200">Importación</h2>
          {!imp.aduana?.trim() ||
          !imp.numeroBl?.trim() ||
          !imp.paisOrigen?.trim() ||
          imp.valorCif == null ? (
            <Link
              href={`/importacion/${ficha.id}?edit=1`}
              className="shrink-0 text-xs font-medium text-cyan-400 hover:text-cyan-300"
            >
              Completar datos
            </Link>
          ) : null}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-3">
          <Dato label="Régimen" value={labelRegimenImportacion(imp.regimen)} />
          <Dato label="Aduana" value={imp.aduana} />
          <Dato label="País origen" value={imp.paisOrigen} />
          <Dato label="Puerto" value={imp.puerto} />
          <Dato
            label="Tránsito / USO24"
            value={
              imp.modalidadTransito === "transito"
                ? "Tránsito"
                : imp.modalidadTransito === "uso24"
                  ? "USO24"
                  : imp.modalidadTransito === "ninguno"
                    ? "No"
                    : null
            }
          />
          <Dato label="Aduana tránsito" value={imp.aduanaTransito} />
          <Dato label="Nº BL / Guía" value={imp.numeroBl} />
          <Dato label="Fecha llegada buque" value={imp.fechaLlegadaBuque} />
          <Dato label="Fecha ingreso al PL" value={imp.fechaIngreso} />
          <Dato label="Valor CIF" value={imp.valorCif} />
          <Dato label="Tasa BCV" value={imp.tasaCambioBcv} />
          <Dato label="Nº expediente SENIAT" value={imp.numeroExpedienteSeniat} mono />
          <Dato label="Nº DAV" value={imp.numeroDav} mono />
          <Dato
            label="Nº certificado origen"
            value={imp.numeroCertificadoOrigen}
            mono
          />
          <Dato label="Nº lista empaque" value={imp.numeroListaEmpaque} mono />
          <Dato
            label="Nº póliza transporte"
            value={imp.numeroPolizaTransporte}
            mono
          />
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

      <PuertoLibreDeleteExpediente vehiculoId={ficha.id} codigo={codigo} />

      <Link
        href={`/importacion/${ficha.id}?edit=1`}
        className="flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-3 text-sm font-medium uppercase tracking-wide text-white transition hover:bg-cyan-500"
      >
        Editar
      </Link>

      {(imp.planillaFase ?? 0) >= 8 &&
      getRegimenConfig(imp.regimen).nacionalizacionPuertoLibre &&
      imp.estadoNacionalizacion !== "nacionalizado" &&
      imp.estadoNacionalizacion !== "no_aplica" ? (
        <Link
          href={`/importacion/${ficha.id}/nacionalizar`}
          className="flex w-full items-center justify-center rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-100 transition hover:border-amber-500/60"
        >
          Nacionalizar (Tierra Firme)
        </Link>
      ) : null}
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
    <div className={wide ? "col-span-3" : "min-w-0"}>
      <dt className="text-[11px] text-zinc-500 sm:text-xs">{label}</dt>
      <dd
        className={`mt-0.5 break-words text-xs text-zinc-100 sm:text-sm ${
          mono ? "font-mono" : ""
        } ${wide ? "whitespace-pre-wrap" : ""}`}
      >
        {valor(value)}
      </dd>
    </div>
  );
}
