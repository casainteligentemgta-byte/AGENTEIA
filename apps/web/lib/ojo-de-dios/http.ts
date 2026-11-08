import { NextResponse } from "next/server";

export const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export function jsonPrivate(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_CACHE_HEADERS });
}

export function textPrivate(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      ...PRIVATE_CACHE_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export function accessErrorResponse(status: 401 | 404): NextResponse {
  if (status === 404) {
    return jsonPrivate({ error: "Ojo de Dios no está disponible." }, 404);
  }
  return jsonPrivate({ error: "Inicia sesión para ver Ojo de Dios." }, 401);
}
