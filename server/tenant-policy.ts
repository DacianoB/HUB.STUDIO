import {
  MembershipStatus,
  Prisma,
  PrismaClient,
  ProductType,
  TenantJoinMode,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";

const policyDbTenantSelect = {
  id: true,
  slug: true,
  name: true,
  isOpen: true,
  policy: {
    select: {
      joinMode: true,
      maxOutstandingInvites: true,
      maxActiveMembers: true,
      maxProducts: true,
      maxPages: true,
      allowedProductTypes: true,
      allowPaidProducts: true,
      allowDownloads: true,
      allowSequentialCourses: true,
      allowDemoCourseContent: true,
      allowPublicPages: true,
      allowHiddenPages: true,
      allowIndexablePages: true,
      allowInternalRoutePages: true,
      allowUserEditablePages: true,
      allowBrandingEditor: true,
    },
  },
} satisfies Prisma.TenantSelect;

export const tenantPolicySelect = {
  joinMode: true,
  maxOutstandingInvites: true,
  maxActiveMembers: true,
  maxProducts: true,
  maxPages: true,
  allowedProductTypes: true,
  allowPaidProducts: true,
  allowDownloads: true,
  allowSequentialCourses: true,
  allowDemoCourseContent: true,
  allowPublicPages: true,
  allowHiddenPages: true,
  allowIndexablePages: true,
  allowInternalRoutePages: true,
  allowUserEditablePages: true,
  allowBrandingEditor: true,
} satisfies Prisma.TenantPolicySelect;

export type TenantPolicySummary = Prisma.TenantPolicyGetPayload<{
  select: typeof tenantPolicySelect;
}>;

export type TenantUsageCounters = {
  activeMembers: number;
  outstandingInvites: number;
  products: number;
  pages: number;
};

export const ALL_PRODUCT_TYPES: ProductType[] = [
  "COURSE",
  "PHYSICAL_PRODUCT",
  "DIGITAL_PRODUCT",
  "SERVICE",
  "CUSTOM",
];

type PolicyDbClient = PrismaClient | Prisma.TransactionClient;

export function joinModeFromLegacyOpenFlag(isOpen: boolean) {
  return isOpen ? TenantJoinMode.OPEN_AUTO_APPROVE : TenantJoinMode.INVITE_ONLY;
}

export function isJoinModeOpen(joinMode: TenantJoinMode) {
  return joinMode !== TenantJoinMode.INVITE_ONLY;
}

function baseTenantPolicyData(isOpen = false) {
  return {
    joinMode: joinModeFromLegacyOpenFlag(Boolean(isOpen)),
    maxOutstandingInvites: null,
    maxActiveMembers: null,
    maxProducts: null,
    maxPages: null,
    allowedProductTypes: [...ALL_PRODUCT_TYPES],
    allowPaidProducts: true,
    allowDownloads: true,
    allowSequentialCourses: true,
    allowDemoCourseContent: true,
    allowPublicPages: true,
    allowHiddenPages: true,
    allowIndexablePages: true,
    allowInternalRoutePages: true,
    allowUserEditablePages: true,
    allowBrandingEditor: true,
  };
}

export function defaultTenantPolicyData(isOpen = false): Prisma.TenantPolicyCreateWithoutTenantInput {
  return baseTenantPolicyData(isOpen);
}

export function defaultTenantPolicyUncheckedData(
  tenantId: string,
  isOpen = false,
): Prisma.TenantPolicyUncheckedCreateInput {
  return {
    tenantId,
    ...baseTenantPolicyData(isOpen),
  };
}

export async function ensureTenantPolicy(
  db: PolicyDbClient,
  tenantId: string,
  tenantIsOpen = false,
) {
  return db.tenantPolicy.upsert({
    where: { tenantId },
    update: {},
    create: defaultTenantPolicyUncheckedData(tenantId, tenantIsOpen),
    select: tenantPolicySelect,
  });
}

export async function getTenantUsageCounters(
  db: PolicyDbClient,
  tenantId: string,
): Promise<TenantUsageCounters> {
  const [activeMembers, outstandingInvites, products, pages] = await Promise.all([
    db.tenantMembership.count({
      where: {
        tenantId,
        status: "ACTIVE",
      },
    }),
    db.tenantInvitation.count({
      where: {
        tenantId,
        acceptedByUserId: null,
        status: {
          in: ["PENDING", "ACTIVE"],
        },
      },
    }),
    db.product.count({
      where: {
        tenantId,
        status: {
          not: "ARCHIVED",
        },
      },
    }),
    db.tenantNodePage.count({
      where: {
        tenantId,
        isSystem: false,
      },
    }),
  ]);

  return {
    activeMembers,
    outstandingInvites,
    products,
    pages,
  };
}

export async function getTenantPolicySnapshot(
  db: PolicyDbClient,
  tenantId: string,
) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: policyDbTenantSelect,
  });

  if (!tenant) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tenant not found.",
    });
  }

  const policy =
    tenant.policy ??
    (await ensureTenantPolicy(db, tenant.id, tenant.isOpen));

  const usage = await getTenantUsageCounters(db, tenant.id);

  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      isOpen: tenant.isOpen,
    },
    policy,
    usage,
  };
}

export async function assertOutstandingInviteCapacity(
  db: PolicyDbClient,
  tenantId: string,
  policy: TenantPolicySummary,
) {
  if (policy.maxOutstandingInvites == null) return;

  const outstandingInvites = await db.tenantInvitation.count({
    where: {
      tenantId,
      acceptedByUserId: null,
      status: {
        in: ["PENDING", "ACTIVE"],
      },
    },
  });

  if (outstandingInvites >= policy.maxOutstandingInvites) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Outstanding invite limit reached for this tenant.",
    });
  }
}

export async function assertActiveMemberCapacity(
  db: PolicyDbClient,
  tenantId: string,
  policy: TenantPolicySummary,
  currentStatus?: MembershipStatus | null,
) {
  if (currentStatus === "ACTIVE" || policy.maxActiveMembers == null) return;

  const activeMembers = await db.tenantMembership.count({
    where: {
      tenantId,
      status: "ACTIVE",
    },
  });

  if (activeMembers >= policy.maxActiveMembers) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Active member limit reached for this tenant.",
    });
  }
}

export async function assertProductCapacity(
  db: PolicyDbClient,
  tenantId: string,
  policy: TenantPolicySummary,
) {
  if (policy.maxProducts == null) return;

  const productCount = await db.product.count({
    where: {
      tenantId,
      status: {
        not: "ARCHIVED",
      },
    },
  });

  if (productCount >= policy.maxProducts) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Product limit reached for this tenant.",
    });
  }
}

export async function assertPageCapacity(
  db: PolicyDbClient,
  tenantId: string,
  policy: TenantPolicySummary,
) {
  if (policy.maxPages == null) return;

  const pageCount = await db.tenantNodePage.count({
    where: {
      tenantId,
      isSystem: false,
    },
  });

  if (pageCount >= policy.maxPages) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Page limit reached for this tenant.",
    });
  }
}

export function assertProductPolicyCompliance(
  policy: TenantPolicySummary,
  input: {
    type?: ProductType;
    isFree?: boolean;
    lockSequentialSteps?: boolean;
    createDemoCourseContent?: boolean;
    modules?: Array<{
      moduleType: "LIBRARY" | "COURSE";
      isEnabled: boolean;
      settings?: Record<string, unknown>;
    }>;
  },
) {
  if (input.type && !policy.allowedProductTypes.includes(input.type)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Product type ${input.type} is disabled for this tenant.`,
    });
  }

  if (input.isFree === false && !policy.allowPaidProducts) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Paid products are disabled for this tenant.",
    });
  }

  if (input.lockSequentialSteps && !policy.allowSequentialCourses) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Sequential course locking is disabled for this tenant.",
    });
  }

  if (input.createDemoCourseContent && !policy.allowDemoCourseContent) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Demo course generation is disabled for this tenant.",
    });
  }

  if (
    !policy.allowDownloads &&
    input.modules?.some((module) => {
      if (!module.isEnabled || module.moduleType !== "LIBRARY") return false;
      return Boolean(module.settings?.allowDownloads);
    })
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Downloads are disabled for this tenant.",
    });
  }
}

export function assertAssetPolicyCompliance(
  policy: TenantPolicySummary,
  input: {
    isDownloadable?: boolean;
    interactionMode?: "OPEN" | "DOWNLOAD" | "LINK";
  },
) {
  if (!policy.allowDownloads && (input.isDownloadable || input.interactionMode === "DOWNLOAD")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Downloads are disabled for this tenant.",
    });
  }
}

export function assertPagePolicyCompliance(
  policy: TenantPolicySummary,
  input: {
    requiresAuth?: boolean;
    hidden?: boolean;
    indexable?: boolean;
    internalRoute?: boolean;
    editableByUser?: boolean;
  },
) {
  if (input.requiresAuth === false && !policy.allowPublicPages) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Public pages are disabled for this tenant.",
    });
  }

  if (input.hidden && !policy.allowHiddenPages) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Hidden pages are disabled for this tenant.",
    });
  }

  if (input.indexable && !policy.allowIndexablePages) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Indexable pages are disabled for this tenant.",
    });
  }

  if (input.internalRoute && !policy.allowInternalRoutePages) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Internal route pages are disabled for this tenant.",
    });
  }

  if (input.editableByUser && !policy.allowUserEditablePages) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User-editable pages are disabled for this tenant.",
    });
  }
}
