import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  tenantAdminProcedure,
  publicTenantProcedure,
} from "~/server/api/trpc";
import { resolveVisitorSession } from "~/server/api/visitor-sessions";

export const interactionsRouter = createTRPCRouter({
  track: publicTenantProcedure
    .input(
      z.object({
        eventType: z.string().min(2).max(120),
        productId: z.string().cuid().optional(),
        stepId: z.string().cuid().optional(),
        assetId: z.string().cuid().optional(),
        visitorToken: z.string().min(8).max(191).optional(),
        targetType: z.string().max(120).optional(),
        targetId: z.string().max(191).optional(),
        value: z.string().max(191).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.productId) {
        const product = await ctx.db.product.findFirst({
          where: {
            id: input.productId,
            tenantId: ctx.tenantId,
          },
          select: { id: true },
        });
        if (!product) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
        }
      }

      if (input.stepId) {
        const step = await ctx.db.productStep.findFirst({
          where: {
            id: input.stepId,
            tenantId: ctx.tenantId,
            productId: input.productId,
          },
          select: { id: true },
        });
        if (!step) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Step not found." });
        }
      }

      if (input.assetId) {
        const asset = await ctx.db.productAsset.findFirst({
          where: {
            id: input.assetId,
            tenantId: ctx.tenantId,
            productId: input.productId,
          },
          select: { id: true },
        });
        if (!asset) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });
        }
      }

      const visitorSession = await resolveVisitorSession({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: ctx.session?.user?.id,
        visitorToken: input.visitorToken,
        userAgent: ctx.requestHeaders?.get("user-agent"),
        createIfMissing: !ctx.session?.user,
      });

      const event = await ctx.db.userInteractionEvent.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.session?.user?.id,
          visitorSessionId: visitorSession?.id,
          eventType: input.eventType,
          productId: input.productId,
          stepId: input.stepId,
          assetId: input.assetId,
          targetType: input.targetType,
          targetId: input.targetId,
          value: input.value,
          metadata: input.metadata,
        },
      });

      return {
        event,
        visitorToken: visitorSession?.token ?? input.visitorToken ?? null,
      };
    }),

  recentByProduct: tenantAdminProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.userInteractionEvent.findMany({
        where: {
          tenantId: ctx.tenantId,
          productId: input.productId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          occurredAt: "desc",
        },
        take: input.limit,
      });
    }),
});
