"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (mounted) setUser(data.user);
        setLoading(false);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (mounted) setUser(session?.user ?? null);
      });
      return () => {
        mounted = false;
        sub.subscription.unsubscribe();
      };
    } catch {
      setLoading(false);
    }
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login?redirectTo=/agente"
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
      >
        <LogIn className="h-3.5 w-3.5" />
        Login
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="max-w-[140px] truncate text-xs text-zinc-500" title={user.email ?? ""}>
        {user.email ?? "Sesión activa"}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-red-800 hover:text-red-300"
      >
        <LogOut className="h-3.5 w-3.5" />
        Salir
      </button>
    </div>
  );
}
