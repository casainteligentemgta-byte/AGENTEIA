import { notFound, redirect } from "next/navigation";
import { getPuertoLibreFicha } from "@/app/actions/nfc/importacion-vehiculo";
import { PresentacionSeniatClient } from "@/components/nfc/PresentacionSeniatClient";
import { canMutateImportacionData } from "@/lib/importacion/access";
import { resolvePortalAccess } from "@/lib/portal/roles";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: { vehiculoId: string };
};

export default async function PresentacionSeniatPage({ params }: Props) {
  const user = await getUser();
  if (!user) {
    redirect(`/login?next=/smartimport/${params.vehiculoId}/seniat`);
  }

  const [result, access] = await Promise.all([
    getPuertoLibreFicha(params.vehiculoId),
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

  const canMutate = access ? canMutateImportacionData(access) : false;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <PresentacionSeniatClient
          ficha={result.ficha}
          canMutate={canMutate}
        />
      </div>
    </main>
  );
}
