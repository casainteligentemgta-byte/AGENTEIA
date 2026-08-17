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
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <p className="text-lg font-medium">Sticker no disponible</p>
          <p className="mt-2 text-sm text-slate-400">{result.error}</p>
          <Link href="/smartimport" className="mt-6 inline-block text-sm text-cyan-400 hover:text-cyan-300">
            Ir a Puerto Libre
          </Link>
        </div>
      </main>
    );
  }

  return <PublicStickerView token={params.token} />;
}
