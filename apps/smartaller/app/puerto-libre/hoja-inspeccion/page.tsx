import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HojaInspeccionTransportista } from "@/components/nfc/HojaInspeccionTransportista";

export const dynamic = "force-dynamic";

export default function PuertoLibreHojaInspeccionPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/puerto-libre"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 print:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Puerto Libre
        </Link>

        <div className="mb-6 print:hidden">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Planilla — recepción en transportista
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Para imprimir o PDF. Distinta de la hoja de inspección de ingreso al taller.
          </p>
        </div>

        <HojaInspeccionTransportista />
      </div>
    </main>
  );
}
