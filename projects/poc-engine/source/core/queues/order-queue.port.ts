import { z } from "zod";

import { orderPayloadSchema } from "@core/orders/order.types";

export const processOrderJobSchema = z.object({
  orderId: z.string().uuid(),
  payload: orderPayloadSchema,
});

export type ProcessOrderJobData = z.infer<typeof processOrderJobSchema>;

export interface OrderQueuePort {
  enqueueProcessOrder(job: ProcessOrderJobData): Promise<void>;
}
