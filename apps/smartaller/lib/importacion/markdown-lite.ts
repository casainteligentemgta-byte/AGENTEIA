export type MarkdownBlock =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "hr" }
  | { type: "ul"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "quote"; text: string };

const TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((cell) => cell.trim());
}

function heading(line: string): MarkdownBlock | null {
  if (line.startsWith("### ")) return { type: "h", level: 3, text: line.slice(4).trim() };
  if (line.startsWith("## ")) return { type: "h", level: 2, text: line.slice(3).trim() };
  if (line.startsWith("# ")) return { type: "h", level: 1, text: line.slice(2).trim() };
  return null;
}

export function parseMarkdownLite(md: string): MarkdownBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === "---" || trimmed === "***") {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    const h = heading(trimmed);
    if (h) {
      blocks.push(h);
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
        parts.push((lines[i] ?? "").trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", text: parts.join(" ").trim() });
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && TABLE_SEP.test((lines[i + 1] ?? "").trim())) {
      const headers = splitTableRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
        const rowLine = (lines[i] ?? "").trim();
        if (TABLE_SEP.test(rowLine)) {
          i += 1;
          continue;
        }
        rows.push(splitTableRow(rowLine));
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const item = (lines[i] ?? "").trim();
        if (item.startsWith("- ") || item.startsWith("* ")) {
          items.push(item.slice(2).trim());
          i += 1;
          continue;
        }
        break;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const next = (lines[i] ?? "").trim();
      if (
        !next ||
        next === "---" ||
        next === "***" ||
        heading(next) ||
        next.startsWith("|") ||
        next.startsWith("- ") ||
        next.startsWith("* ") ||
        next.startsWith(">")
      ) {
        break;
      }
      para.push(next);
      i += 1;
    }
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
  }

  return blocks;
}

export type MarkdownSection = { slug: string; title: string | null; blocks: MarkdownBlock[] };

export function slugifyHeading(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

export function groupMarkdownSections(blocks: MarkdownBlock[]): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection = { slug: "intro", title: null, blocks: [] };
  for (const block of blocks) {
    if (block.type === "h" && block.level === 2) {
      if (current.title !== null || current.blocks.length) sections.push(current);
      current = {
        slug: slugifyHeading(block.text) || `seccion-${sections.length + 1}`,
        title: block.text,
        blocks: [],
      };
      continue;
    }
    current.blocks.push(block);
  }
  if (current.title !== null || current.blocks.length) sections.push(current);
  return sections;
}

