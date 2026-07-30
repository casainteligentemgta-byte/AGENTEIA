import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPuertoLibreFicha } from "@/app/actions/nfc/puerto-libre-vehiculo";
import { PlanillaRegistroImportacion } from "@/components/nfc/PlanillaRegistroImportacion";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: { vehiculoId: string };
  searchParams?: { fase?: string };
};

export default async function PlanillaRegistroImportacionPage({
  params,
  searchParams,
}: Props) {
  const user = await getUser();
  if (!user) redirect(`/login?next=/puerto-libre/${params.vehiculoId}/planilla`);

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
  const faseParam = searchParams?.fase;
  const faseInicial =
    faseParam === "3" ? (3 as const) : faseParam === "2" ? (2 as const) : undefined;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/puerto-libre"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Puerto Libre
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Planilla Puerto Libre
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Completa vehículo, importación, propietario. Luego fotos y documentos.
          </p>
        </header>

        <PlanillaRegistroImportacion
          vehiculoId={ficha.id}
          placa={ficha.placa}
          marca={ficha.marca}
          modelo={ficha.modelo}
          color={ficha.color}
          serialMotor={ficha.serial_motor}
          serialCarroceria={ficha.serial_carroceria}
          compradorNombre={ficha.nombre_cliente}
          compradorTelefono={ficha.telefono_cliente}
          compradorCedula={ficha.cedula_propietario}
          compradorEmail={ficha.email_propietario}
          initialImportacion={ficha.importacion}
          initialSeguro={ficha.seguro}
          initialDocumentos={ficha.documentos}
          faseInicial={faseInicial}
        />
      </div>
    </main>
  );
}
