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

export function BrandLogo({
  size = "md",
  theme = "dark",
  showDot = true,
  className,
}: BrandLogoProps) {
  const s = sizes[size];
  const isDark = theme === "dark";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("relative shrink-0", s.icon)}>
        <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
          <polygon
            points="24,2 44,13 44,35 24,46 4,35 4,13"
            fill="none"
            stroke="#2563eb"
            strokeWidth="4"
          />
          <polygon
            points="24,8 38,16 38,32 24,40 10,32 10,16"
            fill="none"
            stroke={isDark ? "#ffffff" : "#18181b"}
            strokeWidth="2"
          />
          <polygon points="24,14 32,19 32,29 24,34 16,29 16,19" fill="#18181b" />
        </svg>
      </div>
      <div className={cn("flex items-baseline font-bold tracking-tight", s.text)}>
        <span className={isDark ? "text-white" : "text-zinc-900"}>Smart</span>
        <span className="text-blue-600">Taller</span>
        {showDot && (
          <span className="mb-2 ml-0.5 h-2 w-2 rounded-full bg-red-500" aria-hidden />
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
