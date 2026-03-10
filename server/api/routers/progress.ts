import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  publicTenantProcedure,
  tenantProcedure,
} from "~/server/api/trpc";
import { resolveVisitorSession } from "~/server/api/visitor-sessions";

type StepQuestionnaireOption = {
  id: string;
  label: string;
};

type StepQuestionnaire = {
  prompt: string;
  options: StepQuestionnaireOption[];
  correctOptionId?: string;
  successMessage?: string;
};

type StepMetadata = {
  questionnaire?: StepQuestionnaire;
};

async function ensureStepBelongsToProduct(input: {
  db: typeof import("~/server/db").db;
  tenantId: string;
  productId: string;
  stepId: string;
}) {
  const step = await input.db.productStep.findFirst({
    where: {
      id: input.stepId,
      tenantId: input.tenantId,
      productId: input.productId,
    },
  });

  if (!step) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Step not found." });
  }

  return step;
}

function readStepMetadata(metadata: unknown): StepMetadata {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const candidate = metadata as Record<string, unknown>;
  const rawQuestionnaire =
    candidate.questionnaire && typeof candidate.questionnaire === "object"
      ? (candidate.questionnaire as Record<string, unknown>)
      : null;
  const rawOptions = Array.isArray(rawQuestionnaire?.options)
    ? rawQuestionnaire.options
    : [];
  const options = rawOptions
    .filter(
      (option): option is Record<string, unknown> =>
        Boolean(option) && typeof option === "object",
    )
    .map((option, index) => ({
      id:
        typeof option.id === "string" && option.id.trim()
          ? option.id.trim()
          : `option-${index + 1}`,
      label: typeof option.label === "string" ? option.label.trim() : "",
    }))
    .filter((option) => option.label.length > 0);

  if (
    !rawQuestionnaire ||
    typeof rawQuestionnaire.prompt !== "string" ||
    !rawQuestionnaire.prompt.trim() ||
    options.length < 2
  ) {
    return {};
  }

  return {
    questionnaire: {
      prompt: rawQuestionnaire.prompt.trim(),
      options,
      correctOptionId:
        typeof rawQuestionnaire.correctOptionId === "string"
          ? rawQuestionnaire.correctOptionId
          : undefined,
      successMessage:
        typeof rawQuestionnaire.successMessage === "string" &&
        rawQuestionnaire.successMessage.trim()
          ? rawQuestionnaire.successMessage.trim()
          : undefined,
    },
  };
}

async function ensureStepUnlocked(input: {
  db: typeof import("~/server/db").db;
  tenantId: string;
  userId: string;
  productId: string;
  stepId: string;
}) {
  const product = await input.db.product.findFirst({
    where: {
      id: input.productId,
      tenantId: input.tenantId,
    },
    include: {
      steps: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!product) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
  }

  const currentIndex = product.steps.findIndex((step) => step.id === input.stepId);
  if (currentIndex < 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Step not found." });
  }

  const currentStep = product.steps[currentIndex];
  const requiresPreviousCompletion =
    (product.lockSequentialSteps && currentIndex > 0) ||
    Boolean(currentStep?.lockUntilComplete);

  if (!requiresPreviousCompletion) {
    return currentStep;
  }

  const previousRequiredSteps = product.steps
    .slice(0, currentIndex)
    .filter((step) => step.isRequired);

  if (!previousRequiredSteps.length) {
    return currentStep;
  }

  const completedProgress = await input.db.userProductProgress.findMany({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      productId: input.productId,
      stepId: {
        in: previousRequiredSteps.map((step) => step.id),
      },
      status: "COMPLETED",
    },
    select: {
      stepId: true,
    },
  });

  const completedStepIds = new Set(completedProgress.map((entry) => entry.stepId));
  const blockingStep = previousRequiredSteps.find(
    (step) => !completedStepIds.has(step.id),
  );

  if (blockingStep) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Complete "${blockingStep.title}" before this step.`,
    });
  }

  return currentStep;
}

export const progressRouter = createTRPCRouter({
  markStepProgress: tenantProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        stepId: z.string().cuid(),
        watchPercent: z.number().min(0).max(100).optional(),
        completed: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureStepBelongsToProduct({
        db: ctx.db,
        tenantId: ctx.tenantId,
        productId: input.productId,
        stepId: input.stepId,
      });

      const status = input.completed
        ? "COMPLETED"
        : input.watchPercent && input.watchPercent > 0
          ? "IN_PROGRESS"
          : "NOT_STARTED";
      const action = input.completed
        ? "COMPLETED"
        : input.watchPercent && input.watchPercent > 0
          ? "PROGRESSED"
          : "OPENED";

      return ctx.db.$transaction(async (tx) => {
        const progress = await tx.userProductProgress.upsert({
          where: {
            tenantId_userId_stepId: {
              tenantId: ctx.tenantId,
              userId: ctx.session!.user.id,
              stepId: input.stepId,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            userId: ctx.session!.user.id,
            productId: input.productId,
            stepId: input.stepId,
            firstAccessedAt: new Date(),
            lastAccessedAt: new Date(),
            completedAt: input.completed ? new Date() : null,
            status,
            watchPercent: input.watchPercent ?? 0,
          },
          update: {
            lastAccessedAt: new Date(),
            completedAt: input.completed ? new Date() : undefined,
            status,
            watchPercent: input.watchPercent ?? undefined,
          },
        });

        await tx.userStepInteraction.create({
          data: {
            tenantId: ctx.tenantId,
            userId: ctx.session!.user.id,
            productId: input.productId,
            stepId: input.stepId,
            action,
            progressPercent: input.watchPercent,
          },
        });

        return progress;
      });
    }),

  trackStepInteraction: publicTenantProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        stepId: z.string().cuid(),
        action: z.enum(["OPENED", "PROGRESSED", "COMPLETED", "DOWNLOADED"]),
        progressPercent: z.number().min(0).max(100).optional(),
        visitorToken: z.string().min(8).max(191).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureStepBelongsToProduct({
        db: ctx.db,
        tenantId: ctx.tenantId,
        productId: input.productId,
        stepId: input.stepId,
      });

      const visitorSession = await resolveVisitorSession({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: ctx.session?.user?.id,
        visitorToken: input.visitorToken,
        userAgent: ctx.requestHeaders?.get("user-agent"),
        createIfMissing: !ctx.session?.user,
      });

      const interaction = await ctx.db.userStepInteraction.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.session?.user?.id,
          visitorSessionId: visitorSession?.id,
          productId: input.productId,
          stepId: input.stepId,
          action: input.action,
          progressPercent: input.progressPercent,
          metadata: input.metadata,
        },
      });

      return {
        interaction,
        visitorToken: visitorSession?.token ?? input.visitorToken ?? null,
      };
    }),

  trackAssetInteraction: publicTenantProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        assetId: z.string().cuid(),
        stepId: z.string().cuid().optional(),
        action: z.enum(["VIEWED", "WATCHED", "DOWNLOADED", "OPENED", "CLICKED"]),
        watchedSeconds: z.number().int().min(0).optional(),
        downloaded: z.boolean().optional(),
        visitorToken: z.string().min(8).max(191).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.db.productAsset.findFirst({
        where: {
          id: input.assetId,
          tenantId: ctx.tenantId,
          productId: input.productId,
        },
      });

      if (!asset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });
      }

      if (input.stepId) {
        await ensureStepBelongsToProduct({
          db: ctx.db,
          tenantId: ctx.tenantId,
          productId: input.productId,
          stepId: input.stepId,
        });
      }

      const visitorSession = await resolveVisitorSession({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: ctx.session?.user?.id,
        visitorToken: input.visitorToken,
        userAgent: ctx.requestHeaders?.get("user-agent"),
        createIfMissing: !ctx.session?.user,
      });

      const interaction = await ctx.db.userAssetInteraction.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.session?.user?.id,
          visitorSessionId: visitorSession?.id,
          productId: input.productId,
          assetId: input.assetId,
          stepId: input.stepId,
          action: input.action,
          watchedSeconds: input.watchedSeconds,
          downloaded:
            input.downloaded ?? (input.action === "DOWNLOADED" || asset.isDownloadable),
          metadata: input.metadata,
        },
      });

      return {
        interaction,
        visitorToken: visitorSession?.token ?? input.visitorToken ?? null,
      };
    }),

  markAssetDownloaded: publicTenantProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        assetId: z.string().cuid(),
        stepId: z.string().cuid().optional(),
        visitorToken: z.string().min(8).max(191).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.db.productAsset.findFirst({
        where: {
          id: input.assetId,
          tenantId: ctx.tenantId,
          productId: input.productId,
        },
      });

      if (!asset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found." });
      }

      const visitorSession = await resolveVisitorSession({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: ctx.session?.user?.id,
        visitorToken: input.visitorToken,
        userAgent: ctx.requestHeaders?.get("user-agent"),
        createIfMissing: !ctx.session?.user,
      });

      const interaction = await ctx.db.userAssetInteraction.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.session?.user?.id,
          visitorSessionId: visitorSession?.id,
          productId: input.productId,
          assetId: input.assetId,
          stepId: input.stepId,
          action: "DOWNLOADED",
          downloaded: true,
        },
      });

      return {
        interaction,
        visitorToken: visitorSession?.token ?? input.visitorToken ?? null,
      };
    }),

  myProductProgress: tenantProcedure
    .input(z.object({ productId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const [steps, progress] = await Promise.all([
        ctx.db.productStep.findMany({
          where: { tenantId: ctx.tenantId, productId: input.productId },
          orderBy: { sortOrder: "asc" },
        }),
        ctx.db.userProductProgress.findMany({
          where: {
            tenantId: ctx.tenantId,
            userId: ctx.session!.user.id,
            productId: input.productId,
          },
        }),
      ]);

      const completedStepIds = new Set(
        progress.filter((item) => item.status === "COMPLETED").map((item) => item.stepId),
      );
      const nextStep = steps.find((step) => !completedStepIds.has(step.id)) ?? null;

      return {
        steps,
        progress,
        nextStep,
      };
    }),

  completeStep: tenantProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        stepId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureStepUnlocked({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: ctx.session!.user.id,
        productId: input.productId,
        stepId: input.stepId,
      });

      return ctx.db.$transaction(async (tx) => {
        const existing = await tx.userProductProgress.findUnique({
          where: {
            tenantId_userId_stepId: {
              tenantId: ctx.tenantId,
              userId: ctx.session!.user.id,
              stepId: input.stepId,
            },
          },
        });

        const progress = await tx.userProductProgress.upsert({
          where: {
            tenantId_userId_stepId: {
              tenantId: ctx.tenantId,
              userId: ctx.session!.user.id,
              stepId: input.stepId,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            userId: ctx.session!.user.id,
            productId: input.productId,
            stepId: input.stepId,
            firstAccessedAt: new Date(),
            lastAccessedAt: new Date(),
            completedAt: new Date(),
            status: "COMPLETED",
            watchPercent: 100,
          },
          update: {
            lastAccessedAt: new Date(),
            completedAt: new Date(),
            status: "COMPLETED",
            watchPercent: 100,
          },
        });

        await tx.userStepInteraction.create({
          data: {
            tenantId: ctx.tenantId,
            userId: ctx.session!.user.id,
            productId: input.productId,
            stepId: input.stepId,
            action: "COMPLETED",
            progressPercent: 100,
          },
        });

        return {
          progress,
          wasAlreadyCompleted: existing?.status === "COMPLETED",
        };
      });
    }),

  submitStepQuestionnaire: tenantProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        stepId: z.string().cuid(),
        answerId: z.string().min(1).max(191),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const step = await ensureStepUnlocked({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: ctx.session!.user.id,
        productId: input.productId,
        stepId: input.stepId,
      });

      const metadata = readStepMetadata(step.metadata);
      const questionnaire = metadata.questionnaire;

      if (!questionnaire) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This step does not have a questionnaire.",
        });
      }

      const selectedOption = questionnaire.options.find(
        (option) => option.id === input.answerId,
      );

      if (!selectedOption) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected answer is not valid for this questionnaire.",
        });
      }

      const isCorrect =
        questionnaire.correctOptionId == null ||
        questionnaire.correctOptionId === input.answerId;

      return ctx.db.$transaction(async (tx) => {
        const existing = await tx.userProductProgress.findUnique({
          where: {
            tenantId_userId_stepId: {
              tenantId: ctx.tenantId,
              userId: ctx.session!.user.id,
              stepId: input.stepId,
            },
          },
        });

        const nextMetadata = {
          ...(existing?.metadata && typeof existing.metadata === "object"
            ? (existing.metadata as Record<string, unknown>)
            : {}),
          questionnaire: {
            answerId: input.answerId,
            answeredAt: new Date().toISOString(),
            passed: isCorrect,
          },
        };

        const progress = await tx.userProductProgress.upsert({
          where: {
            tenantId_userId_stepId: {
              tenantId: ctx.tenantId,
              userId: ctx.session!.user.id,
              stepId: input.stepId,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            userId: ctx.session!.user.id,
            productId: input.productId,
            stepId: input.stepId,
            firstAccessedAt: new Date(),
            lastAccessedAt: new Date(),
            completedAt: isCorrect ? new Date() : null,
            status: isCorrect ? "COMPLETED" : "IN_PROGRESS",
            watchPercent: isCorrect ? 100 : existing?.watchPercent ?? 0,
            metadata: nextMetadata,
          },
          update: {
            lastAccessedAt: new Date(),
            completedAt: isCorrect ? new Date() : null,
            status: isCorrect ? "COMPLETED" : "IN_PROGRESS",
            watchPercent: isCorrect ? 100 : undefined,
            metadata: nextMetadata,
          },
        });

        await tx.userStepInteraction.create({
          data: {
            tenantId: ctx.tenantId,
            userId: ctx.session!.user.id,
            productId: input.productId,
            stepId: input.stepId,
            action: isCorrect ? "COMPLETED" : "PROGRESSED",
            progressPercent: isCorrect ? 100 : existing?.watchPercent ?? 0,
            metadata: {
              questionnaire: {
                answerId: input.answerId,
                passed: isCorrect,
              },
            },
          },
        });

        return {
          correct: isCorrect,
          successMessage:
            isCorrect
              ? questionnaire.successMessage ?? "Step completed."
              : "Try again before unlocking the next step.",
          progress,
        };
      });
    }),
});
