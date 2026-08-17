import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getPuertoLibreFicha,
  listPuertoLibreVehiculos,
} from "@/app/actions/nfc/importacion-vehiculo";
import { PlanillaRegistroImportacion } from "@/components/nfc/PlanillaRegistroImportacion";
import { canForzarImprontaSinVerificar } from "@/lib/importacion/access";
import { resolveCodigoExpediente } from "@/lib/importacion/expediente";
import { resolvePortalAccess } from "@/lib/portal/roles";
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
  if (!user) redirect(`/login?next=/smartimport/${params.vehiculoId}/planilla`);

  const [result, list, access] = await Promise.all([
    getPuertoLibreFicha(params.vehiculoId),
    listPuertoLibreVehiculos(),
    resolvePortalAccess(),
  ]);

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
  const canForzarImpronta = access
    ? canForzarImprontaSinVerificar(access)
    : false;
  const faseParam = searchParams?.fase;
  const faseInicial =
    faseParam === "1" || faseParam === "registro"
      ? (1 as const)
      : faseParam === "1a" || faseParam === "1A"
        ? (2 as const)
        : faseParam === "7"
          ? (7 as const)
          : faseParam === "6"
            ? (6 as const)
            : faseParam === "5"
              ? (5 as const)
              : faseParam === "4"
                ? (4 as const)
                : faseParam === "3"
                  ? (3 as const)
                  : faseParam === "2"
                    ? (2 as const)
                    : undefined;

  const vehiculos = (list.success ? list.vehiculos : []).map((v) => ({
    id: v.id,
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    color: v.color,
    codigoExpediente:
      v.codigoExpediente ??
      resolveCodigoExpediente({ codigoExpediente: null, placa: v.placa }),
    fotoUrl: v.fotoUrl,
    created_at: v.created_at,
  }));

  const current = {
    id: ficha.id,
    placa: ficha.placa,
    marca: ficha.marca,
    modelo: ficha.modelo,
    color: ficha.color,
    codigoExpediente:
      ficha.codigoExpediente ??
      resolveCodigoExpediente({
        codigoExpediente: ficha.importacion.codigoExpediente,
        placa: ficha.placa,
      }),
    fotoUrl: ficha.fotoUrl,
    created_at: ficha.created_at,
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5">
          <Link
            href="/smartimport"
            className="inline-flex rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <PlanillaRegistroImportacion
          vehiculoId={ficha.id}
          placa={ficha.placa}
          marca={ficha.marca}
          modelo={ficha.modelo}
          color={ficha.color}
          serialMotor={ficha.serial_motor}
          serialCarroceria={ficha.serial_carroceria}
          kilometrajeUltimo={ficha.kilometraje_ultimo}
          compradorNombre={ficha.nombre_cliente}
          compradorTelefono={ficha.telefono_cliente}
          compradorCedula={ficha.cedula_propietario}
          compradorEmail={ficha.email_propietario}
          initialImportacion={ficha.importacion}
          initialSeguro={ficha.seguro}
          initialDocumentos={ficha.documentos}
          faseInicial={faseInicial}
          canForzarImpronta={canForzarImpronta}
          vehiculoSelector={{ current, vehiculos }}
        />
      </div>
    </main>
  );
}
