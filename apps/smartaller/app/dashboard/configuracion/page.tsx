import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { ConfigForm } from "@/components/dashboard/config-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const user = await getUser();
  const taller = user ? await ensureTallerForUser(user.id) : null;

  if (!taller) {
    return (
      <div className="p-8 text-zinc-500">
        No se pudo cargar la configuración del taller.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configuración</h1>
        <p className="mt-1 text-zinc-500">Administra tu taller y vincula Telegram</p>
      </div>
      <ConfigForm taller={taller} />
    </div>
  );
}
