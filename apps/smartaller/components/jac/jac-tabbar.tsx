"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Car, Home, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function JacTabbar({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const copy = getBrand().copy.owner;
  const items = [
    { href: "/app", label: copy.tabInicio, icon: Home },
    { href: "/app/timeline", label: copy.tabCitas, icon: CalendarDays },
    { href: "/app/centros", label: copy.tabTaller, icon: Car },
  ] as const;

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav
      className={cn(
        "jac-tabbar pointer-events-auto z-30 flex w-[min(92%,24rem)] items-center justify-around px-2 py-2",
        embedded
          ? "absolute bottom-4 left-1/2 -translate-x-1/2"
          : "fixed bottom-4 left-1/2 -translate-x-1/2"
      )}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/app" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-semibold",
              active ? "text-[#1c1c22]" : "text-[#6a6a74]"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={signOut}
        className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-semibold text-[#6a6a74]"
      >
        <UserRound className="h-5 w-5" />
        {copy.tabCuenta}
      </button>
    </nav>
  );
}
