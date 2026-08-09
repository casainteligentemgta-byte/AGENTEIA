import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HojaInspeccionTransportista } from "@/components/nfc/HojaInspeccionTransportista";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { parseVehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: { vehiculoId?: string };
};

export default async function PuertoLibreHojaInspeccionPage({ searchParams }: Props) {
  const vehiculoId = searchParams?.vehiculoId?.trim() || null;
  let documentos = null;

  if (vehiculoId) {
    const user = await getUser();
    const taller = user ? await getMyTaller() : null;
    if (taller) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("vehiculos")
        .select("id, taller_id, documentos")
        .eq("id", vehiculoId)
        .maybeSingle();
      if (data && data.taller_id === taller.id) {
        documentos = parseVehiculosDocumentos(data.documentos);
      }
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3 print:hidden">
          <Link
            href={vehiculoId ? `/importacion/${vehiculoId}` : "/importacion"}
            className="inline-flex rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 uppercase">
              Planilla recepción en puerto
            </h1>
            <p className="mt-1 text-sm text-zinc-400 print:hidden">
              Completa los campos en pantalla; luego imprime o guarda como PDF.
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm text-zinc-400 print:hidden">
          BL, placa y tablero usan el botón Foto (igual que frontal/laterales).{" "}
          {vehiculoId
            ? "Los archivos se guardan en el expediente del vehículo."
            : "Para guardar adjuntos, abre la planilla desde la ficha del vehículo."}
        </p>

        <HojaInspeccionTransportista
          vehiculoId={vehiculoId}
          initialDocumentos={documentos}
        />
      </div>
    </main>
  );
}
