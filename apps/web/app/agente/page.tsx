"use client";

import { AgentStatus } from "@/components/agent-status";
import { MissionControl } from "@/components/mission-control";
import { ChatUI } from "@/components/chat-ui";
import { ErrorBoundary } from "@/components/error-boundary";

export default function AgentePage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      {/* LADO IZQUIERDO: CHAT tipo ChatGPT */}
      <div className="flex-1 flex flex-col min-h-0 p-6 border-r border-zinc-800">
        <header className="mb-6 shrink-0">
          <h1 className="text-2xl font-bold tracking-tighter text-zinc-100">
            SISTEMA OPERATIVO DE IA <span className="text-blue-500 text-sm">v1.0</span>
          </h1>
        </header>

        <div className="flex-1 min-h-0 flex flex-col bg-zinc-900/30 rounded-xl border border-zinc-800 overflow-hidden">
          <ChatUI
            api="/api/chat"
            placeholder="Escribe una orden al agente..."
            emptyMessage="Esperando conexión con el núcleo. Envía un mensaje para empezar."
          />
        </div>
      </div>

      {/* LADO DERECHO: PANEL GAMING (con error boundary para que el chat siempre abra) */}
      <aside className="w-full md:w-96 bg-zinc-950 p-6 space-y-6 overflow-y-auto">
        <ErrorBoundary>
          <section className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 shadow-2xl">
            <AgentStatus />
          </section>
        </ErrorBoundary>
        <ErrorBoundary>
          <section className="p-4 bg-zinc-900/20 rounded-2xl border border-zinc-800">
            <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4 font-bold">Misiones Activas</h2>
            <MissionControl />
          </section>
        </ErrorBoundary>
      </aside>
    </div>
  );
}
