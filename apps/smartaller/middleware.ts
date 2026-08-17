import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function getImportacionAppOrigin(): string | null {
  const raw =
    process.env.IMPORTACION_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_IMPORTACION_APP_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const importacionOrigin = getImportacionAppOrigin();
  if (
    importacionOrigin &&
    (pathname === "/importacion" || pathname.startsWith("/importacion/"))
  ) {
    const dest = `${importacionOrigin}${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(dest);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/app/:path*",
    "/importacion",
    "/importacion/:path*",
    "/portales",
    "/portales/:path*",
    "/login",
    "/auth/:path*",
  ],
};
