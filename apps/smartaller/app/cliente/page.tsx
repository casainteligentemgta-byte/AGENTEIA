import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Car } from "lucide-react";
import { ClienteBuscarForm } from "@/components/cliente/buscar-form";

function BuscarFormFallback() {
  return <div className="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50" />;
}

export default function ClientePage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Inicio
          </Link>
        </nav>

        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
              <Car className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-blue-400">Portal del cliente</p>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                Historial de tu vehículo
              </h1>
            </div>
          </div>
          <p className="mt-3 text-zinc-400">
            Consulta los servicios realizados y la fecha de tu próximo mantenimiento.
          </p>
        </header>

        <Suspense fallback={<BuscarFormFallback />}>
          <ClienteBuscarForm />
        </Suspense>
      </div>
    </main>
  );
}
