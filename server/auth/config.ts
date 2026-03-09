import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { z } from "zod";

import { db } from "~/server/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "database",
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
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Clean skeleton: accept any valid credentials and upsert a local user.
        const { email } = parsed.data;
        const user = await db.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0] ?? "User" },
        });
        return user;
      },
    }),
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
