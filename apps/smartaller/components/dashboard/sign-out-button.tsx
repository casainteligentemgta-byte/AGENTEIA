import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  variant?: "sidebar" | "header";
  tone?: "dark" | "light";
};

export function SignOutButton({
  variant = "sidebar",
  tone = "dark",
}: SignOutButtonProps) {
  const isHeader = variant === "header";
  const isLight = tone === "light";

  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={cn(
          "inline-flex items-center whitespace-nowrap transition",
          isHeader
            ? cn(
                "gap-1.5 rounded-xl px-2.5 py-1.5 text-xs",
                isLight
                  ? "text-zinc-500 hover:bg-zinc-200/70 hover:text-red-600"
                  : "text-zinc-500 hover:bg-zinc-900 hover:text-red-400"
              )
            : "w-full gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 hover:bg-zinc-900 hover:text-red-400"
        )}
      >
        <LogOut className={isHeader ? "h-3.5 w-3.5" : "h-4 w-4"} />
        Cerrar sesión
      </button>
    </form>
  );
}
