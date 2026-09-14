import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { CUESTIONARIO_VALIDACION_CLIENTE_MD } from "@/lib/importacion/cuestionario-validacion-cliente";
import { CUESTIONARIO_VALIDACION_FLUJO_MD } from "@/lib/importacion/cuestionario-validacion-flujo";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";
import { MarkdownLite } from "@/components/nfc/MarkdownLite";
import { PrintButton } from "@/components/nfc/PrintButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Validación con el cliente — SmartImport",
  description:
    "Cuestionario profesional para validar datos y documentos del flujo Puerto Libre con el cliente.",
};

type Search = { v?: string | string[] };

export default function SmartImportValidacionPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const raw = Array.isArray(searchParams.v) ? searchParams.v[0] : searchParams.v;
  const tab = raw === "flujo" ? "flujo" : "fases";
  const source =
    tab === "flujo"
      ? CUESTIONARIO_VALIDACION_FLUJO_MD
      : CUESTIONARIO_VALIDACION_CLIENTE_MD;

  return (
    <main className="smartimport-typography min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 pb-16 pt-4 sm:px-6 print:bg-white print:px-0">
      <div className="mx-auto max-w-3xl">
        <Link
          href={IMPORTACION_BASE}
          className="mb-3 inline-flex rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 print:hidden"
          aria-label="Volver al dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <header className="mb-5 space-y-2 print:mb-3">
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-cyan-400/90 print:text-zinc-600">
            <ClipboardList className="h-3.5 w-3.5" />
            Validación con el cliente
          </p>
          <h1 className="smartimport-page-title text-zinc-50 print:text-zinc-900">
            Cuestionario Puerto Libre
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400 print:text-zinc-600">
            Revisa fase a fase si los datos y documentos son los de su
            operación. Imprime o exporta a PDF desde el navegador.
          </p>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
          <div
            role="tablist"
            aria-label="Versión del cuestionario"
            className="grid flex-1 grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1"
          >
            <Link
              href="/smartimport/validacion"
              role="tab"
              aria-selected={tab === "fases"}
              className={
                tab === "fases"
                  ? "rounded-lg bg-cyan-600 px-3 py-2 text-center text-sm font-semibold text-white"
                  : "rounded-lg px-3 py-2 text-center text-sm font-medium text-zinc-400 hover:text-zinc-100"
              }
            >
              Por fases
            </Link>
            <Link
              href="/smartimport/validacion?v=flujo"
              role="tab"
              aria-selected={tab === "flujo"}
              className={
                tab === "flujo"
                  ? "rounded-lg bg-cyan-600 px-3 py-2 text-center text-sm font-semibold text-white"
                  : "rounded-lg px-3 py-2 text-center text-sm font-medium text-zinc-400 hover:text-zinc-100"
              }
            >
              Por flujo
            </Link>
          </div>
          <PrintButton />
        </div>

        <MarkdownLite source={source} />
      </div>
    </main>
  );
}
