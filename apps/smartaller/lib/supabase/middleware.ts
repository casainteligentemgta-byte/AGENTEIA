import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canonicalizeImportacionPath,
  IMPORTACION_BASE,
  isImportacionAppPath,
  isImportacionPublicAppPath,
} from "@/lib/importacion/paths";
import {
  isDemoExpired,
  readDemoMetaFromAuthUser,
} from "@/lib/portal/demo-access";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import {
  PASSWORD_RECOVERY_COOKIE,
  hasPasswordRecoveryCookie,
  isAllowedAuthRedirect,
  isPasswordRecoveryPath,
  passwordRecoveryCookieOptions,
  recoveryRedirectPath,
} from "@/lib/auth/password-recovery";

function isImportacionLogin(pathname: string): boolean {
  return pathname === `${IMPORTACION_BASE}/login`;
}

function importacionFlowPath(pathname: string): string {
  return isImportacionAppPath(pathname)
    ? canonicalizeImportacionPath(pathname)
    : pathname;
}

function isProtectedPath(pathname: string): boolean {
  if (isImportacionLogin(pathname) || isImportacionPublicAppPath(pathname)) {
    return false;
  }
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/app") ||
    isImportacionAppPath(pathname) ||
    pathname.startsWith("/portales")
  );
}

function isAllowedRedirect(redirectTo: string): boolean {
  return isAllowedAuthRedirect(redirectTo);
}

export async function updateSession(request: NextRequest) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    if (
      isProtectedPath(request.nextUrl.pathname) ||
      isImportacionLogin(request.nextUrl.pathname)
    ) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = isImportacionLogin(request.nextUrl.pathname)
        ? `${IMPORTACION_BASE}/login`
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
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
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

  const recoveryPath = recoveryRedirectPath({
    pathname,
    hasRecoveryCookie: hasPasswordRecoveryCookie(request.cookies),
  });
  if (recoveryPath && !isPasswordRecoveryPath(pathname)) {
    const resetUrl = request.nextUrl.clone();
    resetUrl.pathname = recoveryPath;
    resetUrl.search = "";
    if (isProtectedPath(pathname)) {
      resetUrl.searchParams.set(
        "redirectTo",
        importacionFlowPath(pathname)
      );
    } else {
      const existing = request.nextUrl.searchParams.get("redirectTo");
      if (existing && isAllowedRedirect(existing)) {
        resetUrl.searchParams.set("redirectTo", existing);
      }
    }
    const redirectResponse = NextResponse.redirect(resetUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  // Demo caducada o cerrada: cerrar sesión y mandar al login con mensaje.
  if (user && isProtectedPath(pathname)) {
    const demoMeta = readDemoMetaFromAuthUser(user);
    if (
      demoMeta.esDemo &&
      (demoMeta.closed || isDemoExpired(demoMeta.expiresAt))
    ) {
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      const importacionFlow = isImportacionAppPath(pathname);
      loginUrl.pathname = importacionFlow
        ? `${IMPORTACION_BASE}/login`
        : "/login";
      loginUrl.searchParams.set("error", "demo_expired");
      const demoResponse = NextResponse.redirect(loginUrl);
      demoResponse.cookies.set(PASSWORD_RECOVERY_COOKIE, "", {
        ...passwordRecoveryCookieOptions(),
        maxAge: 0,
      });
      return demoResponse;
    }
  }

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    const importacionFlow = isImportacionAppPath(pathname);
    loginUrl.pathname = importacionFlow ? `${IMPORTACION_BASE}/login` : "/login";
    loginUrl.searchParams.set(
      "redirectTo",
      importacionFlow ? canonicalizeImportacionPath(pathname) : pathname
    );
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || isImportacionLogin(pathname))) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const target = request.nextUrl.clone();
    const allowedRedirect = redirectTo && isAllowedRedirect(redirectTo);
    if (isImportacionLogin(pathname)) {
      target.pathname = allowedRedirect
        ? canonicalizeImportacionPath(redirectTo)
        : IMPORTACION_BASE;
    } else {
      target.pathname = allowedRedirect ? redirectTo : "/portales";
    }
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}
