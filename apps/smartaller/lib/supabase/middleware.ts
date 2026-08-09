import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

function isImportacionLogin(pathname: string): boolean {
  return pathname === "/importacion/login";
}

function isProtectedPath(pathname: string): boolean {
  if (isImportacionLogin(pathname)) return false;
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/importacion") ||
    pathname.startsWith("/portales")
  );
}

function isAllowedRedirect(redirectTo: string): boolean {
  return (
    redirectTo.startsWith("/dashboard") ||
    redirectTo.startsWith("/app") ||
    redirectTo.startsWith("/importacion") ||
    redirectTo.startsWith("/portales")
  );
}

export async function updateSession(request: NextRequest) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    if (isProtectedPath(request.nextUrl.pathname) || isImportacionLogin(request.nextUrl.pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = isImportacionLogin(request.nextUrl.pathname)
        ? "/importacion/login"
        : "/login";
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
    const importacionFlow = pathname.startsWith("/importacion");
    loginUrl.pathname = importacionFlow ? "/importacion/login" : "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || isImportacionLogin(pathname))) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const target = request.nextUrl.clone();
    const allowedRedirect = redirectTo && isAllowedRedirect(redirectTo);
    if (isImportacionLogin(pathname)) {
      target.pathname = allowedRedirect ? redirectTo : "/importacion";
    } else {
      target.pathname = allowedRedirect ? redirectTo : "/portales";
    }
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}
