import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-zinc-800 text-zinc-300",
        variant === "success" && "bg-emerald-500/15 text-emerald-400",
        variant === "warning" && "bg-amber-500/15 text-amber-400",
        variant === "danger" && "bg-red-500/15 text-red-400"
      )}
    >
      {children}
    </span>
  );
}
