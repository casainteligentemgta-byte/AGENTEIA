import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NuevoStickerForm } from "@/components/nfc/NuevoStickerForm";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export const dynamic = "force-dynamic";

export default async function NuevoPuertoLibrePage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/puerto-libre/nuevo");

  const { taller, error } = await ensureTallerForUser(user.id);
  if (!taller) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error ?? "No se pudo cargar tu taller."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl">
        <Link
          href="/puerto-libre"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Nuevo sticker NFC
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Genera un token único, QR y archivo para grabar la URI en el tag NFC.
          </p>
          <p className="mt-1 text-xs text-zinc-600">{taller.nombre}</p>
        </header>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
          <NuevoStickerForm />
        </div>
      </div>
    </main>
  );
}
