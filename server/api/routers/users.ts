import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, tenantAdminProcedure } from "~/server/api/trpc";
import {
  assertActiveMemberCapacity,
  ensureTenantPolicy,
  tenantPolicySelect,
} from "~/server/tenant-policy";

export const usersRouter = createTRPCRouter({
  listMembers: tenantAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.tenantMembership.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { joinedAt: "asc" }],
    });
  }),

  updateMember: tenantAdminProcedure
    .input(
      z
        .object({
          userId: z.string().cuid(),
          role: z.enum(["ADMIN", "INSTRUCTOR", "MEMBER"]).optional(),
          status: z.enum(["ACTIVE", "PENDING", "BLOCKED"]).optional(),
        })
        .refine((value) => value.role || value.status, {
          message: "Provide at least one change.",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const [membership, tenant] = await Promise.all([
        ctx.db.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: ctx.tenantId,
              userId: input.userId,
            },
          },
        }),
        ctx.db.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: {
            id: true,
            isOpen: true,
            policy: {
              select: tenantPolicySelect,
            },
          },
        }),
      ]);

      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
      }
      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      }

      if (
        membership.role === "OWNER" &&
        (input.role || (input.status && input.status !== membership.status))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Owner membership cannot be changed from this screen.",
        });
      }

      const policy =
        tenant.policy ?? (await ensureTenantPolicy(ctx.db, tenant.id, tenant.isOpen));
      if (input.status === "ACTIVE") {
        await assertActiveMemberCapacity(
          ctx.db,
          ctx.tenantId,
          policy,
          membership.status,
        );
      }

      return ctx.db.tenantMembership.update({
        where: {
          tenantId_userId: {
            tenantId: ctx.tenantId,
            userId: input.userId,
          },
        },
        data: {
          role: input.role,
          status: input.status,
        },
      });
    }),

  listJoinRequests: tenantAdminProcedure.query(async ({ ctx }) => {
    const [pendingMemberships, pendingInvites] = await Promise.all([
      ctx.db.tenantMembership.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: "PENDING",
        },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      ctx.db.tenantInvitation.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { pendingMemberships, pendingInvites };
  }),

  approveJoinRequest: tenantAdminProcedure
    .input(z.object({ userId: z.string().cuid(), role: z.enum(["ADMIN", "INSTRUCTOR", "MEMBER"]).default("MEMBER") }))
    .mutation(async ({ ctx, input }) => {
      const [existingMembership, tenant] = await Promise.all([
        ctx.db.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: ctx.tenantId,
              userId: input.userId,
            },
          },
        }),
        ctx.db.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: {
            id: true,
            isOpen: true,
            policy: {
              select: tenantPolicySelect,
            },
          },
        }),
      ]);
      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      }
      const policy =
        tenant.policy ?? (await ensureTenantPolicy(ctx.db, tenant.id, tenant.isOpen));
      await assertActiveMemberCapacity(
        ctx.db,
        ctx.tenantId,
        policy,
        existingMembership?.status,
      );

      return ctx.db.tenantMembership.upsert({
        where: {
          tenantId_userId: {
            tenantId: ctx.tenantId,
            userId: input.userId,
          },
        },
        update: {
          status: "ACTIVE",
          role: input.role,
          invitedByUserId: ctx.session!.user.id,
        },
        create: {
          tenantId: ctx.tenantId,
          userId: input.userId,
          status: "ACTIVE",
          role: input.role,
          invitedByUserId: ctx.session!.user.id,
        },
      });
    }),

  grantProductAccess: tenantAdminProcedure
    .input(
      z.object({
        userId: z.string().cuid(),
        productId: z.string().cuid(),
        canView: z.boolean().default(true),
        canDownload: z.boolean().default(true),
        canEditProgress: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [membership, product] = await Promise.all([
        ctx.db.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: ctx.tenantId,
              userId: input.userId,
            },
          },
        }),
        ctx.db.product.findFirst({
          where: {
            id: input.productId,
            tenantId: ctx.tenantId,
          },
        }),
      ]);
      if (!membership || membership.status !== "ACTIVE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User is not active in tenant." });
      }
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      }

      return ctx.db.userProductAccess.upsert({
        where: {
          tenantId_userId_productId: {
            tenantId: ctx.tenantId,
            userId: input.userId,
            productId: input.productId,
          },
        },
        update: {
          canView: input.canView,
          canDownload: input.canDownload,
          canEditProgress: input.canEditProgress,
          grantedByUserId: ctx.session!.user.id,
        },
        create: {
          tenantId: ctx.tenantId,
          userId: input.userId,
          productId: input.productId,
          canView: input.canView,
          canDownload: input.canDownload,
          canEditProgress: input.canEditProgress,
          grantedByUserId: ctx.session!.user.id,
        },
      });
    }),

  revokeProductAccess: tenantAdminProcedure
    .input(
      z.object({
        userId: z.string().cuid(),
        productId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const access = await ctx.db.userProductAccess.findUnique({
        where: {
          tenantId_userId_productId: {
            tenantId: ctx.tenantId,
            userId: input.userId,
            productId: input.productId,
          },
        },
      });

      if (!access) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product access record not found.",
        });
      }

      return ctx.db.userProductAccess.delete({
        where: {
          tenantId_userId_productId: {
            tenantId: ctx.tenantId,
            userId: input.userId,
            productId: input.productId,
          },
        },
      });
    }),

  listProductAccesses: tenantAdminProcedure
    .input(z.object({ userId: z.string().cuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.userProductAccess.findMany({
        where: {
          tenantId: ctx.tenantId,
          userId: input?.userId,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
          product: { select: { id: true, name: true, slug: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),
});
