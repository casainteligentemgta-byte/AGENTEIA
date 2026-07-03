"use client";

import { useState } from "react";
import { AgentStatus } from "@/components/agent-status";
import { MissionControl } from "@/components/mission-control";
import { ChatUI } from "@/components/chat-ui";
import { ErrorBoundary } from "@/components/error-boundary";
import { AuthNav } from "@/components/auth-nav";
import { MessageSquare, LayoutDashboard } from "lucide-react";

type MobileTab = "chat" | "panel";

export default function AgentePage() {
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-black text-white md:flex-row">
      <nav
        className="flex shrink-0 border-b border-zinc-800 bg-zinc-950 md:hidden"
        aria-label="Vista principal"
      >
        <button
          type="button"
          onClick={() => setMobileTab("chat")}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition ${
            mobileTab === "chat"
              ? "border-b-2 border-blue-500 text-blue-400"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("panel")}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition ${
            mobileTab === "panel"
              ? "border-b-2 border-blue-500 text-blue-400"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Panel
        </button>
      </nav>

      <div
        className={`flex min-h-0 flex-1 flex-col border-zinc-800 p-4 md:flex md:border-r md:p-6 ${
          mobileTab === "chat" ? "flex" : "hidden md:flex"
        }`}
      >
        <header className="mb-4 flex shrink-0 items-start justify-between gap-3 md:mb-6">
          <h1 className="text-lg font-bold leading-tight tracking-tighter text-zinc-100 sm:text-2xl">
            SISTEMA OPERATIVO DE IA{" "}
            <span className="text-sm text-blue-500 sm:text-base">v1.0</span>
          </h1>
          <AuthNav />
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
          <ChatUI
            api="/api/chat"
            placeholder="Escribe una orden al agente..."
            emptyMessage="Esperando conexión con el núcleo. Envía un mensaje para empezar."
          />
        </div>
      </div>

      <aside
        className={`min-h-0 flex-1 overflow-y-auto bg-zinc-950 p-4 md:block md:w-96 md:flex-none md:p-6 ${
          mobileTab === "panel" ? "block" : "hidden"
        }`}
      >
        <div className="space-y-4 md:space-y-6">
          <ErrorBoundary>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-2xl">
              <AgentStatus />
            </section>
          </ErrorBoundary>
          <ErrorBoundary>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-4">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
                Misiones Activas
              </h2>
              <MissionControl />
            </section>
          </ErrorBoundary>
        </div>
      </aside>
    </div>
  );
}
