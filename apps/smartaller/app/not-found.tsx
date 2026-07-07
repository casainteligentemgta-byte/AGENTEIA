import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">Página no encontrada</h1>
      <p className="mt-2 text-sm text-zinc-500">La ruta que buscas no existe o fue movida.</p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
