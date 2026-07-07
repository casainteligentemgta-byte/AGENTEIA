import { z } from "zod";
import { BIKE_COMPONENT_TYPES } from "@/lib/bicicopilot/types";

export const stravaWebhookPayloadSchema = z.object({
  data: z.object({
    distance: z.number().nonnegative(),
    bicycle_id: z.string().uuid(),
  }),
});

export type StravaWebhookPayload = z.infer<typeof stravaWebhookPayloadSchema>;

export const maintenanceProtocolSchema = z.object({
  bikeId: z.string().uuid(),
  shopId: z.string().uuid(),
  componentId: z.string().uuid(),
  mechanicNotes: z.string().trim().max(2000).optional(),
  transmissionChecked: z.boolean(),
  brakesChecked: z.boolean(),
  bearingsChecked: z.boolean(),
  torqueChecked: z.boolean(),
  photoProofUrl: z.string().url().optional().or(z.literal("")),
}).refine(
  (d) =>
    d.transmissionChecked &&
    d.brakesChecked &&
    d.bearingsChecked &&
    d.torqueChecked,
  { message: "Debes completar todos los puntos del protocolo antes de cerrar." }
);

export type MaintenanceProtocolInput = z.infer<typeof maintenanceProtocolSchema>;

export const createBikeSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  frameSerial: z.string().trim().min(3).max(80),
  color: z.string().trim().max(40).optional(),
  size: z.string().trim().max(20).optional(),
  material: z.string().trim().max(40).optional(),
  shopId: z.string().uuid().optional(),
  components: z
    .array(
      z.object({
        componentType: z.enum(BIKE_COMPONENT_TYPES),
        brandModel: z.string().trim().min(1).max(120),
        kmLimit: z.coerce.number().positive(),
      })
    )
    .min(1),
});

export type CreateBikeInput = z.infer<typeof createBikeSchema>;
