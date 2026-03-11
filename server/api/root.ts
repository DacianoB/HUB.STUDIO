import { createTRPCRouter } from "~/server/api/trpc";
import { healthRouter } from "~/server/api/routers/health";
import { interactionsRouter } from "~/server/api/routers/interactions";
import { nodePagesRouter } from "~/server/api/routers/node-pages";
import { nodesRouter } from "~/server/api/routers/nodes";
import { productFeaturesRouter } from "~/server/api/routers/product-features";
import { productsRouter } from "~/server/api/routers/products";
import { productStepsRouter } from "~/server/api/routers/product-steps";
import { progressRouter } from "~/server/api/routers/progress";
import { statsRouter } from "~/server/api/routers/stats";
import { tenantsRouter } from "~/server/api/routers/tenants";
import { uploadsRouter } from "~/server/api/routers/uploads";
import { usersRouter } from "~/server/api/routers/users";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  nodes: nodesRouter,
  tenants: tenantsRouter,
  products: productsRouter,
  productFeatures: productFeaturesRouter,
  productSteps: productStepsRouter,
  progress: progressRouter,
  stats: statsRouter,
  interactions: interactionsRouter,
  nodePages: nodePagesRouter,
  users: usersRouter,
  uploads: uploadsRouter,
});

export type AppRouter = typeof appRouter;
