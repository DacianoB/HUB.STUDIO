import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  publicTenantProcedure,
  tenantProcedure,
} from "~/server/api/trpc";
import { resolveVisitorSession } from "~/server/api/visitor-sessions";

async function ensureStepBelongsToProduct(input: {
  db: typeof import("~/server/db").db;
  tenantId: string;
  productId: string;
  stepId: string;
}) {
  const step = await input.db.productStep.findFirst({
    where: {
      id: input.stepId,
      tenantId: input.tenantId,
      productId: input.productId,
    },
  });

  if (!step) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Step not found." });
  }

  return step;
}

export const progressRouter = createTRPCRouter({
  markStepProgress: tenantProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        stepId: z.string().cuid(),
        watchPercent: z.number().min(0).max(100).optional(),
        completed: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureStepBelongsToProduct({
        db: ctx.db,
        tenantId: ctx.tenantId,
        productId: input.productId,
        stepId: input.stepId,
      });

      const status = input.completed
        ? "COMPLETED"
        : input.watchPercent && input.watchPercent > 0
          ? "IN_PROGRESS"
          : "NOT_STARTED";
      const action = input.completed
        ? "COMPLETED"
        : input.watchPercent && input.watchPercent > 0
          ? "PROGRESSED"
          : "OPENED";

      return ctx.db.$transaction(async (tx) => {
        const progress = await tx.userProductProgress.upsert({
          where: {
            tenantId_userId_stepId: {
              tenantId: ctx.tenantId,
              userId: ctx.session!.user.id,
              stepId: input.stepId,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            userId: ctx.session!.user.id,
            productId: input.productId,
            stepId: input.stepId,
            firstAccessedAt: new Date(),
            lastAccessedAt: new Date(),
            completedAt: input.completed ? new Date() : null,
            status,
            watchPercent: input.watchPercent ?? 0,
          },
          update: {
            lastAccessedAt: new Date(),
            completedAt: input.completed ? new Date() : undefined,
            status,
            watchPercent: input.watchPercent ?? undefined,
          },
        });

        await tx.userStepInteraction.create({
          data: {
            tenantId: ctx.tenantId,
            userId: ctx.session!.user.id,
            productId: input.productId,
            stepId: input.stepId,
            action,
            progressPercent: input.watchPercent,
          },
        });

        return progress;
      });
    }),

  trackStepInteraction: publicTenantProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        stepId: z.string().cuid(),
        action: z.enum(["OPENED", "PROGRESSED", "COMPLETED", "DOWNLOADED"]),
        progressPercent: z.number().min(0).max(100).optional(),
        visitorToken: z.string().min(8).max(191).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureStepBelongsToProduct({
        db: ctx.db,
        tenantId: ctx.tenantId,
        productId: input.productId,
        stepId: input.stepId,
      });

      const visitorSession = await resolveVisitorSession({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: ctx.session?.user?.id,
        visitorToken: input.visitorToken,
        userAgent: ctx.requestHeaders?.get("user-agent"),
        createIfMissing: !ctx.session?.user,
      });

      const interaction = await ctx.db.userStepInteraction.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.session?.user?.id,
          visitorSessionId: visitorSession?.id,
          productId: input.productId,
          stepId: input.stepId,
          action: input.action,
          progressPercent: input.progressPercent,
          metadata: input.metadata,
        },
      });

      return {
        interaction,
        visitorToken: visitorSession?.token ?? input.visitorToken ?? null,
      };
    }),

  trackAssetInteraction: publicTenantProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        assetId: z.string().cuid(),
        stepId: z.string().cuid().optional(),
        action: z.enum(["VIEWED", "WATCHED", "DOWNLOADED", "OPENED", "CLICKED"]),
        watchedSeconds: z.number().int().min(0).optional(),
        downloaded: z.boolean().optional(),
        visitorToken: z.string().min(8).max(191).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.db.productAsset.findFirst({
        where: {
          id: input.assetId,
          tenantId: ctx.tenantId,
          productId: input.productId,
        },
      });

      if (!asset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });
      }

      if (input.stepId) {
        await ensureStepBelongsToProduct({
          db: ctx.db,
          tenantId: ctx.tenantId,
          productId: input.productId,
          stepId: input.stepId,
        });
      }

      const visitorSession = await resolveVisitorSession({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: ctx.session?.user?.id,
        visitorToken: input.visitorToken,
        userAgent: ctx.requestHeaders?.get("user-agent"),
        createIfMissing: !ctx.session?.user,
      });

      const interaction = await ctx.db.userAssetInteraction.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.session?.user?.id,
          visitorSessionId: visitorSession?.id,
          productId: input.productId,
          assetId: input.assetId,
          stepId: input.stepId,
          action: input.action,
          watchedSeconds: input.watchedSeconds,
          downloaded:
            input.downloaded ?? (input.action === "DOWNLOADED" || asset.isDownloadable),
          metadata: input.metadata,
        },
      });

      return {
        interaction,
        visitorToken: visitorSession?.token ?? input.visitorToken ?? null,
      };
    }),

  markAssetDownloaded: publicTenantProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        assetId: z.string().cuid(),
        stepId: z.string().cuid().optional(),
        visitorToken: z.string().min(8).max(191).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.db.productAsset.findFirst({
        where: {
          id: input.assetId,
          tenantId: ctx.tenantId,
          productId: input.productId,
        },
      });

      if (!asset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });
      }

      const visitorSession = await resolveVisitorSession({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: ctx.session?.user?.id,
        visitorToken: input.visitorToken,
        userAgent: ctx.requestHeaders?.get("user-agent"),
        createIfMissing: !ctx.session?.user,
      });

      const interaction = await ctx.db.userAssetInteraction.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.session?.user?.id,
          visitorSessionId: visitorSession?.id,
          productId: input.productId,
          assetId: input.assetId,
          stepId: input.stepId,
          action: "DOWNLOADED",
          downloaded: true,
        },
      });

      return {
        interaction,
        visitorToken: visitorSession?.token ?? input.visitorToken ?? null,
      };
    }),

  myProductProgress: tenantProcedure
    .input(z.object({ productId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const [steps, progress] = await Promise.all([
        ctx.db.productStep.findMany({
          where: { tenantId: ctx.tenantId, productId: input.productId },
          orderBy: { sortOrder: "asc" },
        }),
        ctx.db.userProductProgress.findMany({
          where: {
            tenantId: ctx.tenantId,
            userId: ctx.session!.user.id,
            productId: input.productId,
          },
        }),
      ]);

      const completedStepIds = new Set(
        progress.filter((item) => item.status === "COMPLETED").map((item) => item.stepId),
      );
      const nextStep = steps.find((step) => !completedStepIds.has(step.id)) ?? null;

      return {
        steps,
        progress,
        nextStep,
      };
    }),
});
