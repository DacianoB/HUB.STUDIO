import { createRequire } from "node:module";

import { logger } from "~/lib/logger";

const require = createRequire(import.meta.url);
const { Queue, Worker } = require("bullmq/dist/cjs/index.js") as {
  Queue: new (
    name: string,
    options: { connection: NonNullable<typeof connection> },
  ) => {
    add: (name: string, payload: { name: string }) => Promise<unknown>;
  };
  Worker: new (
    name: string,
    processor: (job: { id?: string; data: { name: string } }) => Promise<void>,
    options: { connection: NonNullable<typeof connection> },
  ) => unknown;
};

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

let sampleQueue:
  | {
      add: (name: string, payload: { name: string }) => Promise<unknown>;
    }
  | null
  | undefined;

function getSampleQueue() {
  if (!connection) {
    return null;
  }

  if (!sampleQueue) {
    sampleQueue = new Queue("sample-jobs", { connection });
  }

  return sampleQueue;
}

export async function enqueueSampleJob(payload: { name: string }) {
  const queue = getSampleQueue();

  if (!queue) {
    logger.warn("Queue disabled: REDIS_URL not configured.");
    return { queued: false };
  }

  await queue.add("sample", payload);
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
