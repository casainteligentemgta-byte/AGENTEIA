import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  showBack?: boolean;
  backHref?: string;
  title?: string;
  subtitle?: string;
  variant?: "dark" | "light";
  centered?: boolean;
};

export function AppHeader({
  showBack,
  backHref = "/app",
  title,
  subtitle,
  variant = "dark",
  centered = false,
}: AppHeaderProps) {
  const isLight = variant === "light";

  if (centered && !showBack) {
    return (
      <header
        className={cn(
          "sticky top-0 z-20 px-4 py-4",
          isLight ? "border-b border-zinc-200/80 bg-[#eef2f1]/95 backdrop-blur-md" : "app-bg-dark border-b border-white/5"
        )}
      >
        <div className="flex justify-center">
          <BrandLogo theme={isLight ? "light" : "dark"} />
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-20 backdrop-blur-md",
        isLight
          ? "border-b border-zinc-200/80 bg-[#eef2f1]/95"
          : "border-b border-white/10 bg-[#0b1220]/95"
      )}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
        {showBack ? (
          <Link
            href={backHref}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
              isLight ? "text-brand-600 hover:bg-zinc-200/60" : "text-brand-400 hover:bg-white/5"
            )}
            aria-label="Volver"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
        ) : (
          <BrandLogo size="sm" theme={isLight ? "light" : "dark"} showDot={false} />
        )}
        <div className="min-w-0 flex-1">
          {title ? (
            <>
              <h1
                className={cn(
                  "truncate text-lg font-bold",
                  isLight ? "text-zinc-900" : "text-white"
                )}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="truncate text-sm text-zinc-500">{subtitle}</p>
              )}
            </>
          ) : (
            <BrandLogo theme={isLight ? "light" : "dark"} />
          )}
        </div>
        {showBack && <div className="w-9 shrink-0" />}
      </div>
    </header>
  );
}
