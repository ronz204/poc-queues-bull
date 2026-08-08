import { z } from "zod";

export const orderPayloadSchema = z.object({
  customerName: z.string().min(1),
  items: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
  amount: z.number().positive(),
});

export type OrderPayload = z.infer<typeof orderPayloadSchema>;
