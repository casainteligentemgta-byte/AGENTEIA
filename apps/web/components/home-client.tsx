"use client";

import { AgentStatus } from "@/components/agent-status";
import { MissionBoard } from "@/components/mission-board";
import { ChatUI } from "@/components/chat-ui";

export function HomeClient() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-neutral-950 text-neutral-100">
      <aside className="flex w-full flex-col gap-4 border-b border-neutral-800 bg-neutral-900/50 p-4 md:w-72 md:border-b-0 md:border-r md:overflow-y-auto shrink-0">
        <AgentStatus refreshIntervalMs={10_000} />
        <MissionBoard />
      </aside>
      <main className="flex flex-1 flex-col min-h-0">
        <header className="shrink-0 border-b border-neutral-800 px-4 py-3">
          <h1 className="text-lg font-medium text-neutral-200">
            {process.env.NEXT_PUBLIC_AGENT_NAME || "Agente IA"}
          </h1>
        </header>
        <div className="flex-1 min-h-0 flex flex-col">
          <ChatUI
            api="/api/chat"
            placeholder={`Escribe a ${process.env.NEXT_PUBLIC_AGENT_NAME || "tu agente"}...`}
            emptyMessage="Escribe un mensaje para empezar. El agente recordará lo importante."
          />
        </div>
      </main>
    </div>
  );
}
