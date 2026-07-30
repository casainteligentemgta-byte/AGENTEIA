import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPuertoLibreFicha } from "@/app/actions/nfc/puerto-libre-vehiculo";
import { PuertoLibreExpedienteView } from "@/components/nfc/PuertoLibreExpedienteView";
import { PuertoLibreFichaClient } from "@/components/nfc/PuertoLibreFichaClient";
import { getAppBaseUrl } from "@/lib/app-url";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: { vehiculoId: string };
  searchParams?: { edit?: string };
};

export default async function PuertoLibreFichaPage({ params, searchParams }: Props) {
  const user = await getUser();
  if (!user) redirect(`/login?next=/puerto-libre/${params.vehiculoId}`);

  const result = await getPuertoLibreFicha(params.vehiculoId);
  if (!result.success) {
    if (result.error === "Vehículo no encontrado") notFound();
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {result.error}
        </div>
      </main>
    );
  }

  const { ficha } = result;
  const editing = searchParams?.edit === "1";
  const codigo = ficha.codigoExpediente ?? ficha.placa;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            href="/puerto-libre"
            className="inline-flex rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {editing ? (
            <Link
              href={`/puerto-libre/${ficha.id}`}
              className="text-sm text-zinc-400 transition hover:text-zinc-200"
            >
              Ver expediente
            </Link>
          ) : null}
        </div>

        {editing ? (
          <>
            <header className="mb-6">
              <p className="font-mono text-sm tracking-wide text-cyan-400">{codigo}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                Editar expediente
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {[ficha.marca, ficha.modelo].filter(Boolean).join(" ") || ficha.placa}
              </p>
            </header>
            <PuertoLibreFichaClient ficha={ficha} baseUrl={getAppBaseUrl()} />
          </>
        ) : (
          <PuertoLibreExpedienteView ficha={ficha} />
        )}
      </div>
    </main>
  );
}
