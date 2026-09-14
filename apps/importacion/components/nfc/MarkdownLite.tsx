import type { ReactNode } from "react";
import type { MarkdownBlock, MarkdownSection } from "@/lib/importacion/markdown-lite";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[0.85em] text-cyan-200 print:bg-zinc-100 print:text-zinc-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function BlockView({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case "h": {
      const cls =
        block.level === 1
          ? "text-2xl font-semibold tracking-tight text-zinc-50 print:text-zinc-900"
          : block.level === 3
            ? "mt-5 text-base font-semibold text-zinc-200 print:text-zinc-700"
            : "text-lg font-semibold text-zinc-100 print:text-zinc-800";
      const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
      return <Tag className={cls}>{inline(block.text)}</Tag>;
    }
    case "p":
      return (
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 print:text-zinc-600">
          {inline(block.text)}
        </p>
      );
    case "hr":
      return null;
    case "ul":
      return (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-400 print:text-zinc-600">
          {block.items.map((item) => (
            <li key={item}>{inline(item)}</li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="mt-3 border-l-2 border-cyan-700/70 pl-3 text-sm italic text-zinc-400 print:border-zinc-400 print:text-zinc-600">
          {inline(block.text)}
        </blockquote>
      );
    case "table":
      return (
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800 print:border-zinc-300">
          <table className="w-full min-w-[32rem] border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-zinc-900/80 text-zinc-200 print:bg-zinc-100 print:text-zinc-800">
              <tr>
                {block.headers.map((h, hi) => (
                  <th
                    key={`${hi}-${h.slice(0, 24)}`}
                    className="whitespace-nowrap border-b border-zinc-800 px-2.5 py-2 font-medium print:border-zinc-300"
                  >
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="align-top">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border-t border-zinc-800/80 px-2.5 py-2 text-zinc-300 print:border-zinc-200 print:text-zinc-700"
                    >
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

export function MarkdownSectionView({
  sections,
  hrefFor,
  activeSlug,
}: {
  sections: MarkdownSection[];
  hrefFor: (slug: string) => string;
  activeSlug: string;
}) {
  const intro = sections.find((s) => s.slug === "intro");
  const titled = sections.filter((s) => s.slug !== "intro");
  const active =
    titled.find((s) => s.slug === activeSlug) ?? titled[0] ?? intro ?? sections[0];

  return (
    <article className="space-y-4">
      {intro ? (
        <div>
          {intro.blocks.map((block, bi) => (
            <BlockView key={bi} block={block} />
          ))}
        </div>
      ) : null}

      <nav
        aria-label="Secciones del cuestionario"
        className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 print:hidden"
      >
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Secciones
        </p>
        <ol className="grid gap-1 sm:grid-cols-2">
          {titled.map((section) => {
            const isActive = section.slug === active?.slug;
            return (
              <li key={section.slug}>
                <a
                  href={hrefFor(section.slug)}
                  className={
                    isActive
                      ? "block rounded-lg bg-cyan-600 px-2.5 py-1.5 text-sm font-semibold text-white"
                      : "block rounded-lg px-2.5 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
                  }
                >
                  {section.title}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {active ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 print:border-0 print:bg-transparent print:p-0">
          {active.title ? (
            <h2 className="text-lg font-semibold text-zinc-100 print:text-zinc-800">
              {inline(active.title)}
            </h2>
          ) : null}
          {active.blocks.map((block, bi) => (
            <BlockView key={bi} block={block} />
          ))}
        </section>
      ) : null}
    </article>
  );
}
