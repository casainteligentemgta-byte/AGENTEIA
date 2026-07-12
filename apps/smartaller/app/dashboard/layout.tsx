import { Sidebar } from "@/components/dashboard/sidebar";
import { TelegramBanner } from "@/components/dashboard/telegram-banner";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let userEmail: string | null = null;
  let tallerNombre: string | null = null;
  let telegramLinked = false;

  try {
    const user = await getUser();
    userEmail = user?.email ?? null;
    if (user) {
      const { taller } = await ensureTallerForUser(user.id);
      tallerNombre = taller?.nombre ?? null;
      telegramLinked = taller?.telegram_chat_id != null;
    }
  } catch {
    /* sin config Supabase */
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
        <Sidebar userEmail={userEmail} tallerNombre={tallerNombre} />
        <main className="min-w-0 flex-1 md:pt-14">
          {!telegramLinked && (
            <div className="px-4 pt-4 sm:px-8 sm:pt-6">
              <TelegramBanner linked={telegramLinked} />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
