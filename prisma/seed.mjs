import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureUser({ email, name, isGlobalAdmin = false }) {
  return prisma.user.upsert({
    where: { email },
    update: { name, isGlobalAdmin },
    create: {
      email,
      name,
      isGlobalAdmin,
    },
  });
}

async function ensureTenant({ slug, name, isOpen, ownerUserId, settings }) {
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {
      name,
      isOpen,
      settings,
      createdByUserId: ownerUserId,
    },
    create: {
      slug,
      name,
      isOpen,
      settings,
      createdByUserId: ownerUserId,
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: ownerUserId,
      },
    },
    update: { role: "OWNER", status: "ACTIVE" },
    create: {
      tenantId: tenant.id,
      userId: ownerUserId,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  return tenant;
}

async function ensureTenantModuleCapabilities(tenantId, modules) {
  for (const moduleEntry of modules) {
    await prisma.tenantModuleCapability.upsert({
      where: {
        tenantId_moduleType: {
          tenantId,
          moduleType: moduleEntry.moduleType,
        },
      },
      update: {
        isEnabled: moduleEntry.isEnabled,
        settings: moduleEntry.settings ?? null,
      },
      create: {
        tenantId,
        moduleType: moduleEntry.moduleType,
        isEnabled: moduleEntry.isEnabled,
        settings: moduleEntry.settings ?? null,
      },
    });
  }
}

async function replaceProductModuleConfigs(tenantId, productId, modules) {
  await prisma.productModuleConfig.deleteMany({
    where: { tenantId, productId },
  });
  if (!modules.length) return;
  await prisma.productModuleConfig.createMany({
    data: modules.map((moduleEntry, index) => ({
      tenantId,
      productId,
      moduleType: moduleEntry.moduleType,
      isEnabled: moduleEntry.isEnabled,
      settings: moduleEntry.settings ?? null,
      sortOrder: index + 1,
    })),
  });
}

async function ensureTenantPages({ tenantId, productSlug }) {
  const product = await prisma.product.findFirst({
    where: { tenantId, slug: productSlug },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });
  if (!product) return;

  const homePage = await prisma.tenantNodePage.upsert({
    where: { tenantId_slug: { tenantId, slug: "" } },
    update: {
      name: "Home",
      description: "System home page",
      requiresAuth: false,
      internalRoute: false,
      indexable: true,
      hidden: false,
      isSystem: true,
      sortOrder: 0,
    },
    create: {
      tenantId,
      name: "Home",
      slug: "",
      description: "System home page",
      requiresAuth: false,
      internalRoute: false,
      indexable: true,
      hidden: false,
      isSystem: true,
      sortOrder: 0,
    },
  });

  const dashboardPage = await prisma.tenantNodePage.upsert({
    where: { tenantId_slug: { tenantId, slug: "dashboard" } },
    update: {
      name: "Dashboard",
      description: "System dashboard page",
      requiresAuth: true,
      internalRoute: false,
      indexable: false,
      hidden: false,
      isSystem: true,
      sortOrder: 1,
    },
    create: {
      tenantId,
      name: "Dashboard",
      slug: "dashboard",
      description: "System dashboard page",
      requiresAuth: true,
      internalRoute: false,
      indexable: false,
      hidden: false,
      isSystem: true,
      sortOrder: 1,
    },
  });

  const modulesPage = await prisma.tenantNodePage.upsert({
    where: { tenantId_slug: { tenantId, slug: "modules" } },
    update: {
      name: "Modules",
      description: "Tenant configurable modules page",
      requiresAuth: true,
      indexable: false,
      hidden: false,
      internalRoute: false,
      isSystem: false,
      sortOrder: 2,
    },
    create: {
      tenantId,
      name: "Modules",
      slug: "modules",
      description: "Tenant configurable modules page",
      requiresAuth: true,
      indexable: false,
      hidden: false,
      internalRoute: false,
      isSystem: false,
      sortOrder: 2,
    },
  });

  await prisma.tenantNodeItem.deleteMany({
    where: { tenantId, pageId: homePage.id },
  });
  await prisma.tenantNodeItem.deleteMany({
    where: { tenantId, pageId: dashboardPage.id },
  });

  await prisma.tenantNodeItem.create({
    data: {
      tenantId,
      pageId: homePage.id,
      nodeKey: "home-product-hero",
      type: "node-product",
      productId: product.id,
      props: { productId: product.id },
      sortOrder: 1,
      position: {
        xs: { x: 0, y: 0, w: 2, h: 8 },
        sm: { x: 0, y: 0, w: 3, h: 8 },
        lg: { x: 0, y: 0, w: 5, h: 8 },
      },
    },
  });
  if (product.steps[0]) {
    await prisma.tenantNodeItem.create({
      data: {
        tenantId,
        pageId: dashboardPage.id,
        nodeKey: "dashboard-first-step",
        type: "node-course-step",
        productId: product.id,
        stepId: product.steps[0].id,
        props: { productId: product.id, stepId: product.steps[0].id },
        sortOrder: 1,
        position: {
          xs: { x: 0, y: 0, w: 2, h: 8 },
          sm: { x: 0, y: 0, w: 3, h: 8 },
          lg: { x: 0, y: 0, w: 5, h: 8 },
        },
      },
    });
  }

  await prisma.tenantNodeItem.deleteMany({
    where: { tenantId, pageId: modulesPage.id },
  });

  await prisma.tenantNodeItem.create({
    data: {
      tenantId,
      pageId: modulesPage.id,
      nodeKey: "product-main-node",
      type: "node-product",
      productId: product.id,
      props: { productId: product.id },
      sortOrder: 1,
      position: {
        xs: { x: 0, y: 0, w: 2, h: 8 },
        sm: { x: 0, y: 0, w: 3, h: 8 },
        lg: { x: 0, y: 0, w: 4, h: 8 },
      },
    },
  });

  if (product.steps[0]) {
    await prisma.tenantNodeItem.create({
      data: {
        tenantId,
        pageId: modulesPage.id,
        nodeKey: "course-step-main-node",
        type: "node-course-step",
        productId: product.id,
        stepId: product.steps[0].id,
        props: { productId: product.id, stepId: product.steps[0].id },
        sortOrder: 2,
        position: {
          xs: { x: 0, y: 8, w: 2, h: 8 },
          sm: { x: 0, y: 8, w: 3, h: 8 },
          lg: { x: 0, y: 8, w: 4, h: 8 },
        },
      },
    });
  }
}

async function createCourseProduct({ tenantId, ownerUserId, slug, name, description, classes }) {
  const product = await prisma.product.upsert({
    where: { tenantId_slug: { tenantId, slug } },
    update: {
      name,
      subtitle: "Complete course journey",
      description,
      type: "COURSE",
      status: "PUBLISHED",
      isVisible: true,
      isFree: false,
      priceCents: 29900,
      currency: "BRL",
      galleryOnly: false,
      lockSequentialSteps: true,
      createdByUserId: ownerUserId,
      metadata: { brand: "SAGA", audience: "designers" },
    },
    create: {
      tenantId,
      slug,
      name,
      subtitle: "Complete course journey",
      description,
      type: "COURSE",
      status: "PUBLISHED",
      isVisible: true,
      isFree: false,
      priceCents: 29900,
      currency: "BRL",
      galleryOnly: false,
      lockSequentialSteps: true,
      createdByUserId: ownerUserId,
      metadata: { brand: "SAGA", audience: "designers" },
      publishedAt: new Date(),
    },
  });

  await prisma.userProductProgress.deleteMany({
    where: { tenantId, productId: product.id },
  });
  await prisma.userAssetInteraction.deleteMany({
    where: { tenantId, productId: product.id },
  });
  await prisma.userInteractionEvent.deleteMany({
    where: { tenantId, productId: product.id },
  });
  await prisma.productAsset.deleteMany({
    where: { tenantId, productId: product.id },
  });
  await prisma.productStep.deleteMany({
    where: { tenantId, productId: product.id },
  });
  await prisma.productFeature.deleteMany({
    where: { tenantId, productId: product.id },
  });

  await replaceProductModuleConfigs(tenantId, product.id, [
    {
      moduleType: "GALLERY",
      isEnabled: true,
      settings: {
        allowedAssetTypes: ["VIDEO", "PDF", "IMAGE"],
        allowDownloadToggle: true,
      },
    },
    {
      moduleType: "DOWNLOADS",
      isEnabled: true,
      settings: {
        canDownloadMaterials: true,
      },
    },
    {
      moduleType: "COURSE",
      isEnabled: true,
      settings: {
        lockSequentialSteps: true,
        includeTextContent: true,
      },
    },
  ]);

  for (let i = 0; i < classes.length; i += 1) {
    const classTitle = classes[i];
    const feature = await prisma.productFeature.create({
      data: {
        title: `Module ${i + 1}: ${classTitle}`,
        description: `Design module about ${classTitle}.`,
        tenantId,
        productId: product.id,
        sortOrder: i + 1,
      },
    });

    const step = await prisma.productStep.create({
      data: {
        tenantId,
        productId: product.id,
        featureId: feature.id,
        title: `Class ${i + 1}: ${classTitle}`,
        description: `Watch class ${i + 1} and download materials.`,
        sortOrder: i + 1,
        lockUntilComplete: i > 0,
        isRequired: true,
      },
    });

    await prisma.productAsset.createMany({
      data: [
        {
          tenantId,
          productId: product.id,
          featureId: feature.id,
          stepId: step.id,
          title: `Class ${i + 1} Video`,
          description: `Video lesson for ${classTitle}`,
          type: "VIDEO",
          url: `https://cdn.hubstudio.dev/design/class-${i + 1}.mp4`,
          durationSeconds: 900 + i * 120,
          sortOrder: 1,
        },
        {
          tenantId,
          productId: product.id,
          featureId: feature.id,
          stepId: step.id,
          title: `Class ${i + 1} PDF`,
          description: `Downloadable guide for ${classTitle}`,
          type: "PDF",
          url: `https://cdn.hubstudio.dev/design/class-${i + 1}.pdf`,
          isDownloadable: true,
          sortOrder: 2,
        },
      ],
      skipDuplicates: true,
    });
  }

  return product;
}

async function main() {
  const globalAdminEmail = process.env.GLOBAL_ADMIN_EMAIL ?? "daciano@hubstudio.local";
  const globalAdmin = await ensureUser({
    email: globalAdminEmail,
    name: "Global Dev Admin",
    isGlobalAdmin: true,
  });

  const designOwner = await ensureUser({
    email: "owner@sagaacademy.com",
    name: "SAGA Owner",
  });
  const beautyOwner = await ensureUser({
    email: "owner@belezaprofessional.com",
    name: "Beleza Owner",
  });
  const constructionOwner = await ensureUser({
    email: "owner@urbaconstrutora.com",
    name: "UrbA Owner",
  });

  const designTenant = await ensureTenant({
    slug: "saga-design-academy",
    name: "SAGA Design Academy",
    isOpen: false,
    ownerUserId: designOwner.id,
    settings: {
      segment: "education",
      brandColor: "#ff5b00",
      theme: {
        bgMain: "#090909",
        bgSecondary: "#131313",
        textMain: "#ffffff",
        borderColor: "#2b2b2b",
        accent: "#ff5b00",
      },
    },
  });
  const beautyTenant = await ensureTenant({
    slug: "beleza-pro-cosmetics",
    name: "Beleza Pro Cosmetics",
    isOpen: false,
    ownerUserId: beautyOwner.id,
    settings: {
      segment: "cosmetics",
      onboardingModel: "representatives",
      theme: {
        bgMain: "#120c14",
        bgSecondary: "#1e1523",
        textMain: "#f9ecff",
        borderColor: "#4a2e58",
        accent: "#d948b0",
      },
    },
  });
  const constructionTenant = await ensureTenant({
    slug: "urba-construtora",
    name: "UrbA Construtora",
    isOpen: false,
    ownerUserId: constructionOwner.id,
    settings: {
      segment: "construction",
      contentMode: "gallery-and-docs",
      theme: {
        bgMain: "#0f1317",
        bgSecondary: "#1a232c",
        textMain: "#e8f1ff",
        borderColor: "#344352",
        accent: "#f59e0b",
      },
    },
  });

  await ensureTenantModuleCapabilities(designTenant.id, [
    {
      moduleType: "GALLERY",
      isEnabled: true,
      settings: { allowedAssetTypes: ["VIDEO", "PDF", "IMAGE"], allowDownloadToggle: true },
    },
    {
      moduleType: "DOWNLOADS",
      isEnabled: true,
      settings: { canDownloadMaterials: true },
    },
    {
      moduleType: "COURSE",
      isEnabled: true,
      settings: { lockSequentialSteps: true, includeTextContent: true },
    },
  ]);
  await ensureTenantModuleCapabilities(beautyTenant.id, [
    {
      moduleType: "GALLERY",
      isEnabled: true,
      settings: { allowedAssetTypes: ["VIDEO", "PDF", "IMAGE"], allowDownloadToggle: true },
    },
    {
      moduleType: "DOWNLOADS",
      isEnabled: true,
      settings: { canDownloadMaterials: true },
    },
    {
      moduleType: "COURSE",
      isEnabled: true,
      settings: { lockSequentialSteps: true, includeTextContent: true },
    },
  ]);
  await ensureTenantModuleCapabilities(constructionTenant.id, [
    {
      moduleType: "GALLERY",
      isEnabled: true,
      settings: { allowedAssetTypes: ["VIDEO", "PDF", "IMAGE"], allowDownloadToggle: true },
    },
    {
      moduleType: "DOWNLOADS",
      isEnabled: true,
      settings: { canDownloadMaterials: true },
    },
    {
      moduleType: "COURSE",
      isEnabled: false,
      settings: { lockSequentialSteps: false, includeTextContent: false },
    },
  ]);

  for (const tenant of [designTenant, beautyTenant, constructionTenant]) {
    await prisma.tenantMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: globalAdmin.id,
        },
      },
      update: { role: "OWNER", status: "ACTIVE" },
      create: {
        tenantId: tenant.id,
        userId: globalAdmin.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });
  }

  await createCourseProduct({
    tenantId: designTenant.id,
    ownerUserId: designOwner.id,
    slug: "motion-design-pro",
    name: "Motion Design Pro",
    description: "After Effects + branding motion full journey.",
    classes: ["Foundations", "Transitions", "Advanced Effects"],
  });

  const beautyTraining = await prisma.product.upsert({
    where: {
      tenantId_slug: { tenantId: beautyTenant.id, slug: "aurora-product-training" },
    },
    update: {
      name: "Aurora Product Training",
      subtitle: "Rep enablement onboarding",
      description: "Representatives learn ingredients, pitch and usage.",
      type: "COURSE",
      status: "PUBLISHED",
      lockSequentialSteps: true,
      isVisible: true,
      isFree: true,
      galleryOnly: false,
    },
    create: {
      tenantId: beautyTenant.id,
      slug: "aurora-product-training",
      name: "Aurora Product Training",
      subtitle: "Rep enablement onboarding",
      description: "Representatives learn ingredients, pitch and usage.",
      type: "COURSE",
      status: "PUBLISHED",
      isVisible: true,
      isFree: true,
      galleryOnly: false,
      lockSequentialSteps: true,
      createdByUserId: beautyOwner.id,
      publishedAt: new Date(),
    },
  });

  await prisma.productAsset.deleteMany({
    where: { tenantId: beautyTenant.id, productId: beautyTraining.id },
  });
  await prisma.productStep.deleteMany({
    where: { tenantId: beautyTenant.id, productId: beautyTraining.id },
  });
  await prisma.productFeature.deleteMany({
    where: { tenantId: beautyTenant.id, productId: beautyTraining.id },
  });

  await replaceProductModuleConfigs(beautyTenant.id, beautyTraining.id, [
    {
      moduleType: "GALLERY",
      isEnabled: true,
      settings: {
        allowedAssetTypes: ["VIDEO", "PDF", "IMAGE"],
        allowDownloadToggle: true,
      },
    },
    {
      moduleType: "DOWNLOADS",
      isEnabled: true,
      settings: {
        canDownloadMaterials: true,
      },
    },
    {
      moduleType: "COURSE",
      isEnabled: true,
      settings: {
        lockSequentialSteps: true,
        includeTextContent: true,
      },
    },
  ]);

  const beautyFeature = await prisma.productFeature.create({
    data: {
      tenantId: beautyTenant.id,
      productId: beautyTraining.id,
      title: "Aurora Serum Launch",
      description: "Core content for representatives.",
      sortOrder: 1,
    },
  });

  const beautyStep = await prisma.productStep.create({
    data: {
      tenantId: beautyTenant.id,
      productId: beautyTraining.id,
      featureId: beautyFeature.id,
      title: "Pitch script and ingredients",
      description: "Video + PDF to prepare representatives.",
      sortOrder: 1,
      lockUntilComplete: false,
      isRequired: true,
    },
  });

  await prisma.productAsset.createMany({
    data: [
      {
        tenantId: beautyTenant.id,
        productId: beautyTraining.id,
        featureId: beautyFeature.id,
        stepId: beautyStep.id,
        title: "Aurora Training Video",
        type: "VIDEO",
        url: "https://cdn.hubstudio.dev/beauty/aurora-training.mp4",
        durationSeconds: 760,
        sortOrder: 1,
      },
      {
        tenantId: beautyTenant.id,
        productId: beautyTraining.id,
        featureId: beautyFeature.id,
        stepId: beautyStep.id,
        title: "Aurora Product Sheet",
        type: "PDF",
        url: "https://cdn.hubstudio.dev/beauty/aurora-sheet.pdf",
        isDownloadable: true,
        sortOrder: 2,
      },
    ],
    skipDuplicates: true,
  });

  const constructionProduct = await prisma.product.upsert({
    where: {
      tenantId_slug: { tenantId: constructionTenant.id, slug: "portfolio-buildings-gallery" },
    },
    update: {
      name: "Portfolio Buildings Gallery",
      subtitle: "Media and technical collateral",
      description: "Buildings, shopping centers, and engineering collateral.",
      type: "DIGITAL_PRODUCT",
      status: "PUBLISHED",
      isVisible: true,
      isFree: true,
      galleryOnly: true,
      lockSequentialSteps: false,
    },
    create: {
      tenantId: constructionTenant.id,
      slug: "portfolio-buildings-gallery",
      name: "Portfolio Buildings Gallery",
      subtitle: "Media and technical collateral",
      description: "Buildings, shopping centers, and engineering collateral.",
      type: "DIGITAL_PRODUCT",
      status: "PUBLISHED",
      isVisible: true,
      isFree: true,
      galleryOnly: true,
      lockSequentialSteps: false,
      createdByUserId: constructionOwner.id,
      publishedAt: new Date(),
    },
  });

  await prisma.productAsset.deleteMany({
    where: { tenantId: constructionTenant.id, productId: constructionProduct.id },
  });
  await prisma.productStep.deleteMany({
    where: { tenantId: constructionTenant.id, productId: constructionProduct.id },
  });
  await prisma.productFeature.deleteMany({
    where: { tenantId: constructionTenant.id, productId: constructionProduct.id },
  });

  await replaceProductModuleConfigs(constructionTenant.id, constructionProduct.id, [
    {
      moduleType: "GALLERY",
      isEnabled: true,
      settings: {
        allowedAssetTypes: ["VIDEO", "PDF", "IMAGE"],
        allowDownloadToggle: true,
      },
    },
    {
      moduleType: "DOWNLOADS",
      isEnabled: true,
      settings: {
        canDownloadMaterials: true,
      },
    },
    {
      moduleType: "COURSE",
      isEnabled: false,
      settings: {
        lockSequentialSteps: false,
        includeTextContent: false,
      },
    },
  ]);

  const constructionFeature = await prisma.productFeature.create({
    data: {
      tenantId: constructionTenant.id,
      productId: constructionProduct.id,
      title: "Buildings and Shopping Showcases",
      description: "Media gallery and technical docs.",
      sortOrder: 1,
    },
  });

  const constructionStep = await prisma.productStep.create({
    data: {
      tenantId: constructionTenant.id,
      productId: constructionProduct.id,
      featureId: constructionFeature.id,
      title: "Explore project media and plans",
      sortOrder: 1,
      lockUntilComplete: false,
      isRequired: false,
    },
  });

  await prisma.productAsset.createMany({
    data: [
      {
        tenantId: constructionTenant.id,
        productId: constructionProduct.id,
        featureId: constructionFeature.id,
        stepId: constructionStep.id,
        title: "Downtown Tower Video Walkthrough",
        type: "VIDEO",
        url: "https://cdn.hubstudio.dev/construction/tower.mp4",
        durationSeconds: 620,
        sortOrder: 1,
      },
      {
        tenantId: constructionTenant.id,
        productId: constructionProduct.id,
        featureId: constructionFeature.id,
        stepId: constructionStep.id,
        title: "Shopping Masterplan PDF",
        type: "PDF",
        url: "https://cdn.hubstudio.dev/construction/masterplan.pdf",
        isDownloadable: true,
        sortOrder: 2,
      },
      {
        tenantId: constructionTenant.id,
        productId: constructionProduct.id,
        featureId: constructionFeature.id,
        stepId: constructionStep.id,
        title: "Buildings Gallery",
        type: "LINK",
        url: "https://gallery.hubstudio.dev/construction/buildings",
        sortOrder: 3,
      },
    ],
    skipDuplicates: true,
  });

  const representatives = [
    { email: "rep.design1@sagaacademy.com", tenant: designTenant, ownerId: designOwner.id },
    { email: "rep.beauty1@belezapro.com", tenant: beautyTenant, ownerId: beautyOwner.id },
    { email: "rep.construction1@urbaconstrutora.com", tenant: constructionTenant, ownerId: constructionOwner.id },
  ];

  for (const rep of representatives) {
    const repUser = await ensureUser({
      email: rep.email,
      name: rep.email.split("@")[0],
    });

    await prisma.tenantMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId: rep.tenant.id,
          userId: repUser.id,
        },
      },
      update: {
        role: "MEMBER",
        status: "ACTIVE",
      },
      create: {
        tenantId: rep.tenant.id,
        userId: repUser.id,
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    await prisma.tenantInvitation.upsert({
      where: {
        tenantId_email: {
          tenantId: rep.tenant.id,
          email: rep.email,
        },
      },
      update: {
        role: "MEMBER",
        status: "ACTIVE",
        invitedByUserId: rep.ownerId,
      },
      create: {
        tenantId: rep.tenant.id,
        email: rep.email,
        role: "MEMBER",
        status: "ACTIVE",
        invitedByUserId: rep.ownerId,
      },
    });

    const defaultProduct = await prisma.product.findFirst({
      where: { tenantId: rep.tenant.id, isVisible: true },
      orderBy: { createdAt: "asc" },
    });
    if (defaultProduct) {
      await prisma.userProductAccess.upsert({
        where: {
          tenantId_userId_productId: {
            tenantId: rep.tenant.id,
            userId: repUser.id,
            productId: defaultProduct.id,
          },
        },
        update: {
          canView: true,
          canDownload: true,
          canEditProgress: false,
          grantedByUserId: rep.ownerId,
        },
        create: {
          tenantId: rep.tenant.id,
          userId: repUser.id,
          productId: defaultProduct.id,
          canView: true,
          canDownload: true,
          canEditProgress: false,
          grantedByUserId: rep.ownerId,
        },
      });
    }
  }

  const designProduct = await prisma.product.findFirst({
    where: { tenantId: designTenant.id, slug: "motion-design-pro" },
    include: { steps: true, assets: true },
  });
  const designRep = await prisma.user.findUnique({
    where: { email: "rep.design1@sagaacademy.com" },
  });
  if (designProduct && designRep) {
    const firstStep = designProduct.steps.sort((a, b) => a.sortOrder - b.sortOrder)[0];
    const firstAsset = designProduct.assets.find((asset) => asset.stepId === firstStep?.id);
    if (firstStep && firstAsset) {
      await prisma.userProductProgress.upsert({
        where: {
          tenantId_userId_stepId: {
            tenantId: designTenant.id,
            userId: designRep.id,
            stepId: firstStep.id,
          },
        },
        update: {
          status: "IN_PROGRESS",
          watchPercent: 68,
          lastAccessedAt: new Date(),
        },
        create: {
          tenantId: designTenant.id,
          userId: designRep.id,
          productId: designProduct.id,
          stepId: firstStep.id,
          status: "IN_PROGRESS",
          watchPercent: 68,
          firstAccessedAt: new Date(),
          lastAccessedAt: new Date(),
        },
      });

      await prisma.userAssetInteraction.create({
        data: {
          tenantId: designTenant.id,
          userId: designRep.id,
          productId: designProduct.id,
          assetId: firstAsset.id,
          stepId: firstStep.id,
          action: "WATCHED",
          watchedSeconds: 480,
          downloaded: false,
        },
      });
      await prisma.userInteractionEvent.create({
        data: {
          tenantId: designTenant.id,
          userId: designRep.id,
          productId: designProduct.id,
          stepId: firstStep.id,
          assetId: firstAsset.id,
          eventType: "video_watched",
          targetType: "lesson_video",
          value: "68_percent",
          metadata: { source: "mock-seed" },
        },
      });
    }
  }

  await ensureTenantPages({
    tenantId: designTenant.id,
    productSlug: "motion-design-pro",
  });
  await ensureTenantPages({
    tenantId: beautyTenant.id,
    productSlug: "aurora-product-training",
  });
  await ensureTenantPages({
    tenantId: constructionTenant.id,
    productSlug: "portfolio-buildings-gallery",
  });

  console.log("Seed complete:");
  console.log(`- Global admin: ${globalAdmin.email}`);
  console.log("- Owners:");
  console.log("  - owner@sagaacademy.com");
  console.log("  - owner@belezaprofessional.com");
  console.log("  - owner@urbaconstrutora.com");
  console.log("- Tenants:");
  console.log("  - saga-design-academy");
  console.log("  - beleza-pro-cosmetics");
  console.log("  - urba-construtora");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
