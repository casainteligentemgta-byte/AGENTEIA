export default function DashboardLoading() {
  return (
    <div className="animate-pulse p-4 sm:p-8">
      <div className="mb-8 h-9 w-48 rounded-lg bg-zinc-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-zinc-800/80" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="h-72 rounded-2xl bg-zinc-800/60 lg:col-span-3" />
        <div className="grid gap-6 lg:col-span-2">
          <div className="h-40 rounded-2xl bg-zinc-800/60" />
          <div className="h-40 rounded-2xl bg-zinc-800/60" />
        </div>
      </div>
    </div>
  );
}
