/**
 * Auditoría estática: Server Actions de Importación / Puerto Libre
 * deben autenticar taller antes de tocar datos (defense-in-depth junto a RLS).
 *
 * Uso: npm run audit:importacion-auth
 *      (también se invoca desde npm run qa)
 *
 * Criterio por función exportada:
 * - Debe llamar requireTallerAuth O (getUser + getMyTaller).
 * - Si escribe en vehiculos vía admin (.from("vehiculos") + insert|update|delete),
 *   debe comprobar pertenencia (assertVehiculoTaller o .eq("taller_id" / taller.id).
 * - Exentos: verify-nfc (público por diseño), extract solo OCR sin persistir vehículo.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, relative, resolve } from "path";
import { pathToFileURL } from "url";

const ACTIONS_DIR = resolve(process.cwd(), "app/actions/nfc");

/** Archivos públicos o sin mutación de expediente PL. */
const FILE_EXEMPT = new Set([
  "verify-nfc.ts", // token + PIN públicos
]);

/** Funciones que no mutan expediente (solo OCR / lectura). */
const FN_EXEMPT: Record<string, Set<string>> = {
  "importacion-extract.ts": new Set(["extractPuertoLibreDocumentoAction"]),
};

type Finding = {
  file: string;
  fn: string;
  issue: string;
};

function listActionFiles(): string[] {
  if (!existsSync(ACTIONS_DIR)) return [];
  return readdirSync(ACTIONS_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .map((f) => join(ACTIONS_DIR, f));
}

/** Extrae bloques `export async function name(...) { ... }` a profundidad de llaves. */
function extractExportedAsyncFunctions(
  source: string
): Array<{ name: string; body: string }> {
  const results: Array<{ name: string; body: string }> = [];
  const re = /export\s+async\s+function\s+(\w+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const name = match[1]!;
    const openParen = match.index + match[0].length - 1;
    let i = openParen;
    let depthParen = 0;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(") depthParen++;
      else if (ch === ")") {
        depthParen--;
        if (depthParen === 0) {
          i++;
          break;
        }
      }
    }
    while (i < source.length && /\s/.test(source[i]!)) i++;
    if (source[i] !== "{") continue;
    const bodyStart = i;
    let depth = 0;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          results.push({ name, body: source.slice(bodyStart, i + 1) });
          break;
        }
      }
    }
  }
  return results;
}

function hasTallerAuthGate(body: string): boolean {
  if (body.includes("requireTallerAuth")) return true;
  const hasUser = /\bgetUser\s*\(/.test(body);
  const hasTaller = /\bgetMyTaller\s*\(/.test(body);
  return hasUser && hasTaller;
}

function mutatesVehiculosWithAdmin(body: string): boolean {
  const usesAdmin =
    body.includes("createAdminClient") || body.includes("admin.from");
  if (!usesAdmin) return false;
  const touchesVehiculos = /\.from\(\s*["']vehiculos["']\s*\)/.test(body);
  if (!touchesVehiculos) return false;
  return (
    /\.insert\s*\(/.test(body) ||
    /\.update\s*\(/.test(body) ||
    /\.delete\s*\(/.test(body) ||
    /\.upsert\s*\(/.test(body)
  );
}

function hasVehiculoOwnershipCheck(body: string): boolean {
  if (body.includes("assertVehiculoTaller")) return true;
  if (/taller_id\s*!==\s*taller\.id/.test(body)) return true;
  if (/taller\.id\s*!==\s*.*taller_id/.test(body)) return true;
  if (/\.eq\(\s*["']taller_id["']/.test(body)) return true;
  if (/row\.taller_id\s*!==\s*taller\.id/.test(body)) return true;
  if (/vehiculo\.taller_id\s*!==\s*taller\.id/.test(body)) return true;
  if (/taller_id:\s*auth\.taller\.id/.test(body)) return true;
  if (/taller_id:\s*taller\.id/.test(body)) return true;
  if (/taller_id:\s*tallerId/.test(body)) return true;
  return false;
}

function auditFile(filePath: string): Finding[] {
  const base = relative(ACTIONS_DIR, filePath) || filePath.split("/").pop()!;
  if (FILE_EXEMPT.has(base)) return [];

  const source = readFileSync(filePath, "utf8");
  const fns = extractExportedAsyncFunctions(source);
  const findings: Finding[] = [];
  const exemptFns = FN_EXEMPT[base] ?? new Set();

  for (const { name, body } of fns) {
    if (exemptFns.has(name)) continue;

    if (!hasTallerAuthGate(body)) {
      findings.push({
        file: base,
        fn: name,
        issue:
          "Falta gate de auth de taller (requireTallerAuth o getUser+getMyTaller)",
      });
      continue;
    }

    if (mutatesVehiculosWithAdmin(body) && !hasVehiculoOwnershipCheck(body)) {
      findings.push({
        file: base,
        fn: name,
        issue:
          "Mutación admin de vehiculos sin assertVehiculoTaller / filtro taller_id",
      });
    }
  }

  return findings;
}

export function runImportacionAuthAudit(): {
  ok: boolean;
  findings: Finding[];
  scanned: number;
} {
  const files = listActionFiles();
  const findings = files.flatMap(auditFile);
  return { ok: findings.length === 0, findings, scanned: files.length };
}

function main() {
  console.log("\n=== Audit auth Importación / NFC ===\n");
  const { ok, findings, scanned } = runImportacionAuthAudit();
  console.log(`Archivos escaneados: ${scanned}`);
  if (ok) {
    console.log("✓ Todas las Server Actions auditadas tienen gate de taller.\n");
    process.exit(0);
  }
  for (const f of findings) {
    console.log(`✗ ${f.file} :: ${f.fn} — ${f.issue}`);
  }
  console.log(`\n${findings.length} problema(s). Corrige antes de merge.\n`);
  process.exit(1);
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  main();
}
