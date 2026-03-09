import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  tenantAdminProcedure,
  tenantProcedure,
} from "~/server/api/trpc";

export const productFeaturesRouter = createTRPCRouter({
  listByProduct: tenantProcedure
    .input(z.object({ productId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.productFeature.findMany({
        where: {
          tenantId: ctx.tenantId,
          productId: input.productId,
        },
        orderBy: { sortOrder: "asc" },
      });
    }),

  create: tenantAdminProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        title: z.string().min(2).max(180),
        description: z.string().max(1000).optional(),
        sortOrder: z.number().int().default(0),
        isVisible: z.boolean().default(true),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.product.findFirst({
        where: { id: input.productId, tenantId: ctx.tenantId },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });

      return ctx.db.productFeature.create({
        data: {
          tenantId: ctx.tenantId,
          ...input,
        },
      });
    }),

  update: tenantAdminProcedure
    .input(
      z.object({
        featureId: z.string().cuid(),
        title: z.string().min(2).max(180).optional(),
        description: z.string().max(1000).optional().nullable(),
        sortOrder: z.number().int().optional(),
        isVisible: z.boolean().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { featureId, ...rest } = input;
      const feature = await ctx.db.productFeature.findFirst({
        where: { id: featureId, tenantId: ctx.tenantId },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found." });

      return ctx.db.productFeature.update({
        where: { id: featureId },
        data: rest,
      });
    }),

  remove: tenantAdminProcedure
    .input(z.object({ featureId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.productFeature.findFirst({
        where: { id: input.featureId, tenantId: ctx.tenantId },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found." });
      await ctx.db.productFeature.delete({ where: { id: input.featureId } });
      return { ok: true };
    }),
});
