import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

import { db } from "~/server/db";
import { AUTH_SESSION_MAX_AGE_SECONDS } from "~/server/auth/local-session";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "database",
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    session: async ({ session, user }) => {
      const dbUser = (await db.user.findUnique({
        where: { id: user.id },
      })) as (typeof user & { isGlobalAdmin?: boolean }) | null;

      const persistedSession = await db.session.findFirst({
        where: {
          userId: user.id,
          activeTenantId: {
            not: null,
          },
        },
        orderBy: {
          expires: "desc",
        },
        select: {
          activeTenantId: true,
        },
      });

      let activeMembership = persistedSession?.activeTenantId
        ? await db.tenantMembership.findUnique({
            where: {
              tenantId_userId: {
                tenantId: persistedSession.activeTenantId,
                userId: user.id,
              },
            },
            include: {
              tenant: true,
            },
          })
        : null;

      if (!activeMembership || activeMembership.status !== "ACTIVE") {
        activeMembership = await db.tenantMembership.findFirst({
            where: {
              userId: user.id,
              status: "ACTIVE",
            },
            include: {
              tenant: true,
            },
            orderBy: {
              joinedAt: "asc",
            },
          });
      }

      const activeTenant =
        persistedSession?.activeTenantId && dbUser?.isGlobalAdmin
          ? await db.tenant.findUnique({
              where: { id: persistedSession.activeTenantId },
              select: { id: true, slug: true, name: true, isOpen: true },
            })
          : activeMembership?.tenant ?? null;

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          isGlobalAdmin: dbUser?.isGlobalAdmin ?? false,
          activeTenantId: activeTenant?.id ?? activeMembership?.tenantId ?? null,
          tenantRole:
            activeMembership?.role ??
            (dbUser?.isGlobalAdmin && activeTenant ? "OWNER" : null),
        },
        activeTenant: activeTenant
          ? {
              id: activeTenant.id,
              slug: activeTenant.slug,
              name: activeTenant.name,
              isOpen: activeTenant.isOpen,
            }
          : null,
      };
    },
  },
};
