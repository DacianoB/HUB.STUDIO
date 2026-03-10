import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  tenantAdminProcedure,
  tenantProcedure,
} from "~/server/api/trpc";
import {
  assertPageCapacity,
  assertPagePolicyCompliance,
  ensureTenantPolicy,
  tenantPolicySelect,
} from "~/server/tenant-policy";

const nodePositionSchema = z.object({
  xs: z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int() }),
  sm: z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int() }),
  lg: z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int() }),
});

export const nodePagesRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db.tenantNodePage.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }),

  upsertPage: tenantAdminProcedure
    .input(
      z.object({
        pageId: z.string().cuid().optional(),
        name: z.string().min(2).max(180),
        slug: z.string().min(1).max(240),
        description: z.string().max(1500).optional(),
        parentPageId: z.string().cuid().optional().nullable(),
        requiresAuth: z.boolean().default(false),
        editableByUser: z.boolean().default(false),
        internalRoute: z.boolean().default(false),
        indexable: z.boolean().default(true),
        hidden: z.boolean().default(false),
        sortOrder: z.number().int().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.db.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: {
          id: true,
          isOpen: true,
          policy: {
            select: tenantPolicySelect,
          },
        },
      });
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      const policy =
        tenant.policy ?? (await ensureTenantPolicy(ctx.db, tenant.id, tenant.isOpen));

      const payload = {
        tenantId: ctx.tenantId,
        name: input.name,
        slug: input.slug.replace(/^\/+/, ""),
        description: input.description,
        parentPageId: input.parentPageId ?? null,
        requiresAuth: input.requiresAuth,
        editableByUser: input.editableByUser,
        internalRoute: input.internalRoute,
        indexable: input.indexable,
        hidden: input.hidden,
        sortOrder: input.sortOrder,
      };
      assertPagePolicyCompliance(policy, {
        requiresAuth: input.requiresAuth,
        editableByUser: input.editableByUser,
        internalRoute: input.internalRoute,
        indexable: input.indexable,
        hidden: input.hidden,
      });

      if (input.pageId) {
        const existing = await ctx.db.tenantNodePage.findFirst({
          where: { id: input.pageId, tenantId: ctx.tenantId },
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
        if (existing.isSystem) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Home and Dashboard pages are system pages and cannot be edited.",
          });
        }
        return ctx.db.tenantNodePage.update({
          where: { id: input.pageId },
          data: payload,
        });
      }
      await assertPageCapacity(ctx.db, ctx.tenantId, policy);
      if (["", "dashboard"].includes(payload.slug)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Home and Dashboard are reserved system pages.",
        });
      }
      return ctx.db.tenantNodePage.create({ data: payload });
    }),

  addNode: tenantAdminProcedure
    .input(
      z.object({
        pageId: z.string().cuid(),
        nodeKey: z.string().min(2).max(180),
        type: z.string().min(2).max(180),
        title: z.string().max(180).optional(),
        props: z.record(z.string(), z.any()).optional(),
        position: nodePositionSchema,
        sortOrder: z.number().int().default(0),
        productId: z.string().cuid().optional(),
        stepId: z.string().cuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const page = await ctx.db.tenantNodePage.findFirst({
        where: { id: input.pageId, tenantId: ctx.tenantId },
      });
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });

      return ctx.db.tenantNodeItem.create({
        data: {
          tenantId: ctx.tenantId,
          pageId: input.pageId,
          nodeKey: input.nodeKey,
          type: input.type,
          title: input.title,
          props: input.props ?? {},
          position: input.position,
          sortOrder: input.sortOrder,
          productId: input.productId,
          stepId: input.stepId,
        },
      });
    }),

  removeNode: tenantAdminProcedure
    .input(z.object({ nodeId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const node = await ctx.db.tenantNodeItem.findFirst({
        where: { id: input.nodeId, tenantId: ctx.tenantId },
      });
      if (!node) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      await ctx.db.tenantNodeItem.delete({ where: { id: input.nodeId } });
      return { ok: true };
    }),

  updateNode: tenantAdminProcedure
    .input(
      z.object({
        nodeId: z.string().cuid(),
        title: z.string().max(180).optional().nullable(),
        props: z.record(z.string(), z.any()).optional(),
        position: nodePositionSchema.optional(),
        sortOrder: z.number().int().optional(),
        productId: z.string().cuid().optional().nullable(),
        stepId: z.string().cuid().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const node = await ctx.db.tenantNodeItem.findFirst({
        where: { id: input.nodeId, tenantId: ctx.tenantId },
      });
      if (!node) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found." });
      return ctx.db.tenantNodeItem.update({
        where: { id: input.nodeId },
        data: {
          title: input.title ?? undefined,
          props: input.props ?? undefined,
          position: input.position ?? undefined,
          sortOrder: input.sortOrder ?? undefined,
          productId: input.productId ?? undefined,
          stepId: input.stepId ?? undefined,
        },
      });
    }),

  removePage: tenantAdminProcedure
    .input(z.object({ pageId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const page = await ctx.db.tenantNodePage.findFirst({
        where: { id: input.pageId, tenantId: ctx.tenantId },
      });
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      if (page.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Home and Dashboard pages are system pages and cannot be removed.",
        });
      }
      await ctx.db.tenantNodePage.delete({ where: { id: input.pageId } });
      return { ok: true };
    }),
});
