/**
 * Wrapper para redes con proxy/UniFi que rompen certificados SSL en Node.
 * Solo desarrollo local — NO usar en producción.
 */
import { spawn } from "child_process";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Uso: node scripts/with-local-tls.mjs <comando> [args...]");
  process.exit(1);
}

const child = spawn(cmd, args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
