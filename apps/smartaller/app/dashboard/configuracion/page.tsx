import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { ConfigForm } from "@/components/dashboard/config-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const user = await getUser();

  if (!user) {
    return (
      <div className="p-8 text-zinc-500">
        Inicia sesión para ver la configuración de tu taller.
      </div>
    );
  }

  const { taller, error } = await ensureTallerForUser(user.id);

  if (!taller) {
    return (
      <div className="p-4 sm:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configuración</h1>
          <p className="mt-1 text-zinc-500">Administra tu taller y vincula Telegram</p>
        </div>
        <div className="glass rounded-2xl border border-red-900/50 p-6">
          <h2 className="font-semibold text-red-300">No se pudo crear tu taller</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {error ?? "Error desconocido. Revisa Supabase y las variables de entorno."}
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-zinc-500">
            <li>Ejecuta la migración multi-taller en Supabase → SQL Editor</li>
            <li>Verifica que exista la tabla <code className="text-zinc-300">talleres</code></li>
            <li>Confirma <code className="text-zinc-300">SUPABASE_SERVICE_ROLE_KEY</code> en Vercel</li>
          </ul>
        </div>
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
