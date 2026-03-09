import { Queue, Worker } from "bullmq";

import { logger } from "~/lib/logger";

const redisUrl = process.env.REDIS_URL;
const connection = redisUrl
  ? (() => {
      const parsed = new URL(redisUrl);
      return {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        username: parsed.username || undefined,
        password: parsed.password || undefined,
      };
    })()
  : null;

export const sampleQueue = connection
  ? new Queue("sample-jobs", { connection })
  : null;

export async function enqueueSampleJob(payload: { name: string }) {
  if (!sampleQueue) {
    logger.warn("Queue disabled: REDIS_URL not configured.");
    return { queued: false };
  }

  await sampleQueue.add("sample", payload);
  return { queued: true };
}

export function createSampleWorker() {
  if (!connection) {
    logger.warn("Worker disabled: REDIS_URL not configured.");
    return null;
  }

  return new Worker(
    "sample-jobs",
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, "Processing sample job");
    },
    { connection },
  );
}
