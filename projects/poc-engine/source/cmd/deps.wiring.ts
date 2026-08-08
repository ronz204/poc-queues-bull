import IORedis from "ioredis";

import { env } from "@env";
import { Drizzler } from "@customs/drizzler";
import { BullmqOrderQueue } from "@queues/process-order.queue";

export const redisConnection = new IORedis(env.REDIS_QUEUE_URL, {
  maxRetriesPerRequest: null,
});

export const db = new Drizzler({ url: env.POSTGRES_CONNECTION }).db;

export const orderQueue = new BullmqOrderQueue({ connection: redisConnection });
