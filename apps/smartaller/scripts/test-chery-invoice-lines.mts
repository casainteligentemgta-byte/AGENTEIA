import { parseCheryInvoiceLineas } from "../lib/importacion/chery-invoice-lines";
import { salvageCheryVin } from "../lib/importacion/vin-text";

const SAMPLE = `
TIGGO 2 PRO MAX LVVDB21B9VE033523 NASDAQ SILVER
TIGGO 2 PRO MAX LVVDB21B1VE033189 CELADON GRAY
TIGGO 2 PRO MAX LVD82189VE033215 CELADON GRAY
TIGGO 2 PRO MAX LVVDB21BXVE033580 KHAKI WHITE
TIGGO 2 PRO MAX LWVDB2187VE033214 CELADON GRAY
TIGGO 2 PRO MAX LWDB2188VE033514 NASDAQ SILVER
TIGGO 2 PRO MAX LWVDB21B5VE033213 CELADON GRAY
TIGGO 2 PRO MAX LWD821B5VE033180 CELADON GRAY
`;

const cases: [string, string][] = [
  ["LVVDB21B9VE033523", "LVVDB21B9VE033523"],
  ["LWVDB2187VE033214", "LVVDB2187VE033214"],
  ["LVD82189VE033215", "LVVDB2189VE033215"],
  ["LWDB2188VE033514", "LVVDB2188VE033514"],
  ["LWD821B5VE033180", "LVVDB21B5VE033180"],
  ["LVD82189VE033215C", "LVVDB2189VE033215"],
];

let failed = 0;
for (const [raw, expected] of cases) {
  const got = salvageCheryVin(raw);
  if (got !== expected) {
    console.error(`salvage ${raw} => ${got} (esperado ${expected})`);
    failed += 1;
  }
}

const rows = parseCheryInvoiceLineas(SAMPLE);
if (rows.length !== 8) {
  console.error(`lineas: ${rows.length} (esperado 8)`, rows);
  failed += 1;
}
for (const row of rows) {
  if (row.modelo !== "Tiggo 2 Pro Max") {
    console.error(`modelo ${row.vin}: ${row.modelo}`);
    failed += 1;
  }
  if (!row.color) {
    console.error(`sin color ${row.vin}`);
    failed += 1;
  }
}

const collapsed = parseCheryInvoiceLineas(SAMPLE.replace(/\n/g, " "));
if (collapsed.length !== 8) {
  console.error(`colapsado: ${collapsed.length}`, collapsed);
  failed += 1;
}

if (failed) {
  process.exit(1);
}
console.log(
  "ok",
  rows.map((r) => `${r.vin} | ${r.modelo} | ${r.color}`).join("\n")
);
