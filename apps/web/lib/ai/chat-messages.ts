/** Extrae texto de un mensaje UIMessage (content legacy o parts). */
export function getMessageText(m: {
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (typeof m.content === "string" && m.content.trim()) return m.content.trim();
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(" ")
      .trim();
  }
  return "";
}

/** Texto del último mensaje del usuario en el historial del chat. */
export function getLastUserMessageText(
  messages: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>
): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "";
  return getMessageText(lastUser);
}
