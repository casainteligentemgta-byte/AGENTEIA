import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

function isImportacionLogin(pathname: string): boolean {
  return pathname === `${IMPORTACION_BASE}/login` || pathname === "/login";
}

function isProtectedPath(pathname: string): boolean {
  if (isImportacionLogin(pathname)) return false;
  return pathname === IMPORTACION_BASE || pathname.startsWith(`${IMPORTACION_BASE}/`);
}

function isAllowedRedirect(redirectTo: string): boolean {
  return (
    redirectTo === IMPORTACION_BASE ||
    redirectTo.startsWith(`${IMPORTACION_BASE}/`)
  );
}

export async function updateSession(request: NextRequest) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  const loginPath = `${IMPORTACION_BASE}/login`;

  if (!url || !key) {
    if (isProtectedPath(request.nextUrl.pathname) || isImportacionLogin(request.nextUrl.pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = loginPath;
      loginUrl.searchParams.set("error", "config");
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = loginPath;
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isImportacionLogin(pathname)) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const target = request.nextUrl.clone();
    target.pathname =
      redirectTo && isAllowedRedirect(redirectTo) ? redirectTo : IMPORTACION_BASE;
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}
