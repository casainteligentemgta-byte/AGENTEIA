export default function OjoDeDiosLoading() {
  return (
    <div className="min-h-dvh bg-[#05080d] text-white">
      <div className="flex min-h-dvh">
        <div className="hidden w-20 border-r border-white/10 bg-black/40 md:block" />
        <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
          <div className="mb-8 h-10 w-56 animate-pulse rounded-xl bg-white/10" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className={`h-52 animate-pulse rounded-3xl border border-cyan-400/15 bg-white/[0.07] ${
                  index === 1 ? "xl:col-span-8" : "xl:col-span-4"
                }`}
              />
            ))}
          </div>
          <p className="mt-6 text-sm text-white/50">Cargando Ojo de Dios…</p>
        </div>
      </div>
    </div>
  );
}
