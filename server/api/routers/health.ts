import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { enqueueSampleJob } from "~/server/queue";

export const healthRouter = createTRPCRouter({
  ping: publicProcedure.query(() => ({
    ok: true,
    ts: new Date().toISOString(),
  })),

  enqueue: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => enqueueSampleJob(input)),
});
