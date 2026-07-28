import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPuertoLibreFicha } from "@/app/actions/nfc/puerto-libre-vehiculo";
import { PuertoLibreFichaClient } from "@/components/nfc/PuertoLibreFichaClient";
import { getAppBaseUrl } from "@/lib/app-url";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: { vehiculoId: string };
};

export default async function PuertoLibreFichaPage({ params }: Props) {
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

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/puerto-libre"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al dashboard
        </Link>

        <header className="mb-8">
          <p className="font-mono text-sm tracking-wide text-cyan-400">{ficha.placa}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            {[ficha.marca, ficha.modelo].filter(Boolean).join(" ") || "Ficha Puerto Libre"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {ficha.nombre_cliente
              ? `Propietario: ${ficha.nombre_cliente}`
              : "Completa documentos, importación, vehículo y propietario"}
          </p>
        </header>

        <PuertoLibreFichaClient ficha={ficha} baseUrl={getAppBaseUrl()} />
      </div>
    </main>
  );
}
