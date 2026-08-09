import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
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
