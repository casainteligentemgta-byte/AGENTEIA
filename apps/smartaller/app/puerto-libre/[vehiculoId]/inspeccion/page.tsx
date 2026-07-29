import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { parseInspeccionTransportista } from "@/lib/schemas/inspeccion-transportista";
import { InspeccionTransportistaForm } from "@/components/nfc/InspeccionTransportistaForm";

export const dynamic = "force-dynamic";

type Props = {
  params: { vehiculoId: string };
};

export default async function InspeccionTransportistaPage({ params }: Props) {
  const user = await getUser();
  if (!user) redirect(`/login?next=/puerto-libre/${params.vehiculoId}/inspeccion`);

  const taller = await getMyTaller();
  if (!taller) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8 text-sm text-amber-200">
        No se encontró tu taller.
      </main>
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehiculos")
    .select("id, placa, taller_id, inspeccion_transportista")
    .eq("id", params.vehiculoId)
    .maybeSingle();

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("inspeccion_transportista") || msg.includes("column")) {
      return (
        <main className="min-h-screen bg-zinc-950 px-4 py-8">
          <div className="mx-auto max-w-3xl rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Falta la columna <code className="text-amber-100">inspeccion_transportista</code>.
            Ejecuta en Supabase:{" "}
            <code className="text-amber-100">20260729_inspeccion_transportista_pl.sql</code>.
          </div>
        </main>
      );
    }
    notFound();
  }

  if (!data || data.taller_id !== taller.id) notFound();

  const initial = parseInspeccionTransportista({
    ...(typeof data.inspeccion_transportista === "object" && data.inspeccion_transportista
      ? data.inspeccion_transportista
      : {}),
    vehiculoId: data.id,
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/puerto-libre/${params.vehiculoId}`}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la ficha
          </Link>
          <Link
            href="/puerto-libre/hoja-inspeccion"
            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
          >
            <FileText className="h-4 w-4" />
            Planilla en blanco (PDF)
          </Link>
        </div>

        <header className="mb-8">
          <p className="font-mono text-sm text-cyan-400">{data.placa}</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-50">
            Inspección en transportista
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Acta digital al recibir el vehículo de la transportista (Puerto Libre).
          </p>
        </header>

        <InspeccionTransportistaForm
          vehiculoId={data.id}
          placa={data.placa}
          initial={initial}
        />
      </div>
    </main>
  );
}
