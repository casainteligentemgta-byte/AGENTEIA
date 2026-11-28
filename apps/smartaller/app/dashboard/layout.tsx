import { Sidebar } from "@/components/dashboard/sidebar";
import { TelegramBanner } from "@/components/dashboard/telegram-banner";
import { TallerPaywallScreen } from "@/components/dashboard/taller-paywall-screen";
import { SuscripcionBanner } from "@/components/app/suscripcion-banner";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { getBrand } from "@/lib/brand";
import { getAccesoTaller } from "@/lib/billing/acceso";
import { getNotificacionesUsuario } from "@/lib/data/notificaciones";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let userEmail: string | null = null;
  let tallerNombre: string | null = null;
  let telegramLinked = false;
  let tallerId: string | null = null;

  try {
    const user = await getUser();
    userEmail = user?.email ?? null;
    if (user) {
      const { taller } = await ensureTallerForUser(user.id);
      tallerNombre = taller?.nombre ?? null;
      telegramLinked = taller?.telegram_chat_id != null;
      tallerId = taller?.id ?? null;
    }
  } catch {
    /* sin config Supabase */
  }

  const acceso = await getAccesoTaller(tallerId);
  if (tallerId && acceso.schemaReady && !acceso.permitido) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <TallerPaywallScreen />
      </div>
    );
  }

  const notificaciones = await getNotificacionesUsuario(4);

  const jac = getBrand().id === "jac";

  return (
    <div className={jac ? "min-h-screen bg-[#f3f4f8]" : "min-h-screen bg-zinc-950"}>
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
        <Sidebar userEmail={userEmail} tallerNombre={tallerNombre} />
        <main className="min-w-0 flex-1">
          <header
            className={
              jac
                ? "sticky top-0 z-30 hidden h-14 items-center border-b border-[#eceef3] bg-white/90 px-4 backdrop-blur md:flex"
                : "sticky top-0 z-30 hidden h-14 items-center border-b border-zinc-800 bg-zinc-950/95 px-4 backdrop-blur md:flex"
            }
          >
            <p
              className={
                jac
                  ? "truncate text-sm font-semibold text-[#1c1c22] md:ml-0"
                  : "ml-14 truncate text-sm font-semibold text-zinc-100"
              }
            >
              {tallerNombre ?? getBrand().copy.fallbackTallerNombre}
            </p>
          </header>
          {!jac && !telegramLinked && (
            <div className="px-4 pt-4 sm:px-8 sm:pt-6">
              <TelegramBanner linked={telegramLinked} />
            </div>
          )}
          <SuscripcionBanner
            vencimiento={acceso.vencimiento}
            diasRestantes={acceso.diasRestantes}
            notificaciones={notificaciones}
            hrefPago="/dashboard"
            className="px-4 pt-4 sm:px-8 sm:pt-4"
          />
          {children}
        </main>
      </div>
    </div>
  );
}
