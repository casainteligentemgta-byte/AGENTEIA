import type { TopRankingItem } from "@/lib/data/dashboard";
import { formatCurrency } from "@/lib/utils";

type TopRankingProps = {
  title: string;
  items: TopRankingItem[];
  emptyMessage: string;
};

export function TopRanking({ title, items, emptyMessage }: TopRankingProps) {
  const maxTotal = items[0]?.total ?? 0;

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="font-semibold text-zinc-100">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {items.map((item, index) => {
            const width = maxTotal > 0 ? Math.max((item.total / maxTotal) * 100, 8) : 0;

            return (
              <li key={`${item.label}-${index}`}>
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-200">{item.label}</p>
                    {item.sublabel && (
                      <p className="truncate text-xs text-zinc-500">{item.sublabel}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-zinc-200">{formatCurrency(item.total)}</p>
                    <p className="text-xs text-zinc-500">
                      {item.count} servicio{item.count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
