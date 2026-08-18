import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPuertoLibreFicha } from "@/app/actions/nfc/importacion-vehiculo";
import { PuertoLibrePropietarioPlantilla } from "@/components/nfc/PuertoLibrePropietarioPlantilla";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: { vehiculoId: string };
};

export default async function PuertoLibrePropietarioPage({ params }: Props) {
  const user = await getUser();
  if (!user) redirect(`/login?next=/smartimport/${params.vehiculoId}/propietario`);

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
  const codigo = ficha.codigoExpediente ?? "—";

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5">
          <Link
            href={`/smartimport/${ficha.id}`}
            className="inline-flex rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver al expediente"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <header className="mb-6">
          <p className="font-mono text-sm tracking-wide text-cyan-400">{codigo}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            Propietario y seguro
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {[ficha.marca, ficha.modelo].filter(Boolean).join(" ") || ficha.placa}
          </p>
        </header>

        <PuertoLibrePropietarioPlantilla
          vehiculoId={ficha.id}
          compradorNombre={ficha.nombre_cliente}
          compradorTelefono={ficha.telefono_cliente}
          compradorCedula={ficha.cedula_propietario}
          compradorEmail={ficha.email_propietario}
          compradorFechaNacimiento={ficha.fecha_nacimiento_propietario}
          compradorDireccion={ficha.importacion.compradorDireccion ?? null}
          initialSeguro={ficha.seguro}
          initialDocumentos={ficha.documentos}
        />
      </div>
    </main>
  );
}
