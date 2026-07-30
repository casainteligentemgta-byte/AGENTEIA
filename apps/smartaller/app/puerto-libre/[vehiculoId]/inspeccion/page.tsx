import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { parseInspeccionTransportista } from "@/lib/schemas/inspeccion-transportista";
import { parseImportacion, parseVehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";
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
    .select(
      "id, placa, taller_id, serial_carroceria, kilometraje_ultimo, importacion, inspeccion_transportista, documentos"
    )
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

  const documentos = parseVehiculosDocumentos(data.documentos);
  const importacion = parseImportacion(data.importacion);

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/puerto-libre/${params.vehiculoId}`}
            className="inline-flex rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="font-mono text-sm text-cyan-400">{data.placa}</p>
            <h1 className="text-2xl font-semibold uppercase tracking-tight text-zinc-50">
              Planilla recepción en puerto
            </h1>
          </div>
        </div>

        <InspeccionTransportistaForm
          vehiculoId={data.id}
          placa={data.placa}
          initial={initial}
          documentos={documentos}
          prefill={{
            importadora: importacion.importadorNombre,
            vin: data.serial_carroceria,
            kilometraje:
              typeof data.kilometraje_ultimo === "number" ? data.kilometraje_ultimo : null,
          }}
        />
      </div>
    </main>
  );
}
