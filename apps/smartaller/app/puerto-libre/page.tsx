import Link from "next/link";
import { redirect } from "next/navigation";
import { Nfc, Plus } from "lucide-react";
import { listNfcStickers } from "@/app/actions/nfc/nfc-management";
import { StickerList } from "@/components/nfc/StickerList";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { getAppBaseUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: { created?: string };
};

export default async function PuertoLibrePage({ searchParams }: Props) {
  const user = await getUser();
  if (!user) redirect("/login?next=/puerto-libre");

  const { taller, error: tallerError } = await ensureTallerForUser(user.id);
  if (!taller) {
    return (
      <PuertoLibreShell>
        <div className="rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {tallerError ?? "No se pudo cargar tu taller."}
        </div>
      </PuertoLibreShell>
    );
  }

  const list = await listNfcStickers();
  const baseUrl = getAppBaseUrl();

  return (
    <PuertoLibreShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-cyan-400">
            <Nfc className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide uppercase">Panel de control</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Puerto Libre NFC</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Gestiona stickers NFC/QR para vehículos. Cada token publica una ficha en{" "}
            <code className="text-cyan-300/90">/v/[token]</code>.
          </p>
          <p className="mt-1 text-xs text-zinc-600">{taller.nombre}</p>
        </div>
        <Link
          href="/puerto-libre/nuevo"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
        >
          <Plus className="h-4 w-4" />
          Nuevo sticker
        </Link>
      </div>

      {searchParams.created ? (
        <div className="mb-6 rounded-xl border border-emerald-900/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          Sticker creado. URL pública:{" "}
          <span className="font-mono text-emerald-100">
            {baseUrl}/v/{searchParams.created}
          </span>
        </div>
      ) : null}

      {!list.success ? (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {list.error}. Confirma que ejecutaste la migración{" "}
          <code className="text-red-100">20260728_module_nfc_puerto_libre.sql</code> con RLS.
        </div>
      ) : (
        <StickerList
          stickers={list.stickers}
          highlightToken={searchParams.created ?? null}
          baseUrl={baseUrl}
        />
      )}
    </PuertoLibreShell>
  );
}

function PuertoLibreShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-8 flex items-center justify-between text-sm">
          <Link href="/dashboard" className="text-zinc-500 transition hover:text-zinc-300">
            ← Dashboard
          </Link>
          <Link href="/" className="text-zinc-500 transition hover:text-zinc-300">
            SmartTaller
          </Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
