import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HojaInspeccionTransportista } from "@/components/nfc/HojaInspeccionTransportista";

export const dynamic = "force-dynamic";

export default function PuertoLibreHojaInspeccionPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3 print:hidden">
          <Link
            href="/puerto-libre"
            className="inline-flex rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 uppercase">
            Planilla recepción en puerto
          </h1>
        </div>

        <HojaInspeccionTransportista />
      </div>
    </main>
  );
}
