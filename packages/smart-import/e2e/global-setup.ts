import { startE2EServer } from "./server";
import type { FullConfig } from "@playwright/test";
import type { Server } from "http";

declare global {
  // eslint-disable-next-line no-var
  var __E2E_SERVER__: Server | undefined;
}

async function globalSetup(_config: FullConfig): Promise<void> {
  const server = await startE2EServer();
  globalThis.__E2E_SERVER__ = server;
}

export default globalSetup;
