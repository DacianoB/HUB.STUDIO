import { randomUUID } from "crypto";

import { db } from "~/server/db";

export const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function buildSessionExpiresAt() {
  return new Date(Date.now() + AUTH_SESSION_MAX_AGE_SECONDS * 1000);
}

function shouldUseSecureCookies(requestUrl: string) {
  if (process.env.NEXTAUTH_URL?.startsWith("https://")) {
    return true;
  }

  return new URL(requestUrl).protocol === "https:";
}

export function getSessionCookieDefinition(requestUrl: string) {
  const secure = shouldUseSecureCookies(requestUrl);
  const prefix = secure ? "__Secure-" : "";

  return {
    name: `${prefix}next-auth.session-token`,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure,
    },
  };
}

async function resolveInitialActiveTenantId(userId: string) {
  const previousSession = await db.session.findFirst({
    where: {
      userId,
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

  if (previousSession?.activeTenantId) {
    return previousSession.activeTenantId;
  }

  const membership = await db.tenantMembership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    orderBy: {
      joinedAt: "asc",
    },
    select: {
      tenantId: true,
    },
  });

  return membership?.tenantId ?? null;
}

export async function createLocalDatabaseSession(userId: string) {
  const sessionToken = randomUUID();
  const expires = buildSessionExpiresAt();
  const activeTenantId = await resolveInitialActiveTenantId(userId);

  await db.session.create({
    data: {
      sessionToken,
      userId,
      activeTenantId,
      expires,
    },
  });

  return {
    sessionToken,
    expires,
  };
}
