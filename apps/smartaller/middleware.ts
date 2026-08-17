import { NextResponse, type NextRequest } from "next/server";
import {
  canonicalizeImportacionPath,
  isImportacionAppPath,
} from "@/lib/importacion/paths";
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
    (isImportacionAppPath(pathname) ||
      pathname === "/importacion" ||
      pathname.startsWith("/importacion/"))
  ) {
    const destPath = canonicalizeImportacionPath(pathname);
    const dest = `${importacionOrigin}${destPath}${request.nextUrl.search}`;
    return NextResponse.redirect(dest);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/app/:path*",
    "/smartimport",
    "/smartimport/:path*",
    "/importacion",
    "/importacion/:path*",
    "/portales",
    "/portales/:path*",
    "/login",
    "/auth/:path*",
  ],
};
