import Link from "next/link";
import { notFound } from "next/navigation";
import { getNfcStickerPublic } from "@/app/actions/nfc/verify-nfc";
import { PublicStickerView } from "@/components/nfc/PublicStickerView";

export const dynamic = "force-dynamic";

type Props = {
  params: { token: string };
};

export default async function PublicNfcStickerPage({ params }: Props) {
  const result = await getNfcStickerPublic(params.token);

  if (!result.success) {
    if (result.error === "Sticker no encontrado" || result.error === "Token inválido") {
      notFound();
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.15),_transparent_55%),#070b12] px-4">
        <div className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-center">
          <p className="text-lg font-medium text-zinc-100">Sticker no disponible</p>
          <p className="mt-2 text-sm text-zinc-400">{result.error}</p>
          <Link href="/" className="mt-6 inline-block text-sm text-cyan-400 hover:text-cyan-300">
            Ir a SmartTaller
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b12] px-4 py-12 sm:px-6 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(8,145,178,0.22),transparent),linear-gradient(180deg,transparent_0%,#0a1628_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="relative">
        <PublicStickerView token={params.token} initial={result.sticker} />
      </div>
    </main>
  );
}
