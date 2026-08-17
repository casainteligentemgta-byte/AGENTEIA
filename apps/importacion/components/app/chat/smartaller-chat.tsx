"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import { useMemo, useRef, useEffect, useState } from "react";
import { getMessageText } from "@/lib/ai/chat-messages";
import { SUGERENCIAS_CHAT } from "@/lib/ai/smartaller-constants";

type SmartallerChatProps = {
  vehiculoId: string;
  tituloVehiculo: string;
  placa: string;
};

export function SmartallerChat({
  vehiculoId,
  tituloVehiculo,
  placa,
}: SmartallerChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { vehiculoId },
      }),
    [vehiculoId]
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  function enviar(texto: string) {
    const trimmed = texto.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] flex-col">
      <div className="border-b border-zinc-200/80 bg-white/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">Chat Smartaller</p>
            <p className="truncate text-xs text-zinc-500">
              {tituloVehiculo} · {placa}
            </p>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        )}

        {messages.length === 0 && !error && (
          <div className="space-y-4 py-6">
            <div className="mx-auto max-w-xs text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                <Sparkles className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-zinc-900">Hola, soy Smartaller</p>
              <p className="mt-1 text-sm text-zinc-500">
                Conozco tu {tituloVehiculo}. Pregúntame sobre mantenimiento, historial o
                recordatorios.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGERENCIAS_CHAT.map((sugerencia) => (
                <button
                  key={sugerencia}
                  type="button"
                  onClick={() => enviar(sugerencia)}
                  disabled={isLoading}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                >
                  {sugerencia}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const text = getMessageText(message);
          const isUser = message.role === "user";
          const isStreamingAssistant =
            !isUser && message.role === "assistant" && text === "" && isLoading;

          return (
            <div
              key={message.id}
              className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isUser
                    ? "bg-blue-600 text-white"
                    : "border border-zinc-200 bg-white text-blue-600"
                }`}
              >
                {isUser ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </div>
              <div
                className={`flex max-w-[82%] flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? "rounded-br-md bg-blue-600 text-white"
                      : "rounded-bl-md border border-zinc-200/80 bg-white text-zinc-800"
                  }`}
                >
                  {isStreamingAssistant ? (
                    <span className="inline-flex items-center gap-2 text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Pensando…
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap">{text}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-blue-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-bl-md border border-zinc-200/80 bg-white px-4 py-2.5 shadow-sm">
              <span className="inline-flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Escribiendo…
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(input);
        }}
        className="shrink-0 border-t border-zinc-200/80 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md"
      >
        <div className="flex gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(input);
              }
            }}
            placeholder="Pregunta sobre tu vehículo…"
            rows={1}
            className="min-h-[48px] max-h-32 flex-1 resize-none bg-transparent px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="self-end rounded-xl p-2.5 text-blue-600 transition hover:bg-blue-50 disabled:opacity-40"
            aria-label="Enviar mensaje"
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
