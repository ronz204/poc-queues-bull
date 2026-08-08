import { env } from "@env";
import { redisConnection, db } from "@deps";
import { ProcessOrderHandler } from "@app/order-processor/process-order.handler";
import { ProcessOrderWorker } from "@queues/process-order.worker";

const processOrderHandler = new ProcessOrderHandler({ db });
const processOrderWorker = new ProcessOrderWorker({
  connection: redisConnection,
  processOrderHandler,
  concurrency: 1,
});

console.log(`🐂 ${env.APP_NAME} worker consuming "process-order"`);

process.on("SIGTERM", async () => {
  console.log("SIGTERM received — draining active job before exit");
  await processOrderWorker.close();
  process.exit(0);
});
