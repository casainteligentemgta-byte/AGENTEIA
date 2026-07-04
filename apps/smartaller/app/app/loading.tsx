export default function AppLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a1628]">
      <div className="h-14 w-14 animate-pulse rounded-2xl bg-blue-600/30" />
      <p className="text-sm text-zinc-400">Cargando...</p>
    </div>
  );
}
