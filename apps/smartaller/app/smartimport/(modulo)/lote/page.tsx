import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  getCargaBlLoteAction,
  listCargaBlIndexAction,
} from "@/app/actions/nfc/importacion-lote";
import { listPuertoLibreVehiculos } from "@/app/actions/nfc/importacion-vehiculo";
import {
  PuertoLibreCargaBlAssign,
  PuertoLibreCargaBlIndex,
  PuertoLibreCargaBlLoteView,
} from "@/components/nfc/PuertoLibreCargaBlClient";
import { cargaBlPath, normalizeLoteBlKey } from "@/lib/importacion/expediente-lote";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: { bl?: string; from?: string };
};

export default async function CargaBlLotePage({ searchParams }: Props) {
  const user = await getUser();
  if (!user) redirect("/smartimport/login?redirectTo=/smartimport/lote");

  const blKey = normalizeLoteBlKey(searchParams?.bl);
  const fromId = (searchParams?.from ?? "").trim();

  if (blKey) {
    const result = await getCargaBlLoteAction(blKey);
    if (!result.success) {
      return (
        <LoteShell>
          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
            {result.error}
          </div>
        </LoteShell>
      );
    }
    return (
      <LoteShell>
        <PuertoLibreCargaBlLoteView lote={result.lote} />
      </LoteShell>
    );
  }

  if (fromId) {
    const list = await listPuertoLibreVehiculos();
    const vehiculo = list.success
      ? list.vehiculos.find((v) => v.id === fromId)
      : null;
    if (!vehiculo) {
      return (
        <LoteShell>
          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
            Expediente no encontrado.
          </div>
        </LoteShell>
      );
    }
    const existingBl = normalizeLoteBlKey(vehiculo.numeroBl);
    if (existingBl) redirect(cargaBlPath(existingBl));
    return (
      <LoteShell>
        <PuertoLibreCargaBlAssign
          vehiculoId={vehiculo.id}
          codigoExpediente={vehiculo.codigoExpediente ?? vehiculo.placa}
          vin={vehiculo.vin}
        />
      </LoteShell>
    );
  }

  const index = await listCargaBlIndexAction();
  if (!index.success) {
    return (
      <LoteShell>
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {index.error}
        </div>
      </LoteShell>
    );
  }

  return (
    <LoteShell>
      <PuertoLibreCargaBlIndex lotes={index.lotes} />
    </LoteShell>
  );
}

function LoteShell({ children }: { children: ReactNode }) {
  return (
    <main className="smartimport-typography min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">{children}</div>
    </main>
  );
}
