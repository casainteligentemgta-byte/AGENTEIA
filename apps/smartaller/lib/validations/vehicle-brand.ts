import type { RefinementCtx } from "zod";
import { validateVehicleBrand } from "@/lib/brand";

export function refineVehicleBrand(
  data: { marca?: string | null; modelo?: string | null },
  ctx: RefinementCtx,
  requireModelo = true
): void {
  const result = validateVehicleBrand(data, { requireModelo });
  if (result.ok) return;
  ctx.addIssue({
    code: "custom",
    message: result.error,
    path: [result.path],
  });
}
