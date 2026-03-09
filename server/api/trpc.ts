import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";

interface CreateContextOptions {
  req?: Request;
}

interface TenantAccess {
  tenantId: string;
  tenantSlug: string;
  role: "OWNER" | "ADMIN" | "INSTRUCTOR" | "MEMBER";
}

interface RequestedTenant {
  id: string;
  slug: string;
}

async function resolveTenantAccess(input: {
  userId: string;
  isGlobalAdmin: boolean;
  userEmail?: string | null;
  tenantId?: string | null;
  tenantSlug?: string | null;
}): Promise<TenantAccess | null> {
  const { userId, isGlobalAdmin, userEmail, tenantId, tenantSlug } = input;
  let membership = null;

  if (tenantId) {
    membership = await db.tenantMembership.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
      include: { tenant: true },
    });
  } else if (tenantSlug) {
    membership = await db.tenantMembership.findFirst({
      where: {
        userId,
        tenant: { slug: tenantSlug },
      },
      include: { tenant: true },
    });
  }

  if (membership?.status === "ACTIVE") {
    return {
      tenantId: membership.tenantId,
      tenantSlug: membership.tenant.slug,
      role: membership.role,
    };
  }

  const requestedTenant =
    tenantId || tenantSlug
      ? await db.tenant.findFirst({
          where: tenantId ? { id: tenantId } : { slug: tenantSlug ?? undefined },
        })
      : null;

  if (requestedTenant && isGlobalAdmin) {
    return {
      tenantId: requestedTenant.id,
      tenantSlug: requestedTenant.slug,
      role: "OWNER",
    };
  }

  if (requestedTenant && userEmail) {
    const invitation = await db.tenantInvitation.findUnique({
      where: {
        tenantId_email: {
          tenantId: requestedTenant.id,
          email: userEmail.toLowerCase(),
        },
      },
    });
    if (invitation && invitation.status === "ACTIVE") {
      const invitedMembership = await db.tenantMembership.upsert({
        where: {
          tenantId_userId: {
            tenantId: requestedTenant.id,
            userId,
          },
        },
        update: {
          status: "ACTIVE",
          role: invitation.role,
        },
        create: {
          tenantId: requestedTenant.id,
          userId,
          status: "ACTIVE",
          role: invitation.role,
          invitedByUserId: invitation.invitedByUserId,
        },
      });

      await db.tenantInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACTIVE",
          acceptedByUserId: userId,
        },
      });

      return {
        tenantId: invitedMembership.tenantId,
        tenantSlug: requestedTenant.slug,
        role: invitedMembership.role,
      };
    }
  }

  if (!requestedTenant && userEmail) {
    const firstActiveInvite = await db.tenantInvitation.findFirst({
      where: {
        email: userEmail.toLowerCase(),
        status: "ACTIVE",
      },
      include: {
        tenant: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    if (firstActiveInvite) {
      const invitedMembership = await db.tenantMembership.upsert({
        where: {
          tenantId_userId: {
            tenantId: firstActiveInvite.tenantId,
            userId,
          },
        },
        update: {
          status: "ACTIVE",
          role: firstActiveInvite.role,
        },
        create: {
          tenantId: firstActiveInvite.tenantId,
          userId,
          status: "ACTIVE",
          role: firstActiveInvite.role,
          invitedByUserId: firstActiveInvite.invitedByUserId,
        },
      });
      await db.tenantInvitation.update({
        where: { id: firstActiveInvite.id },
        data: {
          acceptedByUserId: userId,
        },
      });

      return {
        tenantId: invitedMembership.tenantId,
        tenantSlug: firstActiveInvite.tenant.slug,
        role: invitedMembership.role,
      };
    }
  }

  if (requestedTenant?.isOpen) {
    const openMembership = await db.tenantMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId: requestedTenant.id,
          userId,
        },
      },
      create: {
        tenantId: requestedTenant.id,
        userId,
        role: "MEMBER",
        status: "ACTIVE",
      },
      update: {
        status: "ACTIVE",
      },
      include: {
        tenant: true,
      },
    });

    return {
      tenantId: openMembership.tenantId,
      tenantSlug: openMembership.tenant.slug,
      role: openMembership.role,
    };
  }

  const fallbackMembership = await db.tenantMembership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      tenant: true,
    },
    orderBy: {
      joinedAt: "asc",
    },
  });

  if (!fallbackMembership) return null;

  return {
    tenantId: fallbackMembership.tenantId,
    tenantSlug: fallbackMembership.tenant.slug,
    role: fallbackMembership.role,
  };
}

async function resolveRequestedTenant(input: {
  tenantId?: string | null;
  tenantSlug?: string | null;
}): Promise<RequestedTenant | null> {
  const { tenantId, tenantSlug } = input;

  if (!tenantId && !tenantSlug) return null;

  const tenant = await db.tenant.findFirst({
    where: tenantId ? { id: tenantId } : { slug: tenantSlug ?? undefined },
    select: {
      id: true,
      slug: true,
    },
  });

  return tenant ?? null;
}

export async function createTRPCContext(opts?: CreateContextOptions) {
  const session = await getServerAuthSession();
  const headerTenantId = opts?.req?.headers.get("x-tenant-id");
  const headerTenantSlug = opts?.req?.headers.get("x-tenant-slug");
  const requestedTenant = await resolveRequestedTenant({
    tenantId: headerTenantId,
    tenantSlug: headerTenantSlug,
  });
  const tenantAccess =
    session?.user?.id
      ? await resolveTenantAccess({
          userId: session.user.id,
          isGlobalAdmin: Boolean(session.user.isGlobalAdmin),
          userEmail: session.user.email,
          tenantId: headerTenantId,
          tenantSlug: headerTenantSlug,
        })
      : null;

  return {
    db,
    session,
    tenantAccess,
    requestedTenant,
    requestHeaders: opts?.req?.headers,
    isGlobalAdmin: Boolean(session?.user?.isGlobalAdmin),
  };
}

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

const isGlobalAdmin = middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.isGlobalAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Global admin only." });
  }
  return next({
    ctx: {
      ...ctx,
      isGlobalAdmin: true,
    },
  });
});

const hasTenantAccess = middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.tenantAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tenant not selected or membership missing.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      tenantId: ctx.tenantAccess.tenantId,
      tenantSlug: ctx.tenantAccess.tenantSlug,
      tenantRole: ctx.tenantAccess.role,
    },
  });
});

const hasPublicTenantAccess = middleware(({ ctx, next }) => {
  const tenantId = ctx.tenantAccess?.tenantId ?? ctx.requestedTenant?.id;
  const tenantSlug = ctx.tenantAccess?.tenantSlug ?? ctx.requestedTenant?.slug;

  if (!tenantId || !tenantSlug) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tenant not selected.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      tenantId,
      tenantSlug,
      tenantRole: ctx.tenantAccess?.role ?? null,
    },
  });
});

const hasAdminRole = middleware(({ ctx, next }) => {
  if (!ctx.session?.user || !ctx.tenantAccess) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!["OWNER", "ADMIN", "INSTRUCTOR"].includes(ctx.tenantAccess.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Insufficient tenant role.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      tenantId: ctx.tenantAccess.tenantId,
      tenantSlug: ctx.tenantAccess.tenantSlug,
      tenantRole: ctx.tenantAccess.role,
    },
  });
});

export const tenantProcedure = protectedProcedure.use(hasTenantAccess);
export const publicTenantProcedure = publicProcedure.use(hasPublicTenantAccess);
export const tenantAdminProcedure = protectedProcedure.use(hasAdminRole);
export const globalAdminProcedure = protectedProcedure.use(isGlobalAdmin);
