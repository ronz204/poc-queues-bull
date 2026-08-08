import { Queue } from "bullmq";
import type { Redis } from "ioredis";

import type { OrderQueuePort, ProcessOrderJobData } from "@core/queues/order-queue.port";
import { QueueEnqueueError } from "@core/queues/queue.errors";

export const PROCESS_ORDER_QUEUE_NAME = "process-order";

export interface BullmqOrderQueueProps {
  connection: Redis;
}

export class BullmqOrderQueue implements OrderQueuePort {

  private readonly queue: Queue<ProcessOrderJobData>;

  constructor(props: BullmqOrderQueueProps) {
    this.queue = new Queue<ProcessOrderJobData>(PROCESS_ORDER_QUEUE_NAME, {
      connection: props.connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  };

  async enqueueProcessOrder(job: ProcessOrderJobData): Promise<void> {
    try {
      await this.queue.add(PROCESS_ORDER_QUEUE_NAME, job);
    } catch (cause) {
      throw new QueueEnqueueError(
        `Failed to enqueue process-order job for order ${job.orderId}`,
        { cause },
      );
    }
  };
};
