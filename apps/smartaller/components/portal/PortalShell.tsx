import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PortalShell({
  title,
  subtitle,
  children,
  backHref = "/portales",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  backHref?: string;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.1),_transparent_45%),linear-gradient(180deg,#070b12_0%,#0a1220_50%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-2 rounded-full px-1 py-1 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Portales
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">{subtitle}</p>
          ) : null}
        </header>
        {children}
      </div>
    </main>
  );
}
