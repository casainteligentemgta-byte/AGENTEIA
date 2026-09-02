import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canonicalizeImportacionPath,
  IMPORTACION_BASE,
  isImportacionAppPath,
} from "@/lib/importacion/paths";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

function isImportacionLogin(pathname: string): boolean {
  return pathname === `${IMPORTACION_BASE}/login` || pathname === "/login";
}

function isImportacionDemo(pathname: string): boolean {
  return pathname === `${IMPORTACION_BASE}/demo`;
}

function isProtectedPath(pathname: string): boolean {
  if (isImportacionLogin(pathname) || isImportacionDemo(pathname)) return false;
  return isImportacionAppPath(pathname);
}

function isAllowedRedirect(redirectTo: string): boolean {
  return isImportacionAppPath(redirectTo);
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
    loginUrl.searchParams.set("redirectTo", canonicalizeImportacionPath(pathname));
    return NextResponse.redirect(loginUrl);
  }

  if (user && isImportacionLogin(pathname)) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const target = request.nextUrl.clone();
    target.pathname =
      redirectTo && isAllowedRedirect(redirectTo)
        ? canonicalizeImportacionPath(redirectTo)
        : IMPORTACION_BASE;
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}
