export default function OjoDeDiosLoading() {
  return (
    <div className="min-h-dvh bg-black px-4 py-10 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-zinc-800" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40"
            />
          ))}
        </div>
        <p className="mt-6 text-sm text-zinc-500">Cargando Ojo de Dios…</p>
      </div>
    </div>
  );
}
