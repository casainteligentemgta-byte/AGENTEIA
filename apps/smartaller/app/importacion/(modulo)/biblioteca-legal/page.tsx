import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, Scale, ShieldAlert } from "lucide-react";
import { listNormasLegales } from "@/lib/importacion/normas-legales";

export const dynamic = "force-dynamic";

const ESTADO_LABEL: Record<string, string> = {
  vigente: "Vigente",
  referencia: "Referencia",
  borrador: "Borrador",
};

export default function BibliotecaLegalPage() {
  const normas = listNormasLegales();

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
            <Scale className="h-3.5 w-3.5" />
            Cumplimiento
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Biblioteca legal
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400">
            Normas y reglas operativas del módulo Importación. Las marcadas como
            «control automático» se evalúan al registrar o editar un expediente.
          </p>
        </header>

        <div className="mb-6 rounded-2xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          <p className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              MVP: catálogo de consulta + regla enforceable de cupo para persona
              natural (RIF V/E · máx. 1 vehículo en menos de 3 años). Ampliaremos
              resoluciones y comunicados SENIAT.
            </span>
          </p>
        </div>

        <ul className="space-y-4">
          {normas.map((norma) => {
            const automatica = Boolean(norma.reglaCodigo);
            return (
              <li
                key={norma.id}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-cyan-400/90">
                      {norma.codigo}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-zinc-50">
                      {norma.titulo}
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500">{norma.organismo}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                      {ESTADO_LABEL[norma.estado] ?? norma.estado}
                    </span>
                    {automatica ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/50 px-2 py-0.5 text-[11px] text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Control automático
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-500">
                        <BookOpen className="h-3 w-3" />
                        Solo consulta
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                  {norma.resumen}
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  <span className="font-medium text-zinc-300">En el sistema: </span>
                  {norma.obliga}
                </p>

                {norma.etiquetas.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {norma.etiquetas.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-md border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
