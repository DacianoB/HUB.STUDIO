import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  MAX_TENANT_NODE_RADIUS,
  MIN_TENANT_NODE_RADIUS,
} from "~/app/_nodes/tenant-theme";
import {
  createTRPCRouter,
  globalAdminProcedure,
  protectedProcedure,
  tenantAdminProcedure,
  tenantProcedure,
} from "~/server/api/trpc";
import { isSupportedAssetUrl } from "~/server/uploads";

const slugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const tenantThemeSchema = z.object({
  bgMain: z.string().min(4).max(32),
  bgSecondary: z.string().min(4).max(32),
  textMain: z.string().min(4).max(32),
  textSecondary: z.string().min(4).max(32),
  borderColor: z.string().min(4).max(32),
  accent: z.string().min(4).max(32),
  buttonPrimary: z.string().min(4).max(32),
  buttonPrimaryHover: z.string().min(4).max(32),
  buttonText: z.string().min(4).max(32),
  cardBg: z.string().min(4).max(32),
});

function readTenantSettings(settings: unknown) {
  return settings && typeof settings === "object"
    ? (settings as Record<string, unknown>)
    : {};
}

export const tenantsRouter = createTRPCRouter({
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.tenantMembership.findMany({
      where: {
        userId: ctx.session!.user.id,
        status: "ACTIVE",
      },
      include: {
        tenant: true,
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    return memberships.map((membership) => ({
      role: membership.role,
      joinedAt: membership.joinedAt,
      tenant: membership.tenant,
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(120),
        slug: slugSchema,
        isOpen: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.db.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          isOpen: input.isOpen,
          createdByUserId: ctx.session!.user.id,
          memberships: {
            create: {
              userId: ctx.session!.user.id,
              role: "OWNER",
              status: "ACTIVE",
            },
          },
        },
      });

      await ctx.db.session.updateMany({
        where: {
          userId: ctx.session!.user.id,
        },
        data: {
          activeTenantId: tenant.id,
        },
      });

      return tenant;
    }),

  setActive: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.db.tenant.findUnique({ where: { id: input.tenantId } });
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });

      let tenantIdToSet: string | null = null;
      let tenantSlug = tenant.slug;
      if (ctx.session!.user.isGlobalAdmin) {
        tenantIdToSet = tenant.id;
      } else {
        const membership = await ctx.db.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: input.tenantId,
              userId: ctx.session!.user.id,
            },
          },
          include: {
            tenant: true,
          },
        });
        if (!membership || membership.status !== "ACTIVE") {
          throw new TRPCError({ code: "FORBIDDEN", message: "No access to tenant." });
        }
        tenantIdToSet = membership.tenantId;
        tenantSlug = membership.tenant.slug;
      }

      await ctx.db.session.updateMany({
        where: {
          userId: ctx.session!.user.id,
        },
        data: {
          activeTenantId: tenantIdToSet,
        },
      });

      return {
        tenantId: tenantIdToSet,
        tenantSlug,
      };
    }),

  joinBySlug: protectedProcedure
    .input(z.object({ slug: slugSchema }))
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.db.tenant.findUnique({
        where: { slug: input.slug },
      });
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      if (!tenant.isOpen) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tenant is invite-only." });
      }

      const membership = await ctx.db.tenantMembership.upsert({
        where: {
          tenantId_userId: {
            tenantId: tenant.id,
            userId: ctx.session!.user.id,
          },
        },
        update: {
          status: "ACTIVE",
        },
        create: {
          tenantId: tenant.id,
          userId: ctx.session!.user.id,
          role: "MEMBER",
          status: "ACTIVE",
        },
      });

      await ctx.db.session.updateMany({
        where: {
          userId: ctx.session!.user.id,
        },
        data: {
          activeTenantId: tenant.id,
        },
      });

      return { tenant, membership };
    }),

  current: tenantProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.db.tenant.findUnique({
      where: { id: ctx.tenantId },
    });
    if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
    return {
      tenant,
      role: ctx.tenantRole,
    };
  }),

  updateTheme: tenantAdminProcedure
    .input(tenantThemeSchema)
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.db.tenant.findUnique({
        where: { id: ctx.tenantId },
      });
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });

      const settings = readTenantSettings(tenant.settings);

      return ctx.db.tenant.update({
        where: { id: ctx.tenantId },
        data: {
          settings: {
            ...settings,
            theme: {
              ...input,
            },
          },
        },
      });
    }),

  updateBranding: tenantAdminProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(120),
        logoUrl: z.string().trim().max(2048).nullable(),
        nodeRadius: z.number().int().min(MIN_TENANT_NODE_RADIUS).max(MAX_TENANT_NODE_RADIUS),
        theme: tenantThemeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.db.tenant.findUnique({
        where: { id: ctx.tenantId },
      });
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });

      const settings = readTenantSettings(tenant.settings);
      const logoUrl = input.logoUrl?.trim() || null;

      if (logoUrl && !isSupportedAssetUrl(logoUrl)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid logo URL.",
        });
      }

      return ctx.db.tenant.update({
        where: { id: ctx.tenantId },
        data: {
          name: input.name,
          settings: {
            ...settings,
            theme: {
              ...input.theme,
            },
            logoUrl,
            nodeRadius: input.nodeRadius,
          },
        },
      });
    }),

  listAll: globalAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.tenant.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        isOpen: true,
        createdAt: true,
        _count: {
          select: {
            memberships: true,
            products: true,
          },
        },
      },
    });
  }),

  inviteByEmail: tenantAdminProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["ADMIN", "INSTRUCTOR", "MEMBER"]).default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedEmail = input.email.trim().toLowerCase();
      const invitation = await ctx.db.tenantInvitation.upsert({
        where: {
          tenantId_email: {
            tenantId: ctx.tenantId,
            email: normalizedEmail,
          },
        },
        update: {
          role: input.role,
          status: "PENDING",
          invitedByUserId: ctx.session!.user.id,
        },
        create: {
          tenantId: ctx.tenantId,
          email: normalizedEmail,
          role: input.role,
          status: "PENDING",
          invitedByUserId: ctx.session!.user.id,
        },
      });
      return invitation;
    }),

  listInvites: tenantAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.tenantInvitation.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
    });
  }),

  unlockByEmail: tenantAdminProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["ADMIN", "INSTRUCTOR", "MEMBER"]).default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedEmail = input.email.trim().toLowerCase();
      const user = await ctx.db.user.findUnique({
        where: { email: normalizedEmail },
      });

      const invitation = await ctx.db.tenantInvitation.upsert({
        where: {
          tenantId_email: {
            tenantId: ctx.tenantId,
            email: normalizedEmail,
          },
        },
        update: {
          role: input.role,
          status: "ACTIVE",
          invitedByUserId: ctx.session!.user.id,
          acceptedByUserId: user?.id,
        },
        create: {
          tenantId: ctx.tenantId,
          email: normalizedEmail,
          role: input.role,
          status: "ACTIVE",
          invitedByUserId: ctx.session!.user.id,
          acceptedByUserId: user?.id,
        },
      });

      if (!user) {
        return {
          invitation,
          membership: null,
          note: "Invite unlocked. Membership will be created after first login.",
        };
      }

      const membership = await ctx.db.tenantMembership.upsert({
        where: {
          tenantId_userId: {
            tenantId: ctx.tenantId,
            userId: user.id,
          },
        },
        update: {
          role: input.role,
          status: "ACTIVE",
          invitedByUserId: ctx.session!.user.id,
        },
        create: {
          tenantId: ctx.tenantId,
          userId: user.id,
          role: input.role,
          status: "ACTIVE",
          invitedByUserId: ctx.session!.user.id,
        },
      });

      return { invitation, membership };
    }),
});
