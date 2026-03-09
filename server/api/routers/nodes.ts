import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const demoCourses = [
  { id: "1", title: "After Effects Starter", sigla: "AS" },
  { id: "2", title: "Design Thinking Lab", sigla: "DT" },
  { id: "3", title: "Game Tech Essentials", sigla: "GT" },
];

export const nodesRouter = createTRPCRouter({
  listCourses: publicProcedure
    .input(
      z
        .object({
          sigla: z.string().optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      if (!input?.sigla) return demoCourses;
      return demoCourses.filter((course) => course.sigla === input.sigla);
    }),

  listTenantShowcase: publicProcedure
    .input(
      z
        .object({
          tenantSlug: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.tenant.findMany({
        where: input?.tenantSlug ? { slug: input.tenantSlug } : undefined,
        select: {
          id: true,
          slug: true,
          name: true,
          settings: true,
          products: {
            select: {
              id: true,
              slug: true,
              name: true,
              type: true,
              status: true,
              isVisible: true,
              galleryOnly: true,
              _count: {
                select: {
                  features: true,
                  steps: true,
                  assets: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
    }),
});
