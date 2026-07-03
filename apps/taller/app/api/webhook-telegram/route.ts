import { GET as telegramGet, POST as telegramPost } from "../telegram-webhook/route";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Alias de compatibilidad → /api/telegram-webhook */
export const GET = telegramGet;
export const POST = telegramPost;
