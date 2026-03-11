import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  publicTenantProcedure,
  tenantAdminProcedure,
  tenantProcedure,
} from "~/server/api/trpc";
import { resolveVisitorSession } from "~/server/api/visitor-sessions";
import {
  assertProductCapacity,
  assertProductPolicyCompliance,
  ensureTenantPolicy,
  tenantPolicySelect,
} from "~/server/tenant-policy";

const moduleTypeSchema = z.enum(["LIBRARY", "COURSE"]);

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
  coverImageUrl?: string;
  content?: string;
  questionnaire?: StepQuestionnaire;
};

type ModuleSettingsRecord = Prisma.InputJsonObject;

function readSourceLibraryAssetId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return undefined;
  const candidate = metadata as Record<string, unknown>;
  return typeof candidate.sourceLibraryAssetId === "string"
    ? candidate.sourceLibraryAssetId
    : undefined;
}

const moduleConfigSchema = z.object({
  moduleType: moduleTypeSchema,
  isEnabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  settings: z.record(z.string(), z.any()).optional(),
});

const productInputSchema = z.object({
  title: z.string().min(2).max(180),
  subtitle: z.string().max(180).optional(),
  description: z.string().max(4000).optional(),
  slug: z.string().max(180).optional(),
  type: z.enum(["COURSE", "PHYSICAL_PRODUCT", "DIGITAL_PRODUCT", "SERVICE", "CUSTOM"]),
  isVisible: z.boolean().default(true),
  isFree: z.boolean().default(true),
  priceCents: z.number().int().min(0).optional().nullable(),
  currency: z.string().min(3).max(8).default("USD"),
  galleryOnly: z.boolean().default(false),
  lockSequentialSteps: z.boolean().default(false),
  metadata: z.record(z.string(), z.any()).optional(),
  modules: z.array(moduleConfigSchema).default([]),
});

const defaultModuleCatalog = [
  {
    moduleType: "LIBRARY" as const,
    label: "Library module",
    description: "Reusable listing for images, videos, PDFs, files, and link cards.",
    defaultSettings: {
      allowedAssetTypes: ["VIDEO", "PDF", "IMAGE", "LINK", "FILE"],
      allowDownloads: true,
      allowExternalLinks: true,
      systemTags: [],
    },
  },
  {
    moduleType: "COURSE" as const,
    label: "Course module",
    description: "Step progression with mixed content assets per lesson.",
    defaultSettings: {
      lockSequentialSteps: true,
      requiredAssetTypesByStep: ["VIDEO", "PDF", "FILE"],
      includeTextContent: true,
    },
  },
];

function normalizeModuleSettings(settings: unknown): ModuleSettingsRecord {
  if (!settings || typeof settings !== "object") {
    return {};
  }
  return { ...(settings as ModuleSettingsRecord) };
}

function normalizeSystemTag(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = value.replace(/^#tag\s*/i, "").trim().toLowerCase();
  if (!normalized) return null;
  return `#tag ${normalized}`;
}

function readLibrarySystemTags(settings: unknown) {
  const raw = normalizeModuleSettings(settings).systemTags;
  if (!Array.isArray(raw)) return [] as string[];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of raw) {
    const normalized = normalizeSystemTag(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(normalized);
  }

  return tags;
}

function normalizeTenantModuleSettings(
  moduleType: "LIBRARY" | "COURSE",
  settings: unknown,
) {
  const normalized = normalizeModuleSettings(settings);

  if (moduleType === "LIBRARY") {
    return {
      ...normalized,
      systemTags: readLibrarySystemTags(normalized),
    };
  }

  return normalized;
}

function isLibraryAsset(asset: {
  stepId?: string | null;
  moduleType?: string | null;
  placement?: string | null;
}) {
  if (asset.stepId) return false;
  if (asset.moduleType === "COURSE") return false;
  if (asset.placement === "STEP") return false;
  return true;
}

function attachLibrarySystemTags<
  T extends {
    stepId?: string | null;
    moduleType?: string | null;
    placement?: string | null;
  },
>(asset: T, systemTags: string[]) {
  return {
    ...asset,
    systemTags: isLibraryAsset(asset) ? systemTags : [],
  };
}

async function readTenantLibrarySystemTags(
  db: {
    tenantModuleCapability: {
      findUnique: (args: {
        where: {
          tenantId_moduleType: {
            tenantId: string;
            moduleType: "LIBRARY";
          };
        };
        select: { settings: true };
      }) => Promise<{ settings: unknown } | null>;
    };
  },
  tenantId: string,
) {
  const capability = await db.tenantModuleCapability.findUnique({
    where: {
      tenantId_moduleType: {
        tenantId,
        moduleType: "LIBRARY",
      },
    },
    select: {
      settings: true,
    },
  });

  const mergedSettings = {
    ...normalizeModuleSettings(defaultModuleCatalog[0].defaultSettings),
    ...normalizeTenantModuleSettings("LIBRARY", capability?.settings),
  };

  return readLibrarySystemTags(mergedSettings);
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
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

  const questionnaire =
    rawQuestionnaire &&
    typeof rawQuestionnaire.prompt === "string" &&
    rawQuestionnaire.prompt.trim() &&
    options.length >= 2
      ? {
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
        }
      : undefined;

  return {
    coverImageUrl:
      typeof candidate.coverImageUrl === "string"
        ? candidate.coverImageUrl
        : undefined,
    content: typeof candidate.content === "string" ? candidate.content : undefined,
    questionnaire,
  };
}

async function readTenantEnabledModules(
  db: {
    tenantModuleCapability: {
      findMany: (args: { where: { tenantId: string } }) => Promise<
        Array<{ moduleType: "LIBRARY" | "COURSE"; isEnabled: boolean }>
      >;
    };
  },
  tenantId: string,
) {
  const tenantModules = await db.tenantModuleCapability.findMany({
    where: { tenantId },
  });
  if (!tenantModules.length) {
    return new Set(defaultModuleCatalog.map((entry) => entry.moduleType));
  }
  return new Set(
    tenantModules
      .filter((entry: { isEnabled: boolean }) => entry.isEnabled)
      .map((entry: { moduleType: "LIBRARY" | "COURSE" }) => entry.moduleType),
  );
}

function assertRequestedModulesAreEnabledByTenant(
  enabledByTenant: Set<"LIBRARY" | "COURSE">,
  modules: Array<{ moduleType: "LIBRARY" | "COURSE"; isEnabled: boolean }>,
) {
  const blockedModule = modules.find(
    (module) => module.isEnabled && !enabledByTenant.has(module.moduleType),
  );

  if (blockedModule) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${blockedModule.moduleType} is disabled for this tenant.`,
    });
  }
}

async function createDemoCourseContent(
  db: {
    productStep: {
      create: (args: {
        data: {
          tenantId: string;
          productId: string;
          title: string;
          description: string;
          sortOrder: number;
          lockUntilComplete: boolean;
          isRequired: boolean;
        };
      }) => Promise<{ id: string }>;
    };
    productAsset: {
      createMany: (args: {
        data: Array<{
          tenantId: string;
          productId: string;
          stepId: string;
          moduleType: "COURSE";
          placement: "STEP";
          interactionMode: "OPEN" | "DOWNLOAD";
          title: string;
          type: "VIDEO" | "PDF" | "FILE";
          url: string;
          durationSeconds?: number;
          isDownloadable?: boolean;
          sortOrder: number;
        }>;
      }) => Promise<unknown>;
    };
  },
  tenantId: string,
  productId: string,
  lockSequentialSteps: boolean,
) {
  const blueprint = [
    { title: "Welcome and Setup", description: "Intro lesson with setup checklist." },
    { title: "Core Lesson", description: "Main lesson with guided examples." },
    { title: "Project Delivery", description: "Final lesson and downloadable materials." },
  ];

  for (let i = 0; i < blueprint.length; i += 1) {
    const entry = blueprint[i];
    const step = await db.productStep.create({
      data: {
        tenantId,
        productId,
        title: entry.title,
        description: `${entry.description}\n\nText lesson notes are available in this step.`,
        sortOrder: i + 1,
        lockUntilComplete: lockSequentialSteps && i > 0,
        isRequired: true,
      },
    });

    await db.productAsset.createMany({
      data: [
        {
          tenantId,
          productId,
          stepId: step.id,
          moduleType: "COURSE",
          placement: "STEP",
          interactionMode: "OPEN",
          title: `${entry.title} video`,
          type: "VIDEO",
          url: `https://dummy-upload.hub.studio/videos/${productId}-${i + 1}.mp4`,
          durationSeconds: 420 + i * 120,
          sortOrder: 1,
        },
        {
          tenantId,
          productId,
          stepId: step.id,
          moduleType: "COURSE",
          placement: "STEP",
          interactionMode: "DOWNLOAD",
          title: `${entry.title} PDF`,
          type: "PDF",
          url: `https://dummy-upload.hub.studio/pdfs/${productId}-${i + 1}.pdf`,
          isDownloadable: true,
          sortOrder: 2,
        },
        {
          tenantId,
          productId,
          stepId: step.id,
          moduleType: "COURSE",
          placement: "STEP",
          interactionMode: "DOWNLOAD",
          title: `${entry.title} material`,
          type: "FILE",
          url: `https://dummy-upload.hub.studio/materials/${productId}-${i + 1}.zip`,
          isDownloadable: true,
          sortOrder: 3,
        },
      ],
    });
  }
}

export const productsRouter = createTRPCRouter({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db.product.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        moduleConfigs: {
          orderBy: { sortOrder: "asc" },
        },
        _count: {
          select: { features: true, steps: true, assets: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  byId: tenantProcedure
    .input(z.object({ productId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const [product, librarySystemTags] = await Promise.all([
        ctx.db.product.findFirst({
          where: { id: input.productId, tenantId: ctx.tenantId },
          include: {
            moduleConfigs: {
              orderBy: { sortOrder: "asc" },
            },
            features: { orderBy: { sortOrder: "asc" } },
            steps: { orderBy: { sortOrder: "asc" } },
            assets: { orderBy: { sortOrder: "asc" } },
          },
        }),
        readTenantLibrarySystemTags(ctx.db, ctx.tenantId),
      ]);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      }
      return {
        ...product,
        assets: product.assets.map((asset) => attachLibrarySystemTags(asset, librarySystemTags)),
      };
    }),

  libraryAssetsByProductId: publicTenantProcedure
    .input(z.object({ productId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const [product, librarySystemTags] = await Promise.all([
        ctx.db.product.findFirst({
          where: { id: input.productId, tenantId: ctx.tenantId },
          select: {
            id: true,
            assets: {
              orderBy: { sortOrder: "asc" },
            },
          },
        }),
        readTenantLibrarySystemTags(ctx.db, ctx.tenantId),
      ]);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      }

      return product.assets
        .filter((asset) => isLibraryAsset(asset))
        .map((asset) => attachLibrarySystemTags(asset, librarySystemTags));
    }),

  libraryAssetById: publicTenantProcedure
    .input(
      z.object({
        assetId: z.string().cuid(),
        visitorToken: z.string().min(8).max(191).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [asset, librarySystemTags] = await Promise.all([
        ctx.db.productAsset.findFirst({
          where: {
            id: input.assetId,
            tenantId: ctx.tenantId,
            stepId: null,
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        }),
        readTenantLibrarySystemTags(ctx.db, ctx.tenantId),
      ]);
      if (!asset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Library asset not found." });
      }

      const likeEvents = await ctx.db.userInteractionEvent.findMany({
        where: {
          tenantId: ctx.tenantId,
          assetId: input.assetId,
          eventType: {
            in: ["ASSET_LIKED", "ASSET_UNLIKED"],
          },
        },
        orderBy: {
          occurredAt: "desc",
        },
        select: {
          eventType: true,
          userId: true,
          visitorSessionId: true,
          occurredAt: true,
        },
      });

      const identityLikeState = new Map<string, boolean>();
      for (const event of likeEvents) {
        const identityKey = event.userId
          ? `user:${event.userId}`
          : event.visitorSessionId
            ? `visitor:${event.visitorSessionId}`
            : null;
        if (!identityKey || identityLikeState.has(identityKey)) continue;
        identityLikeState.set(identityKey, event.eventType === "ASSET_LIKED");
      }

      const [views, downloads] = await Promise.all([
        ctx.db.userAssetInteraction.count({
          where: {
            tenantId: ctx.tenantId,
            assetId: input.assetId,
            action: {
              in: ["VIEWED", "WATCHED", "OPENED", "CLICKED"],
            },
          },
        }),
        ctx.db.userAssetInteraction.count({
          where: {
            tenantId: ctx.tenantId,
            assetId: input.assetId,
            OR: [
              { action: "DOWNLOADED" },
              { downloaded: true },
            ],
          },
        }),
      ]);

      const visitorSession = input.visitorToken
        ? await resolveVisitorSession({
            db: ctx.db,
            tenantId: ctx.tenantId,
            visitorToken: input.visitorToken,
            userId: ctx.session?.user?.id,
            userAgent: ctx.requestHeaders?.get("user-agent"),
            createIfMissing: false,
          })
        : null;

      const currentIdentityLikeState = (() => {
        const sessionUserId = ctx.session?.user?.id;
        if (sessionUserId) {
          return identityLikeState.get(`user:${sessionUserId}`) ?? false;
        }
        if (visitorSession?.id) {
          return identityLikeState.get(`visitor:${visitorSession.id}`) ?? false;
        }
        return false;
      })();

      return {
        ...attachLibrarySystemTags(asset, librarySystemTags),
        stats: {
          views,
          downloads,
          likes: Array.from(identityLikeState.values()).filter(Boolean).length,
        },
        currentUserLiked: currentIdentityLikeState,
      };
    }),

  courseViewerByProductId: publicTenantProcedure
    .input(z.object({ productId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findFirst({
        where: {
          id: input.productId,
          tenantId: ctx.tenantId,
        },
        include: {
          steps: {
            include: {
              assets: {
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      }

      const progress = ctx.session?.user?.id
        ? await ctx.db.userProductProgress.findMany({
            where: {
              tenantId: ctx.tenantId,
              userId: ctx.session.user.id,
              productId: input.productId,
            },
          })
        : [];

      const progressByStepId = new Map(progress.map((entry) => [entry.stepId, entry]));
      const completedRequiredSteps = new Set(
        product.steps
          .filter((step) => {
            if (!step.isRequired) return false;
            return progressByStepId.get(step.id)?.status === "COMPLETED";
          })
          .map((step) => step.id),
      );

      const steps = product.steps.map((step, index, allSteps) => {
        const metadata = readStepMetadata(step.metadata);
        const previousRequiredIncomplete = allSteps
          .slice(0, index)
          .find((previousStep) => {
            if (!previousStep.isRequired) return false;
            return !completedRequiredSteps.has(previousStep.id);
          });
        const requiresPreviousCompletion =
          (product.lockSequentialSteps && index > 0) || step.lockUntilComplete;
        const progressEntry = progressByStepId.get(step.id) ?? null;
        const isCompleted = progressEntry?.status === "COMPLETED";
        const isUnlocked = !requiresPreviousCompletion || !previousRequiredIncomplete;

        return {
          id: step.id,
          title: step.title,
          description: step.description,
          sortOrder: step.sortOrder,
          isRequired: step.isRequired,
          lockUntilComplete: step.lockUntilComplete,
          isUnlocked,
          isCompleted,
          blockedByStepId: isUnlocked ? null : previousRequiredIncomplete?.id ?? null,
          content: metadata.content ?? "",
          coverImageUrl: metadata.coverImageUrl ?? "",
          questionnaire: metadata.questionnaire ?? null,
          progress: progressEntry
            ? {
                status: progressEntry.status,
                completedAt: progressEntry.completedAt,
                metadata: progressEntry.metadata,
              }
            : null,
          assets: step.assets.map((asset) => ({
            id: asset.id,
            productId: asset.productId,
            title: asset.title,
            description: asset.description,
            type: asset.type,
            url: asset.url,
            previewUrl: asset.previewUrl,
            thumbnailUrl: asset.thumbnailUrl,
            targetUrl: asset.targetUrl,
            openInNewTab: asset.openInNewTab,
            interactionMode: asset.interactionMode,
            isDownloadable: asset.isDownloadable,
            metadata: asset.metadata,
            sourceLibraryAssetId: readSourceLibraryAssetId(asset.metadata),
          })),
        };
      });

      return {
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          lockSequentialSteps: product.lockSequentialSteps,
        },
        steps,
        canTrackProgress: Boolean(ctx.session?.user?.id),
      };
    }),

  toggleLibraryAssetLike: publicTenantProcedure
    .input(
      z.object({
        assetId: z.string().cuid(),
        visitorToken: z.string().min(8).max(191).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.db.productAsset.findFirst({
        where: {
          id: input.assetId,
          tenantId: ctx.tenantId,
          stepId: null,
        },
        select: {
          id: true,
          productId: true,
        },
      });

      if (!asset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Library asset not found." });
      }

      const visitorSession = await resolveVisitorSession({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: ctx.session?.user?.id,
        visitorToken: input.visitorToken,
        userAgent: ctx.requestHeaders?.get("user-agent"),
        createIfMissing: !ctx.session?.user,
      });

      const latestEvent = await ctx.db.userInteractionEvent.findFirst({
        where: {
          tenantId: ctx.tenantId,
          assetId: input.assetId,
          OR: ctx.session?.user?.id
            ? [{ userId: ctx.session.user.id }]
            : visitorSession?.id
              ? [{ visitorSessionId: visitorSession.id }]
              : [],
          eventType: {
            in: ["ASSET_LIKED", "ASSET_UNLIKED"],
          },
        },
        orderBy: {
          occurredAt: "desc",
        },
      });

      const nextEventType =
        latestEvent?.eventType === "ASSET_LIKED" ? "ASSET_UNLIKED" : "ASSET_LIKED";

      await ctx.db.userInteractionEvent.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.session?.user?.id,
          visitorSessionId: visitorSession?.id,
          productId: asset.productId,
          assetId: input.assetId,
          eventType: nextEventType,
          targetType: "library-asset",
          targetId: input.assetId,
        },
      });

      return {
        liked: nextEventType === "ASSET_LIKED",
        visitorToken: visitorSession?.token ?? input.visitorToken ?? null,
      };
    }),

  tenantModuleCatalog: tenantAdminProcedure.query(async ({ ctx }) => {
    const configured = await ctx.db.tenantModuleCapability.findMany({
      where: { tenantId: ctx.tenantId },
    });
    const byType = new Map(
      configured.map((entry: { moduleType: "LIBRARY" | "COURSE" }) => [entry.moduleType, entry]),
    );
    return defaultModuleCatalog.map((entry) => {
      const current = byType.get(entry.moduleType) as
        | { isEnabled: boolean; settings: Record<string, unknown> | null }
        | undefined;
      const mergedSettings = {
        ...normalizeModuleSettings(entry.defaultSettings),
        ...normalizeTenantModuleSettings(entry.moduleType, current?.settings),
      };
      return {
        moduleType: entry.moduleType,
        label: entry.label,
        description: entry.description,
        isEnabled: current?.isEnabled ?? true,
        settings: mergedSettings,
      };
    });
  }),

  updateTenantModuleCapability: tenantAdminProcedure
    .input(
      z.object({
        moduleType: moduleTypeSchema,
        isEnabled: z.boolean(),
        settings: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedSettings = normalizeTenantModuleSettings(input.moduleType, input.settings);

      return ctx.db.tenantModuleCapability.upsert({
        where: {
          tenantId_moduleType: {
            tenantId: ctx.tenantId,
            moduleType: input.moduleType,
          },
        },
        update: {
          isEnabled: input.isEnabled,
          settings: normalizedSettings,
        },
        create: {
          tenantId: ctx.tenantId,
          moduleType: input.moduleType,
          isEnabled: input.isEnabled,
          settings: normalizedSettings,
        },
      });
    }),

  create: tenantAdminProcedure
    .input(
      productInputSchema.extend({
        createDemoCourseContent: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.db.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: {
          id: true,
          isOpen: true,
          policy: {
            select: tenantPolicySelect,
          },
        },
      });
      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      }

      const policy =
        tenant.policy ?? (await ensureTenantPolicy(ctx.db, tenant.id, tenant.isOpen));
      await assertProductCapacity(ctx.db, ctx.tenantId, policy);
      assertProductPolicyCompliance(policy, {
        type: input.type,
        isFree: input.isFree,
        lockSequentialSteps: input.lockSequentialSteps,
        createDemoCourseContent: input.createDemoCourseContent,
        modules: input.modules,
      });

      const normalizedPrice = input.isFree ? null : input.priceCents ?? 0;
      if (!input.isFree && normalizedPrice !== null && normalizedPrice <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Paid products must have a price greater than zero.",
        });
      }
      const enabledByTenant = await readTenantEnabledModules(ctx.db, ctx.tenantId);
      assertRequestedModulesAreEnabledByTenant(enabledByTenant, input.modules);
      const allowedModules = input.modules.filter(
        (module) => module.isEnabled && enabledByTenant.has(module.moduleType),
      );

      const lockSequential = allowedModules.some((module) => module.moduleType === "COURSE")
        ? input.lockSequentialSteps
        : false;

      const created = await ctx.db.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            tenantId: ctx.tenantId,
            createdByUserId: ctx.session!.user.id,
            slug: input.slug ?? slugify(input.title),
            name: input.title,
            subtitle: input.subtitle,
            description: input.description,
            type: input.type,
            isVisible: input.isVisible,
            isFree: input.isFree,
            priceCents: normalizedPrice,
            currency: input.currency.toUpperCase(),
            galleryOnly: input.galleryOnly,
            lockSequentialSteps: lockSequential,
            metadata: input.metadata,
          },
        });

        if (allowedModules.length) {
          await tx.productModuleConfig.createMany({
            data: allowedModules.map((module) => ({
              tenantId: ctx.tenantId,
              productId: product.id,
              moduleType: module.moduleType,
              isEnabled: module.isEnabled,
              sortOrder: module.sortOrder,
              settings: module.settings,
            })),
          });
        }

        if (
          input.createDemoCourseContent &&
          allowedModules.some((module) => module.moduleType === "COURSE")
        ) {
          await createDemoCourseContent(
            tx,
            ctx.tenantId,
            product.id,
            lockSequential,
          );
        }

        return product;
      });
      return created;
    }),

  update: tenantAdminProcedure
    .input(
      productInputSchema
        .partial()
        .extend({
          productId: z.string().cuid(),
          title: z.string().min(2).max(180).optional(),
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing, tenant] = await Promise.all([
        ctx.db.product.findFirst({
          where: { id: input.productId, tenantId: ctx.tenantId },
        }),
        ctx.db.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: {
            id: true,
            isOpen: true,
            policy: {
              select: tenantPolicySelect,
            },
          },
        }),
      ]);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });

      const { productId, ...payload } = input;
      const policy =
        tenant.policy ?? (await ensureTenantPolicy(ctx.db, tenant.id, tenant.isOpen));
      assertProductPolicyCompliance(policy, {
        type: payload.type ?? existing.type,
        isFree: payload.isFree ?? existing.isFree,
        lockSequentialSteps: payload.lockSequentialSteps ?? existing.lockSequentialSteps,
        modules: payload.modules,
      });
      const nextIsFree = payload.isFree ?? existing.isFree;
      const nextPrice = nextIsFree ? null : payload.priceCents ?? existing.priceCents ?? 0;
      if (!nextIsFree && nextPrice !== null && nextPrice <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Paid products must have a price greater than zero.",
        });
      }
      const enabledByTenant = await readTenantEnabledModules(ctx.db, ctx.tenantId);
      assertRequestedModulesAreEnabledByTenant(enabledByTenant, payload.modules ?? []);
      const allowedModules = (payload.modules ?? []).filter(
        (module) => module.isEnabled && enabledByTenant.has(module.moduleType),
      );

      return ctx.db.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id: productId },
          data: {
            slug: payload.slug,
            name: payload.title ?? undefined,
            subtitle: payload.subtitle,
            description: payload.description,
            type: payload.type,
            isVisible: payload.isVisible,
            isFree: payload.isFree,
            priceCents: nextPrice,
            currency: payload.currency?.toUpperCase(),
            galleryOnly: payload.galleryOnly,
            lockSequentialSteps: payload.lockSequentialSteps,
            metadata: payload.metadata,
          },
        });

        if (payload.modules) {
          await tx.productModuleConfig.deleteMany({
            where: { tenantId: ctx.tenantId, productId },
          });

          if (allowedModules.length) {
            await tx.productModuleConfig.createMany({
              data: allowedModules.map((module) => ({
                tenantId: ctx.tenantId,
                productId,
                moduleType: module.moduleType,
                isEnabled: module.isEnabled,
                sortOrder: module.sortOrder,
                settings: module.settings,
              })),
            });
          }
        }

        return updated;
      });
    }),

  createDemoCourseContent: tenantAdminProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [product, tenant] = await Promise.all([
        ctx.db.product.findFirst({
          where: { id: input.productId, tenantId: ctx.tenantId },
        }),
        ctx.db.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: {
            id: true,
            isOpen: true,
            policy: {
              select: tenantPolicySelect,
            },
          },
        }),
      ]);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });

      const policy =
        tenant.policy ?? (await ensureTenantPolicy(ctx.db, tenant.id, tenant.isOpen));
      assertProductPolicyCompliance(policy, {
        createDemoCourseContent: true,
      });

      await createDemoCourseContent(ctx.db, ctx.tenantId, product.id, product.lockSequentialSteps);
      return { ok: true };
    }),

  setStatus: tenantAdminProcedure
    .input(
      z.object({
        productId: z.string().cuid(),
        status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [product, tenant] = await Promise.all([
        ctx.db.product.findFirst({
          where: {
            id: input.productId,
            tenantId: ctx.tenantId,
          },
        }),
        ctx.db.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: {
            id: true,
            isOpen: true,
            policy: {
              select: tenantPolicySelect,
            },
          },
        }),
      ]);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
      }
      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      }

      const policy =
        tenant.policy ?? (await ensureTenantPolicy(ctx.db, tenant.id, tenant.isOpen));
      if (product.status === "ARCHIVED" && input.status !== "ARCHIVED") {
        await assertProductCapacity(ctx.db, ctx.tenantId, policy);
      }

      return ctx.db.product.updateMany({
        where: {
          id: input.productId,
          tenantId: ctx.tenantId,
        },
        data: {
          status: input.status,
          publishedAt: input.status === "PUBLISHED" ? new Date() : null,
        },
      });
    }),
});
