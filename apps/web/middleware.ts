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

  // Aquí puedes añadir lógica de auth: si no hay sesión, redirect a /login
  // const res = NextResponse.next();
  // return updateSession(request, res); // si usas Supabase updateSession
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
