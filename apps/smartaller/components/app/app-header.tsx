import Link from "next/link";
import { Hexagon } from "lucide-react";

type AppHeaderProps = {
  showBack?: boolean;
  backHref?: string;
  title?: string;
  subtitle?: string;
};

export function AppHeader({ showBack, backHref = "/app", title, subtitle }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1628]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
        {showBack ? (
          <Link
            href={backHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-400 transition hover:bg-white/5"
            aria-label="Volver"
          >
            ←
          </Link>
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
            <Hexagon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {title ? (
            <>
              <h1 className="truncate text-lg font-bold text-white">{title}</h1>
              {subtitle && <p className="truncate text-sm text-zinc-400">{subtitle}</p>}
            </>
          ) : (
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl font-bold text-white">Smart</span>
              <span className="text-xl font-bold text-blue-400">Taller</span>
              <span className="ml-1 h-2 w-2 rounded-full bg-red-500" aria-hidden />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
