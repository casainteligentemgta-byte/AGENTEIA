import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rutas que no pasan por comprobación de login (siempre accesibles). */
const publicRoutes = ["/", "/login", "/auth/callback", "/test"];

/** Rutas que exigen sesión cuando NEXT_PUBLIC_REQUIRE_AUTH=true. */
const protectedRoutes = ["/agente"];

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function requireAuth(): boolean {
  return process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
        );
      },
    },
  });

  // Refresca la sesión en cada request (recomendado por Supabase SSR)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (matchesRoute(pathname, publicRoutes)) {
    return response;
  }

  if (requireAuth() && matchesRoute(pathname, protectedRoutes) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
