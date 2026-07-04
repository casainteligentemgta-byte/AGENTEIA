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
            {error?.includes("SERVICE_ROLE") || error?.includes("ByteString") ? (
              <>
                <li>
                  Vercel → Settings → Environment Variables →{" "}
                  <code className="text-zinc-300">SUPABASE_SERVICE_ROLE_KEY</code>
                </li>
                <li>Supabase → Settings → API → copia <strong>service_role</strong> (secret)</li>
                <li>Debe empezar por <code className="text-zinc-300">eyJ</code>, sin viñetas • ni espacios</li>
                <li>Guarda y haz Redeploy en Vercel</li>
              </>
            ) : error?.includes("telegram_chat_id") ? (
              <>
                <li>
                  En Supabase → SQL Editor, ejecuta:
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-300">
                    alter table public.talleres{"\n"}
                    {"  "}alter column telegram_chat_id drop not null;
                  </pre>
                </li>
                <li>Recarga esta página — deberías ver tu código de vinculación</li>
                <li>Luego envía <code className="text-zinc-300">/vincular TU_CODIGO</code> al bot de Telegram</li>
              </>
            ) : (
              <>
                <li>Ejecuta la migración multi-taller en Supabase → SQL Editor</li>
                <li>Verifica que exista la tabla <code className="text-zinc-300">talleres</code></li>
                <li>Confirma <code className="text-zinc-300">SUPABASE_SERVICE_ROLE_KEY</code> en Vercel</li>
              </>
            )}
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
