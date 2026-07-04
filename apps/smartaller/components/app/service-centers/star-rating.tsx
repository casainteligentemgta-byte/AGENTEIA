import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StarRatingProps = {
  rating: number;
  count: number;
  size?: "sm" | "md";
};

export function StarRating({ rating, count, size = "sm" }: StarRatingProps) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (count === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn(iconClass, "text-zinc-300")} />
          ))}
        </div>
        <span className="text-xs text-zinc-400">Sin reseñas</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < Math.round(rating);
          return (
            <Star
              key={i}
              className={cn(
                iconClass,
                filled ? "fill-amber-400 text-amber-400" : "text-zinc-300"
              )}
            />
          );
        })}
      </div>
      <span className="text-xs text-zinc-500">({count})</span>
    </div>
  );
}
