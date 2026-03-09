import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  tenantAdminProcedure,
  tenantProcedure,
} from "~/server/api/trpc";
import { isSupportedAssetUrl } from "~/server/uploads";

const assetUrlSchema = z.string().max(2048).refine(isSupportedAssetUrl, {
  message: "Expected a valid http(s) URL or internal upload path.",
});

export const productStepsRouter = createTRPCRouter({
  listByProduct: tenantProcedure
    .input(z.object({ productId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.productStep.findMany({
        where: {
          tenantId: ctx.tenantId,
          productId: input.productId,
        },
        include: {
          assets: {
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      });
    }),

  create: tenantAdminProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        featureId: z.string().cuid().optional(),
        title: z.string().min(2).max(200),
        description: z.string().max(2000).optional(),
        sortOrder: z.number().int().default(0),
        lockUntilComplete: z.boolean().default(false),
        isRequired: z.boolean().default(true),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.product.findFirst({
        where: { id: input.productId, tenantId: ctx.tenantId },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      return ctx.db.productStep.create({
        data: {
          tenantId: ctx.tenantId,
          ...input,
        },
      });
    }),

  update: tenantAdminProcedure
    .input(
      z.object({
        stepId: z.string().cuid(),
        title: z.string().min(2).max(200).optional(),
        description: z.string().max(2000).optional().nullable(),
        sortOrder: z.number().int().optional(),
        lockUntilComplete: z.boolean().optional(),
        isRequired: z.boolean().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { stepId, ...rest } = input;
      const step = await ctx.db.productStep.findFirst({
        where: { id: stepId, tenantId: ctx.tenantId },
      });
      if (!step) throw new TRPCError({ code: "NOT_FOUND", message: "Step not found." });
      return ctx.db.productStep.update({
        where: { id: stepId },
        data: rest,
      });
    }),

  removeStep: tenantAdminProcedure
    .input(z.object({ stepId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const step = await ctx.db.productStep.findFirst({
        where: { id: input.stepId, tenantId: ctx.tenantId },
      });
      if (!step) throw new TRPCError({ code: "NOT_FOUND", message: "Step not found." });
      await ctx.db.productStep.delete({
        where: { id: input.stepId },
      });
      return { ok: true };
    }),

  createAsset: tenantAdminProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        featureId: z.string().cuid().optional(),
        stepId: z.string().cuid().optional(),
        moduleType: z.enum(["LIBRARY", "COURSE"]).optional(),
        placement: z
          .enum(["PRODUCT_HERO", "PRODUCT_GALLERY", "LIBRARY", "STEP"])
          .default("LIBRARY"),
        interactionMode: z.enum(["OPEN", "DOWNLOAD", "LINK"]).default("OPEN"),
        title: z.string().min(2).max(180),
        description: z.string().max(1000).optional(),
        type: z.enum(["VIDEO", "PDF", "FILE", "IMAGE", "LINK"]),
        url: assetUrlSchema,
        previewUrl: assetUrlSchema.optional(),
        thumbnailUrl: assetUrlSchema.optional(),
        targetUrl: assetUrlSchema.optional(),
        openInNewTab: z.boolean().default(true),
        mimeType: z.string().max(120).optional(),
        isDownloadable: z.boolean().default(false),
        durationSeconds: z.number().int().optional(),
        sortOrder: z.number().int().default(0),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.product.findFirst({
        where: { id: input.productId, tenantId: ctx.tenantId },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });

      if (input.stepId) {
        const step = await ctx.db.productStep.findFirst({
          where: {
            id: input.stepId,
            productId: input.productId,
            tenantId: ctx.tenantId,
          },
        });
        if (!step) throw new TRPCError({ code: "NOT_FOUND", message: "Step not found." });
      }

      const moduleType = input.stepId ? "COURSE" : (input.moduleType ?? "LIBRARY");
      const placement = input.stepId ? "STEP" : input.placement;

      return ctx.db.productAsset.create({
        data: {
          tenantId: ctx.tenantId,
          ...input,
          moduleType,
          placement,
        },
      });
    }),

  removeAsset: tenantAdminProcedure
    .input(z.object({ assetId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.db.productAsset.findFirst({
        where: { id: input.assetId, tenantId: ctx.tenantId },
      });
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });
      await ctx.db.productAsset.delete({
        where: { id: input.assetId },
      });
      return { ok: true };
    }),

  updateAsset: tenantAdminProcedure
    .input(
      z.object({
        assetId: z.string().cuid(),
        title: z.string().min(2).max(180).optional(),
        description: z.string().max(1000).optional().nullable(),
        type: z.enum(["VIDEO", "PDF", "FILE", "IMAGE", "LINK"]).optional(),
        url: assetUrlSchema.optional(),
        previewUrl: assetUrlSchema.optional().nullable(),
        thumbnailUrl: assetUrlSchema.optional().nullable(),
        targetUrl: assetUrlSchema.optional().nullable(),
        openInNewTab: z.boolean().optional(),
        mimeType: z.string().max(120).optional().nullable(),
        isDownloadable: z.boolean().optional(),
        durationSeconds: z.number().int().optional().nullable(),
        sortOrder: z.number().int().optional(),
        stepId: z.string().cuid().optional().nullable(),
        moduleType: z.enum(["LIBRARY", "COURSE"]).optional().nullable(),
        placement: z
          .enum(["PRODUCT_HERO", "PRODUCT_GALLERY", "LIBRARY", "STEP"])
          .optional(),
        interactionMode: z.enum(["OPEN", "DOWNLOAD", "LINK"]).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { assetId, stepId, placement, moduleType, ...rest } = input;
      const asset = await ctx.db.productAsset.findFirst({
        where: { id: assetId, tenantId: ctx.tenantId },
      });
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });

      if (stepId) {
        const step = await ctx.db.productStep.findFirst({
          where: {
            id: stepId,
            tenantId: ctx.tenantId,
            productId: asset.productId,
          },
        });
        if (!step) throw new TRPCError({ code: "NOT_FOUND", message: "Step not found." });
      }

      const nextStepId = stepId === undefined ? asset.stepId : stepId;
      const nextModuleType = nextStepId ? "COURSE" : (moduleType ?? asset.moduleType ?? "LIBRARY");
      const nextPlacement = nextStepId ? "STEP" : (placement ?? asset.placement);

      return ctx.db.productAsset.update({
        where: { id: assetId },
        data: {
          ...rest,
          stepId: stepId === undefined ? undefined : stepId,
          moduleType: nextModuleType,
          placement: nextPlacement,
        },
      });
    }),
});
