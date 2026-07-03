"use client";

import { useChat } from "ai/react";
import { useRef, useEffect } from "react";
import { Send, Loader2, User, Bot } from "lucide-react";
import { getMessageText } from "@/lib/ai/chat-messages";

type ChatUIProps = {
  api?: string;
  placeholder?: string;
  className?: string;
  emptyMessage?: string;
};

export function ChatUI({
  api = "/api/chat",
  placeholder = "Escribe un mensaje...",
  className = "",
  emptyMessage = "Envía un mensaje para empezar.",
}: ChatUIProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({ api });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6 scroll-smooth"
      >
        {error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error.message}
          </div>
        )}
        {messages.length === 0 && !error && (
          <p className="py-12 text-center text-zinc-500 text-sm">{emptyMessage}</p>
        )}
        {messages.map((m) => {
          const text = getMessageText(m);
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isUser ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-300"
                }`}
              >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`flex max-w-[85%] flex-col gap-1 ${
                  isUser ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-zinc-800/90 text-zinc-100 border border-zinc-700/80 rounded-bl-md"
                  }`}
                >
                  {!isUser && text === "" && (
                    <span className="inline-flex items-center gap-2 text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Pensando...
                    </span>
                  )}
                  {text && <span className="whitespace-pre-wrap">{text}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-zinc-300">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-bl-md border border-zinc-700/80 bg-zinc-800/90 px-4 py-2.5">
              <span className="inline-flex items-center gap-2 text-zinc-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Escribiendo...
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:p-4">
        <div className="flex gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/50 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-500/30 transition-colors">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="min-h-[48px] max-h-32 flex-1 resize-none bg-transparent px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="self-end rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
            aria-label="Enviar"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
