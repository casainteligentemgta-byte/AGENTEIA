import Link from "next/link";

export type FichaColaItem = {
  id: string;
  titulo: string;
  detalle: string;
};

export function FichaColaResumen({
  items,
  hrefFor,
  emptyText,
}: {
  items: FichaColaItem[];
  hrefFor: (id: string) => string;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-zinc-500">{emptyText}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={hrefFor(item.id)}
            className="block rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-1.5 hover:border-cyan-700/40"
          >
            <span className="text-sm text-zinc-100">{item.titulo}</span>
            <span className="mt-0.5 block font-mono text-[11px] text-zinc-400">
              {item.detalle}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
