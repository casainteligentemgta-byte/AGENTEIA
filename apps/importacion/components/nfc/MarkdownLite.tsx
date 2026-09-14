import type { ReactNode } from "react";
import {
  parseMarkdownLite,
  type MarkdownBlock,
} from "@/lib/importacion/markdown-lite";

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
          : block.level === 2
            ? "text-lg font-semibold text-zinc-100 print:text-zinc-800"
            : "mt-5 text-base font-semibold text-zinc-200 print:text-zinc-700";
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

type Section = { title: string | null; blocks: MarkdownBlock[] };

function groupSections(blocks: MarkdownBlock[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { title: null, blocks: [] };
  for (const block of blocks) {
    if (block.type === "h" && block.level === 2) {
      if (current.title !== null || current.blocks.length) sections.push(current);
      current = { title: block.text, blocks: [] };
      continue;
    }
    current.blocks.push(block);
  }
  if (current.title !== null || current.blocks.length) sections.push(current);
  return sections;
}

export function MarkdownLite({ source }: { source: string }) {
  const sections = groupSections(parseMarkdownLite(source));
  return (
    <article className="space-y-3 print:space-y-6">
      <style>{`@media print{details:not([open])>:not(summary){display:block!important}}`}</style>
      {sections.map((section, i) => {
        if (!section.title) {
          return (
            <div key={`intro-${i}`}>
              {section.blocks.map((block, bi) => (
                <BlockView key={bi} block={block} />
              ))}
            </div>
          );
        }
        return (
          <details
            key={section.title}
            open={i <= 1}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 print:border-0 print:bg-transparent print:p-0 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="cursor-pointer list-none text-lg font-semibold text-zinc-100 print:cursor-default print:text-zinc-800">
              {inline(section.title)}
            </summary>
            <div className="mt-3 print:mt-2">
              {section.blocks.map((block, bi) => (
                <BlockView key={bi} block={block} />
              ))}
            </div>
          </details>
        );
      })}
    </article>
  );
}
