import { createTRPCRouter, tenantAdminProcedure } from "~/server/api/trpc";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export const statsRouter = createTRPCRouter({
  overview: tenantAdminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const since30Days = new Date(now.getTime() - 30 * DAY_IN_MS);
    const since14Days = new Date(now.getTime() - 13 * DAY_IN_MS);

    const [
      memberships,
      products,
      productAccesses,
      recentEvents,
      recentAssetInteractions,
      recentStepInteractions,
      recentProgress,
      recentVisitorSessions,
    ] = await Promise.all([
      ctx.db.tenantMembership.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          userId: true,
          role: true,
          status: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      ctx.db.product.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          id: true,
          name: true,
          status: true,
          type: true,
          createdAt: true,
          _count: {
            select: {
              steps: true,
              assets: true,
              userAccesses: true,
            },
          },
        },
      }),
      ctx.db.userProductAccess.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          userId: true,
          productId: true,
        },
      }),
      ctx.db.userInteractionEvent.findMany({
        where: {
          tenantId: ctx.tenantId,
          occurredAt: { gte: since30Days },
        },
        select: {
          occurredAt: true,
          eventType: true,
          productId: true,
          userId: true,
          visitorSessionId: true,
        },
      }),
      ctx.db.userAssetInteraction.findMany({
        where: {
          tenantId: ctx.tenantId,
          occurredAt: { gte: since30Days },
        },
        select: {
          occurredAt: true,
          action: true,
          downloaded: true,
          productId: true,
          userId: true,
          visitorSessionId: true,
        },
      }),
      ctx.db.userStepInteraction.findMany({
        where: {
          tenantId: ctx.tenantId,
          occurredAt: { gte: since30Days },
        },
        select: {
          occurredAt: true,
          action: true,
          productId: true,
          userId: true,
          visitorSessionId: true,
        },
      }),
      ctx.db.userProductProgress.findMany({
        where: {
          tenantId: ctx.tenantId,
          OR: [
            { lastAccessedAt: { gte: since30Days } },
            { completedAt: { gte: since30Days } },
          ],
        },
        select: {
          userId: true,
          productId: true,
          status: true,
          lastAccessedAt: true,
          completedAt: true,
        },
      }),
      ctx.db.visitorSession.findMany({
        where: {
          tenantId: ctx.tenantId,
          lastSeenAt: { gte: since30Days },
        },
        select: {
          id: true,
          userId: true,
          lastSeenAt: true,
        },
      }),
    ]);

    const productMap = new Map(
      products.map((product) => [
        product.id,
        {
          id: product.id,
          name: product.name,
          status: product.status,
          type: product.type,
          steps: product._count.steps,
          assets: product._count.assets,
          assignedUsers: product._count.userAccesses,
          interactions30d: 0,
          downloads30d: 0,
          completions30d: 0,
          registeredUsers: new Set<string>(),
          visitors: new Set<string>(),
          lastActivityAt: null as Date | null,
        },
      ]),
    );

    const memberMap = new Map(
      memberships.map((membership) => [
        membership.userId,
        {
          userId: membership.userId,
          name: membership.user.name,
          email: membership.user.email,
          role: membership.role,
          status: membership.status,
          grantedProducts: 0,
          interactions30d: 0,
          downloads30d: 0,
          completions30d: 0,
          lastActivityAt: null as Date | null,
        },
      ]),
    );

    for (const access of productAccesses) {
      const member = memberMap.get(access.userId);
      if (member) {
        member.grantedProducts += 1;
      }
    }

    const trackedUsers = new Set<string>();
    const trackedVisitors = new Set<string>();
    let downloads30d = 0;
    let completions30d = 0;
    let trackedActions30d = 0;
    let customEvents30d = 0;

    for (const event of recentEvents) {
      trackedActions30d += 1;
      customEvents30d += 1;

      if (event.userId) {
        trackedUsers.add(event.userId);
        const member = memberMap.get(event.userId);
        if (member) {
          member.interactions30d += 1;
          member.lastActivityAt =
            !member.lastActivityAt || event.occurredAt > member.lastActivityAt
              ? event.occurredAt
              : member.lastActivityAt;
        }
      }

      if (event.visitorSessionId) {
        trackedVisitors.add(event.visitorSessionId);
      }

      if (event.productId) {
        const product = productMap.get(event.productId);
        if (product) {
          product.interactions30d += 1;
          if (event.userId) product.registeredUsers.add(event.userId);
          if (event.visitorSessionId) product.visitors.add(event.visitorSessionId);
          product.lastActivityAt =
            !product.lastActivityAt || event.occurredAt > product.lastActivityAt
              ? event.occurredAt
              : product.lastActivityAt;
        }
      }
    }

    for (const interaction of recentAssetInteractions) {
      trackedActions30d += 1;

      if (interaction.userId) {
        trackedUsers.add(interaction.userId);
        const member = memberMap.get(interaction.userId);
        if (member) {
          member.interactions30d += 1;
          member.lastActivityAt =
            !member.lastActivityAt || interaction.occurredAt > member.lastActivityAt
              ? interaction.occurredAt
              : member.lastActivityAt;
        }
      }

      if (interaction.visitorSessionId) {
        trackedVisitors.add(interaction.visitorSessionId);
      }

      if (interaction.action === "DOWNLOADED" || interaction.downloaded) {
        downloads30d += 1;
        if (interaction.userId) {
          const member = memberMap.get(interaction.userId);
          if (member) {
            member.downloads30d += 1;
          }
        }
      }

      if (interaction.productId) {
        const product = productMap.get(interaction.productId);
        if (product) {
          product.interactions30d += 1;
          if (interaction.action === "DOWNLOADED" || interaction.downloaded) {
            product.downloads30d += 1;
          }
          if (interaction.userId) product.registeredUsers.add(interaction.userId);
          if (interaction.visitorSessionId) product.visitors.add(interaction.visitorSessionId);
          product.lastActivityAt =
            !product.lastActivityAt || interaction.occurredAt > product.lastActivityAt
              ? interaction.occurredAt
              : product.lastActivityAt;
        }
      }
    }

    for (const interaction of recentStepInteractions) {
      trackedActions30d += 1;

      if (interaction.userId) {
        trackedUsers.add(interaction.userId);
        const member = memberMap.get(interaction.userId);
        if (member) {
          member.interactions30d += 1;
          member.lastActivityAt =
            !member.lastActivityAt || interaction.occurredAt > member.lastActivityAt
              ? interaction.occurredAt
              : member.lastActivityAt;
        }
      }

      if (interaction.visitorSessionId) {
        trackedVisitors.add(interaction.visitorSessionId);
      }

      if (interaction.action === "COMPLETED") {
        completions30d += 1;
        if (interaction.userId) {
          const member = memberMap.get(interaction.userId);
          if (member) {
            member.completions30d += 1;
          }
        }
      }

      if (interaction.productId) {
        const product = productMap.get(interaction.productId);
        if (product) {
          product.interactions30d += 1;
          if (interaction.action === "COMPLETED") {
            product.completions30d += 1;
          }
          if (interaction.userId) product.registeredUsers.add(interaction.userId);
          if (interaction.visitorSessionId) product.visitors.add(interaction.visitorSessionId);
          product.lastActivityAt =
            !product.lastActivityAt || interaction.occurredAt > product.lastActivityAt
              ? interaction.occurredAt
              : product.lastActivityAt;
        }
      }
    }

    for (const progress of recentProgress) {
      if (progress.userId) {
        trackedUsers.add(progress.userId);
        const member = memberMap.get(progress.userId);
        const lastActivity = progress.completedAt ?? progress.lastAccessedAt;
        if (member && lastActivity) {
          member.lastActivityAt =
            !member.lastActivityAt || lastActivity > member.lastActivityAt
              ? lastActivity
              : member.lastActivityAt;
        }
      }

      if (progress.productId) {
        const product = productMap.get(progress.productId);
        const lastActivity = progress.completedAt ?? progress.lastAccessedAt;
        if (product && lastActivity) {
          product.lastActivityAt =
            !product.lastActivityAt || lastActivity > product.lastActivityAt
              ? lastActivity
              : product.lastActivityAt;
        }
      }
    }

    for (const session of recentVisitorSessions) {
      trackedVisitors.add(session.id);
    }

    const timeline = new Map<string, {
      date: string;
      label: string;
      trackedActions: number;
      registeredUsers: Set<string>;
      visitors: Set<string>;
    }>();

    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date(now.getTime() - offset * DAY_IN_MS);
      const key = dayKey(date);
      timeline.set(key, {
        date: key,
        label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        trackedActions: 0,
        registeredUsers: new Set<string>(),
        visitors: new Set<string>(),
      });
    }

    const timelineRecords = [
      ...recentEvents.map((event) => ({
        occurredAt: event.occurredAt,
        userId: event.userId,
        visitorSessionId: event.visitorSessionId,
      })),
      ...recentAssetInteractions.map((interaction) => ({
        occurredAt: interaction.occurredAt,
        userId: interaction.userId,
        visitorSessionId: interaction.visitorSessionId,
      })),
      ...recentStepInteractions.map((interaction) => ({
        occurredAt: interaction.occurredAt,
        userId: interaction.userId,
        visitorSessionId: interaction.visitorSessionId,
      })),
    ];

    for (const record of timelineRecords) {
      if (record.occurredAt < since14Days) continue;
      const entry = timeline.get(dayKey(record.occurredAt));
      if (!entry) continue;
      entry.trackedActions += 1;
      if (record.userId) entry.registeredUsers.add(record.userId);
      if (record.visitorSessionId) entry.visitors.add(record.visitorSessionId);
    }

    return {
      summary: {
        activeMembers: memberships.filter((membership) => membership.status === "ACTIVE").length,
        publishedProducts: products.filter((product) => product.status === "PUBLISHED").length,
        trackedUsers30d: trackedUsers.size,
        visitorSessions30d: trackedVisitors.size,
        trackedActions30d,
        downloads30d,
        completions30d,
        customEvents30d,
      },
      timeline: Array.from(timeline.values()).map((entry) => ({
        date: entry.date,
        label: entry.label,
        trackedActions: entry.trackedActions,
        registeredUsers: entry.registeredUsers.size,
        visitors: entry.visitors.size,
      })),
      products: Array.from(productMap.values())
        .map((product) => ({
          ...product,
          registeredUsers30d: product.registeredUsers.size,
          visitorSessions30d: product.visitors.size,
        }))
        .sort((left, right) => {
          if (right.interactions30d !== left.interactions30d) {
            return right.interactions30d - left.interactions30d;
          }
          return left.name.localeCompare(right.name);
        }),
      members: Array.from(memberMap.values()).sort((left, right) => {
        if (right.interactions30d !== left.interactions30d) {
          return right.interactions30d - left.interactions30d;
        }
        return (left.name ?? left.email ?? left.userId).localeCompare(
          right.name ?? right.email ?? right.userId,
        );
      }),
    };
  }),
});
