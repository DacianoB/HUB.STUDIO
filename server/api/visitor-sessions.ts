import { randomUUID } from "crypto";

import type { PrismaClient, Prisma } from "@prisma/client";

type VisitorSessionRecord = Prisma.VisitorSessionGetPayload<Record<string, never>>;

export async function resolveVisitorSession(options: {
  db: PrismaClient;
  tenantId: string;
  userId?: string | null;
  visitorToken?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
  createIfMissing?: boolean;
}): Promise<VisitorSessionRecord | null> {
  const {
    db,
    tenantId,
    userId,
    visitorToken,
    userAgent,
    metadata,
    createIfMissing = false,
  } = options;

  const normalizedToken = visitorToken?.trim() || (createIfMissing ? randomUUID() : null);
  if (!normalizedToken) return null;

  const existing = await db.visitorSession.findFirst({
    where: {
      tenantId,
      token: normalizedToken,
    },
  });

  if (existing) {
    return db.visitorSession.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        userId: userId ?? existing.userId ?? undefined,
        userAgent: userAgent ?? existing.userAgent ?? undefined,
        metadata: metadata ?? undefined,
      },
    });
  }

  return db.visitorSession.create({
    data: {
      tenantId,
      userId: userId ?? undefined,
      token: normalizedToken,
      userAgent: userAgent ?? undefined,
      metadata: metadata ?? undefined,
      lastSeenAt: new Date(),
    },
  });
}
