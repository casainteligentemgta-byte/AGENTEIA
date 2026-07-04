import { z } from "zod";

export const updateVehiculoContactoSchema = z.object({
  vehiculoId: z.string().uuid("ID de vehículo inválido"),
  nombreCliente: z
    .string()
    .max(120)
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Ingresa el nombre del cliente")),
  telefonoCliente: z
    .string()
    .max(20)
    .transform((v) => v.trim())
    .pipe(z.string().min(7, "Ingresa un teléfono válido")),
});

export const recordatorioEstadoSchema = z.object({
  recordatorioId: z.string().uuid("ID de recordatorio inválido"),
  estado: z.enum(["completado", "cancelado", "pendiente"]),
});
