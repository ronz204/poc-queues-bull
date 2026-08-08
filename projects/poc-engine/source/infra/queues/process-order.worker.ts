import { Worker, QueueEvents } from "bullmq";
import type { Redis } from "ioredis";

import { processOrderJobSchema, type ProcessOrderJobData } from "@core/queues/order-queue.port";
import type { ProcessOrderHandler } from "@app/order-processor/process-order.handler";

import { PROCESS_ORDER_QUEUE_NAME } from "./process-order.queue";

export interface ProcessOrderWorkerProps {
  connection: Redis;
  processOrderHandler: ProcessOrderHandler;
  concurrency: number;
}

export class ProcessOrderWorker {

  private readonly worker: Worker<ProcessOrderJobData>;
  private readonly queueEvents: QueueEvents;

  constructor(props: ProcessOrderWorkerProps) {
    this.worker = new Worker<ProcessOrderJobData>(
      PROCESS_ORDER_QUEUE_NAME,
      async (job) => {
        const data = processOrderJobSchema.parse(job.data);
        console.log(`[process-order] job ${job.id} started (order ${data.orderId})`);
        await props.processOrderHandler.handle(data);
        console.log(`[process-order] job ${job.id} finished (order ${data.orderId})`);
      },
      { connection: props.connection, concurrency: props.concurrency },
    );

    this.queueEvents = new QueueEvents(PROCESS_ORDER_QUEUE_NAME, { connection: props.connection });
    this.queueEvents.on("completed", ({ jobId }) => {
      console.log(`[process-order] ${jobId} completed`);
    });
    this.queueEvents.on("failed", ({ jobId, failedReason }) => {
      console.log(`[process-order] ${jobId} failed: ${failedReason}`);
    });
  };

  async close(): Promise<void> {
    await this.worker.close();
    await this.queueEvents.close();
  };
};
