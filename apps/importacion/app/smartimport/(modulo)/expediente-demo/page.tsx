import { redirect } from "next/navigation";
import {
  ensureDemoExpedienteAction,
  listDemoPlantillaPdfsAction,
} from "@/app/actions/nfc/demo-expediente";
import { SmartImportDemoExpediente } from "@/components/nfc/SmartImportDemoExpediente";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export const dynamic = "force-dynamic";

export default async function ExpedienteDemoPage() {
  const user = await getUser();
  if (!user) {
    redirect(
      `${IMPORTACION_BASE}/login?redirectTo=${IMPORTACION_BASE}/expediente-demo`
    );
  }

  const { taller, error: tallerError } = await ensureTallerForUser(user.id);
  if (!taller) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {tallerError ?? "No se pudo cargar tu taller."}
        </div>
      </main>
    );
  }

  const [ensured, listed] = await Promise.all([
    ensureDemoExpedienteAction(),
    listDemoPlantillaPdfsAction(),
  ]);

  if (!ensured.success) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {ensured.error}
        </div>
      </main>
    );
  }

  return (
    <SmartImportDemoExpediente
      vehiculos={ensured.vehiculos}
      created={ensured.created}
      numeroBl={ensured.numeroBl}
      plantillas={listed.success ? listed.plantillas : []}
      listError={listed.success ? null : listed.error}
      bucket={listed.success ? listed.bucket : "vehiculos-documentos"}
      folder={listed.success ? listed.folder : "demo-plantillas"}
    />
  );
}
