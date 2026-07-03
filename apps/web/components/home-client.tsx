"use client";

import Link from "next/link";
import { AgentStatus } from "@/components/agent-status";
import { MissionBoard } from "@/components/mission-board";
import { ChatUI } from "@/components/chat-ui";
import { AuthNav } from "@/components/auth-nav";
import { Gamepad2 } from "lucide-react";

export function HomeClient() {
  const agentName = process.env.NEXT_PUBLIC_AGENT_NAME || "Agente IA";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-neutral-950 text-neutral-100 md:flex-row">
      <aside className="flex max-h-[38vh] shrink-0 flex-col gap-3 overflow-y-auto border-b border-neutral-800 bg-neutral-900/50 p-3 md:max-h-none md:w-72 md:gap-4 md:border-b-0 md:border-r md:p-4">
        <AgentStatus refreshIntervalMs={10_000} />
        <MissionBoard />
      </aside>
      <main className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-800 px-3 py-2.5 sm:px-4 sm:py-3">
          <h1 className="truncate text-base font-medium text-neutral-200 sm:text-lg">{agentName}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/agente"
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100"
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Vista gaming</span>
            </Link>
            <AuthNav />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatUI
            api="/api/chat"
            placeholder={`Escribe a ${agentName}...`}
            emptyMessage="Escribe un mensaje para empezar. El agente recordará lo importante."
          />
        </div>
      </main>
    </div>
  );
}
