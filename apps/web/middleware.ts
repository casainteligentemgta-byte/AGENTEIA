import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas accesibles sin redirigir a login
const publicRoutes = ["/", "/login", "/agente"];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export function middleware(request: NextRequest) {
  // Las rutas públicas pasan siempre
  if (isPublicRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Refresco de sesión Supabase (recomendado cuando uses auth):
  // const res = NextResponse.next();
  // const supabase = createServerClient(...); await supabase.auth.getUser();
  // return res;
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api (API routes)
     */
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
