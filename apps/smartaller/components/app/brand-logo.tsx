import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  theme?: "dark" | "light";
  showDot?: boolean;
  className?: string;
};

const sizes = {
  sm: { icon: "h-8 w-8", text: "text-lg" },
  md: { icon: "h-10 w-10", text: "text-xl" },
  lg: { icon: "h-16 w-16", text: "text-3xl" },
};

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-full w-full", className)} aria-hidden>
      <defs>
        <linearGradient id="st-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BRAND.colors.primaryLight} />
          <stop offset="100%" stopColor={BRAND.colors.primary} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#st-grad)" />
      <path
        d="M24 10 L36 17 V31 L24 38 L12 31 V17 Z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path
        d="M18 26v-4h3l5-5 3 3-5 5h-3v1h8v3H18v-3z"
        fill="#fff"
      />
      <circle cx="33" cy="15" r="2.5" fill={BRAND.colors.accent} />
    </svg>
  );
}

export function BrandLogo({
  size = "md",
  theme = "dark",
  showDot = false,
  className,
}: BrandLogoProps) {
  const s = sizes[size];
  const isDark = theme === "dark";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("relative shrink-0", s.icon)}>
        <LogoMark />
      </div>
      <div className={cn("flex items-baseline font-bold tracking-tight", s.text)}>
        <span className={isDark ? "text-white" : "text-zinc-900"}>Smart</span>
        <span className="text-brand-600">Taller</span>
        {showDot && (
          <span
            className="mb-2 ml-0.5 h-2 w-2 rounded-full bg-brand-500"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

export function BrandLogoStack({
  theme = "light",
  loading = false,
}: {
  theme?: "dark" | "light";
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <BrandLogo size="lg" theme={theme} />
      {loading && (
        <p className={cn("text-sm", theme === "light" ? "text-zinc-500" : "text-zinc-400")}>
          Cargando...
        </p>
      )}
    </div>
  );
}
