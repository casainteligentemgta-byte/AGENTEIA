import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileStack,
  LayoutDashboard,
  Lightbulb,
  Ship,
  Upload,
} from "lucide-react";

export const dynamic = "force-dynamic";

const FASES = [
  {
    n: 1,
    titulo: "Registro",
    puntos: [
      "Vehículo: marca, modelo, color, año, serial motor, VIN y serial carrocería.",
      "Nuevo → km suele ser 0. Usado → km > 0 e indicar si es subasta.",
      "Importador con dirección fiscal (SENIAT / Nueva Esparta cuando aplique).",
      "Datos en orden: régimen → aduana → país → puerto → tránsito/USO24 → aduana tránsito → BL → fecha llegada buque.",
      "Docs obligatorios: factura de compra y certificado de origen.",
    ],
  },
  {
    n: 2,
    titulo: "Embarque",
    puntos: [
      "BL / Guía, lista de empaque y póliza de transporte.",
      "Datos manuales: fecha llegada del buque, puerto, tránsito/USO24, aduana, nº BL, país de origen.",
      "El nº BL (y otros) pueden venir del escaneo del BL; se pueden corregir a mano.",
    ],
  },
  {
    n: 3,
    titulo: "Llegada",
    puntos: [
      "Fecha de ingreso al PL (distinta de la llegada del buque).",
      "Acta de recepción (AR).",
      "Reconocimiento / constancia del estado de la carga.",
      "Memoria fotográfica + verificación de impronta (serial debe coincidir).",
      "Checklist de revisión al llegar.",
    ],
  },
  {
    n: 4,
    titulo: "Desaduanamiento — Expediente SENIAT",
    puntos: [
      "Nombre del Agente de Aduanas.",
      "Cédula y RIF del importador (RIF con dir. Nueva Esparta).",
      "Lista de empaque, DUA, DAV, SENCAMER.",
      "Registro de Puerto Libre (solo persona jurídica).",
      "Documento del agente, reconocimiento, pase de salida y levante.",
      "Cancelación de gastos portuarios, almacén y manipulación.",
      "Genera el Expediente PDF SENIAT con los PDF cargados.",
    ],
  },
  {
    n: 5,
    titulo: "Propietario",
    puntos: [
      "Nombre (obligatorio), cédula, teléfono, email y dirección del comprador.",
    ],
  },
  {
    n: 6,
    titulo: "Seguro",
    puntos: [
      "Aseguradora + póliza, certificado, recibo y RCV.",
      "No confundir con la póliza de transporte del embarque.",
    ],
  },
  {
    n: 7,
    titulo: "Matriculación (INTT)",
    puntos: [
      "Cargar: inspección PNB, homologación (si aplica), PUT y planilla de pago.",
      "Presentar en físico: factura, B/L, DUA, liquidación/exención, experticia, RCV, cédula, RIF y constancia de residencia.",
      "Se entregan el título y las placas PL: toma foto de ambos y registra el número de placa.",
    ],
  },
] as const;

const TIPS = [
  {
    icon: ClipboardList,
    titulo: "Guarda avance por fase",
    texto:
      "Cada “Continuar” persiste. En la planilla, toca el chip de una fase anterior para revisar o corregir sin perder el progreso.",
    href: "/importacion",
    cta: "Ver expedientes pendientes",
  },
  {
    icon: CheckCircle2,
    titulo: "VIN ≠ serial carrocería",
    texto:
      "Ambos son obligatorios. El VIN es internacional; el serial carrocería es el dato SENIAT y se verifica en la impronta.",
    href: "/importacion/importaciones/nueva",
    cta: "Nueva importación",
  },
  {
    icon: FileStack,
    titulo: "Formato RIF",
    texto:
      "Usa V|J|E|G|P|C-########-# (ej. V-12345678-9). Persona natural (V/E): cupo máx. 1 vehículo en menos de 3 años.",
    href: "/importacion/clientes",
    cta: "Ir a Clientes",
  },
  {
    icon: Upload,
    titulo: "Carga masiva",
    texto:
      "Si tienes muchas facturas, usa carga masiva y comparte aduana, BL y fecha de llegada entre unidades.",
    href: "/importacion/carga-masiva",
    cta: "Abrir carga masiva",
  },
  {
    icon: LayoutDashboard,
    titulo: "Dashboard por estado",
    texto:
      "Los buckets del dashboard te llevan directo a la fase pendiente: registro, embarque, recibir en puerto, SENIAT, nacionalizar…",
    href: "/importacion",
    cta: "Ir al dashboard",
  },
] as const;

export default function InstructivoImportacionPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 pb-12 pt-4 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/importacion"
          className="mb-3 inline-flex rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
          aria-label="Volver al dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <header className="mb-6 space-y-2">
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-cyan-400/90">
            <BookOpen className="h-3.5 w-3.5" />
            Guía operativa
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Cómo llenar una importación
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400">
            Paso a paso de la planilla: del registro a la matrícula, más tips
            accionables. Cada unidad genera un expediente{" "}
            <span className="font-mono text-zinc-300">PL-año.mes.N</span>{" "}
            (distinto del número SENIAT).
          </p>
        </header>

        <section className="mb-8 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            Tips rápidos
          </h2>
          <ul className="space-y-3">
            {TIPS.map((tip) => (
              <li
                key={tip.titulo}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4"
              >
                <div className="flex gap-3">
                  <tip.icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                  <div className="min-w-0 space-y-2">
                    <p className="font-medium text-zinc-100">{tip.titulo}</p>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      {tip.texto}
                    </p>
                    <Link
                      href={tip.href}
                      className="inline-flex text-sm font-medium text-cyan-400 hover:text-cyan-300"
                    >
                      {tip.cta} →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-300">
          <p className="flex items-start gap-2">
            <Ship className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            <span>
              Antes de registrar: crea o elige el{" "}
              <Link
                href="/importacion/clientes"
                className="font-medium text-cyan-400 hover:text-cyan-300"
              >
                cliente importador
              </Link>
              . Luego{" "}
              <Link
                href="/importacion/importaciones/nueva"
                className="font-medium text-cyan-400 hover:text-cyan-300"
              >
                nueva importación
              </Link>{" "}
              o carga masiva.
            </span>
          </p>
        </section>

        <ol className="space-y-4">
          {FASES.map((fase) => (
            <li
              key={fase.n}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5"
            >
              <h2 className="flex items-baseline gap-2 text-base font-semibold text-zinc-50">
                <span className="font-mono text-sm text-cyan-400">
                  Fase {fase.n}
                </span>
                {fase.titulo}
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm text-zinc-400">
                {fase.puntos.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                    <span className="leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <section className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5">
          <h2 className="text-base font-semibold text-zinc-50">
            Después de la planilla (Puerto Libre)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            En la ficha del vehículo → nacionalizar:{" "}
            <strong className="font-medium text-zinc-200">M2</strong> (cambio
            de régimen) si aún no cumplen 3 años, o{" "}
            <strong className="font-medium text-zinc-200">M3</strong>{" "}
            (permanencia) si ya cumplieron. Completa el wizard hasta marcar
            nacionalizado.
          </p>
        </section>
      </div>
    </main>
  );
}
