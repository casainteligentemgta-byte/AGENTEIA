import Link from "next/link";
import { Suspense } from "react";
import { ClienteBuscarForm } from "@/components/cliente/buscar-form";

function BuscarFormFallback() {
  return (
    <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
  );
}

export default function ClientePage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 sm:px-6">
      <nav className="mb-6">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Inicio
        </Link>
      </nav>

      <header className="mb-8">
        <p className="text-sm font-medium text-brand-600">Portal del cliente</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Historial de tu vehículo</h1>
        <p className="mt-2 text-slate-600">
          Consulta los servicios realizados y la fecha de tu próximo mantenimiento.
        </p>
      </header>

      <Suspense fallback={<BuscarFormFallback />}>
        <ClienteBuscarForm />
      </Suspense>
    </main>
  );
}
