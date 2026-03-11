'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Box,
  CheckCircle2,
  FileStack,
  Layers3,
  Palette,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { Responsive } from 'react-grid-layout';
import { WidthProvider } from 'react-grid-layout/legacy';

import {
  TENANT_THEME_FIELDS,
  readTenantTheme,
  type TenantTheme
} from '~/app/_nodes/tenant-theme';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { api } from '~/trpc/react';

type Section = 'users' | 'products' | 'pages';
type ProductEditorView = 'builder' | 'settings';
type ProductType =
  | 'COURSE'
  | 'PHYSICAL_PRODUCT'
  | 'DIGITAL_PRODUCT'
  | 'SERVICE'
  | 'CUSTOM';
type ProductModuleType = 'LIBRARY' | 'COURSE';
type ProductAssetType = 'VIDEO' | 'PDF' | 'FILE' | 'IMAGE' | 'LINK';
type FeatureBlueprint = {
  key: string;
  title: string;
  description: string;
  moduleType?: ProductModuleType;
};
type ProductFeatureRecord = {
  id: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  isVisible: boolean;
  metadata?: Record<string, unknown> | null;
};
type ProductStepRecord = {
  id: string;
  featureId?: string | null;
  title: string;
  description?: string | null;
  sortOrder: number;
  lockUntilComplete: boolean;
  isRequired: boolean;
};
type ProductAssetRecord = {
  id: string;
  featureId?: string | null;
  stepId?: string | null;
  title: string;
  description?: string | null;
  type: string;
  url: string;
  isDownloadable: boolean;
  sortOrder: number;
};
type ProductModuleConfigRecord = {
  id: string;
  moduleType: string;
  isEnabled: boolean;
  settings?: Record<string, unknown> | null;
};

const STANDALONE_COURSE_EDITOR_ID = '__standalone_course__';
const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  COURSE: 'Course',
  PHYSICAL_PRODUCT: 'Physical',
  DIGITAL_PRODUCT: 'Digital',
  SERVICE: 'Service',
  CUSTOM: 'Custom'
};
const MODULE_LABELS: Record<ProductModuleType, string> = {
  LIBRARY: 'Library',
  COURSE: 'Course'
};
const FEATURE_BLUEPRINTS: Record<ProductType, FeatureBlueprint[]> = {
  COURSE: [
    {
      key: 'curriculum',
      title: 'Curriculum path',
      description: 'Break the offer into focused learning milestones and modules.',
      moduleType: 'COURSE'
    },
    {
      key: 'resources',
      title: 'Resource library',
      description: 'Attach worksheets, templates, and supporting downloads.',
      moduleType: 'LIBRARY'
    },
    {
      key: 'community',
      title: 'Community access',
      description: 'Describe the member group, office hours, or discussion area.'
    }
  ],
  DIGITAL_PRODUCT: [
    {
      key: 'template-bundle',
      title: 'Template bundle',
      description: 'List the files, packs, and starter kits included in the download.',
      moduleType: 'LIBRARY'
    },
    {
      key: 'walkthrough',
      title: 'Quickstart walkthrough',
      description: 'Provide a guided setup or implementation mini-course.',
      moduleType: 'COURSE'
    },
    {
      key: 'preview-gallery',
      title: 'Preview gallery',
      description: 'Show screenshots, demos, and before/after visuals.',
      moduleType: 'LIBRARY'
    },
    {
      key: 'updates',
      title: 'Lifetime updates',
      description: 'Explain ongoing updates, changelog access, or release cadence.'
    }
  ],
  PHYSICAL_PRODUCT: [
    {
      key: 'whats-inside',
      title: 'What is included',
      description: 'Explain the package contents, variants, and accessories.'
    },
    {
      key: 'setup-guide',
      title: 'Setup guide',
      description: 'Add installation, unboxing, or usage instructions.',
      moduleType: 'COURSE'
    },
    {
      key: 'care-downloads',
      title: 'Care and warranty docs',
      description: 'Provide manuals, warranty cards, or care instructions.',
      moduleType: 'LIBRARY'
    },
    {
      key: 'product-gallery',
      title: 'Product gallery',
      description: 'Show close-ups, lifestyle photos, and comparison media.',
      moduleType: 'LIBRARY'
    }
  ],
  SERVICE: [
    {
      key: 'onboarding',
      title: 'Client onboarding',
      description: 'Outline intake, kickoff, and required preparation steps.'
    },
    {
      key: 'session-plan',
      title: 'Session roadmap',
      description: 'Describe the phases, meetings, and expected outcomes.',
      moduleType: 'COURSE'
    },
    {
      key: 'deliverables',
      title: 'Deliverables vault',
      description: 'Collect briefs, reports, files, or final assets.',
      moduleType: 'LIBRARY'
    },
    {
      key: 'proof-gallery',
      title: 'Proof and case studies',
      description: 'Show examples, testimonials, and visual proof points.',
      moduleType: 'LIBRARY'
    }
  ],
  CUSTOM: [
    {
      key: 'core-offer',
      title: 'Core offer',
      description: 'Define the primary outcome and promise of this custom product.'
    },
    {
      key: 'learning-layer',
      title: 'Guided experience',
      description: 'Turn the custom product into a step-based guided flow.',
      moduleType: 'COURSE'
    },
    {
      key: 'resource-center',
      title: 'Resource center',
      description: 'Attach supporting docs, files, or implementation assets.',
      moduleType: 'LIBRARY'
    },
    {
      key: 'visual-story',
      title: 'Visual story',
      description: 'Curate media that explains the value of the offer.',
      moduleType: 'LIBRARY'
    }
  ]
};

const defaultPosition = {
  xs: { x: 0, y: 0, w: 2, h: 8 },
  sm: { x: 0, y: 0, w: 3, h: 8 },
  lg: { x: 0, y: 0, w: 4, h: 8 }
};
const MiniResponsiveGridLayout = WidthProvider(Responsive);

function slugPath(slug: string) {
  const normalized = slug.replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}` : '/';
}

function toPageSlug(input: string) {
  const trimmed = input.trim().toLowerCase();
  const kebab = trimmed
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return kebab || 'new-page';
}

function readFeatureModuleType(feature: ProductFeatureRecord) {
  const moduleType = feature.metadata?.moduleType;
  return moduleType === 'LIBRARY' ||
    moduleType === 'COURSE'
    ? moduleType
    : null;
}

function normalizeSystemTag(value: string) {
  const normalized = value.replace(/^#tag\s*/i, '').trim().toLowerCase();
  return normalized ? `#tag ${normalized}` : '';
}

function readSystemTags(settings: Record<string, unknown> | null | undefined) {
  const raw = settings?.systemTags;
  if (!Array.isArray(raw)) return [] as string[];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const normalized = normalizeSystemTag(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(normalized);
  }

  return tags;
}

function parseSystemTagsInput(value: string) {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const entry of value.split(/[\r\n,]+/)) {
    const normalized = normalizeSystemTag(entry);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(normalized);
  }

  return tags;
}

function readEditableByUser(page: unknown) {
  if (!page || typeof page !== 'object') return false;
  return Boolean((page as { editableByUser?: boolean }).editableByUser);
}

function parseNodePosition(position: unknown) {
  const fallback = defaultPosition;
  if (!position || typeof position !== 'object') return fallback;
  const candidate = position as {
    xs?: { x?: number; y?: number; w?: number; h?: number };
    sm?: { x?: number; y?: number; w?: number; h?: number };
    lg?: { x?: number; y?: number; w?: number; h?: number };
  };
  return {
    xs: {
      x: Number(candidate.xs?.x ?? fallback.xs.x),
      y: Number(candidate.xs?.y ?? fallback.xs.y),
      w: Number(candidate.xs?.w ?? fallback.xs.w),
      h: Number(candidate.xs?.h ?? fallback.xs.h)
    },
    sm: {
      x: Number(candidate.sm?.x ?? fallback.sm.x),
      y: Number(candidate.sm?.y ?? fallback.sm.y),
      w: Number(candidate.sm?.w ?? fallback.sm.w),
      h: Number(candidate.sm?.h ?? fallback.sm.h)
    },
    lg: {
      x: Number(candidate.lg?.x ?? fallback.lg.x),
      y: Number(candidate.lg?.y ?? fallback.lg.y),
      w: Number(candidate.lg?.w ?? fallback.lg.w),
      h: Number(candidate.lg?.h ?? fallback.lg.h)
    }
  };
}

function buildMiniLayoutsFromPage(
  page: { items?: Array<{ id: string; position: unknown }> } | null
) {
  if (!page) return { lg: [], sm: [], xs: [] };
  const base = (page.items ?? []).map((node) => {
    const position = parseNodePosition(node.position);
    return {
      i: node.id,
      x: position.lg.x,
      y: position.lg.y,
      w: position.lg.w,
      h: position.lg.h
    };
  });
  return {
    lg: base,
    sm: base.map((item) => ({ ...item, w: Math.min(item.w, 3) })),
    xs: base.map((item) => ({ ...item, w: Math.min(item.w, 2) }))
  };
}

export function ProductBuilderDashboard() {
  const utils = api.useUtils();
  const [section, setSection] = useState<Section>('users');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<
    'ADMIN' | 'INSTRUCTOR' | 'MEMBER'
  >('MEMBER');
  const [unlockEmail, setUnlockEmail] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedProductForAccess, setSelectedProductForAccess] = useState('');

  const [newProductTitle, setNewProductTitle] = useState('');
  const [newProductSubtitle, setNewProductSubtitle] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newProductType, setNewProductType] = useState<ProductType>('COURSE');
  const [createDemoCourseContent, setCreateDemoCourseContent] = useState(true);
  const [selectedModules, setSelectedModules] = useState<
    Record<ProductModuleType, boolean>
  >({
    LIBRARY: true,
    COURSE: true
  });
  const [libraryAllowDownloads, setLibraryAllowDownloads] = useState(true);
  const [librarySystemTagsDraft, setLibrarySystemTagsDraft] = useState<string | null>(null);
  const [courseLockSequential, setCourseLockSequential] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductEditorView, setSelectedProductEditorView] =
    useState<ProductEditorView>('builder');
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState('');
  const [editProductTitle, setEditProductTitle] = useState('');
  const [editProductSubtitle, setEditProductSubtitle] = useState('');
  const [editProductDescription, setEditProductDescription] = useState('');
  const [editProductType, setEditProductType] = useState<ProductType>('COURSE');
  const [newFeatureName, setNewFeatureName] = useState('');
  const [isEditFeatureModalOpen, setIsEditFeatureModalOpen] = useState(false);
  const [editingFeatureId, setEditingFeatureId] = useState('');
  const [editFeatureTitle, setEditFeatureTitle] = useState('');
  const [editFeatureDescription, setEditFeatureDescription] = useState('');
  const [editFeatureVisible, setEditFeatureVisible] = useState(true);
  const [selectedFeatureEditorId, setSelectedFeatureEditorId] = useState<string>(
    STANDALONE_COURSE_EDITOR_ID
  );
  const [selectedStepEditorId, setSelectedStepEditorId] = useState('');
  const [newStepName, setNewStepName] = useState('');
  const [newStepDescription, setNewStepDescription] = useState('');
  const [newStepRequired, setNewStepRequired] = useState(true);
  const [newStepLocked, setNewStepLocked] = useState(true);
  const [newAssetTitle, setNewAssetTitle] = useState('');
  const [newAssetUrl, setNewAssetUrl] = useState('');
  const [newAssetType, setNewAssetType] = useState<ProductAssetType>('LINK');
  const [newAssetStepId, setNewAssetStepId] = useState('');
  const [newAssetDownloadable, setNewAssetDownloadable] = useState(false);
  const [assetFeedback, setAssetFeedback] = useState('');
  const [newFeatureDescription, setNewFeatureDescription] = useState('');
  const [isEditStepModalOpen, setIsEditStepModalOpen] = useState(false);
  const [editingStepId, setEditingStepId] = useState('');
  const [editStepTitle, setEditStepTitle] = useState('');
  const [editStepDescription, setEditStepDescription] = useState('');
  const [editStepRequired, setEditStepRequired] = useState(true);
  const [editStepLocked, setEditStepLocked] = useState(false);

  const [selectedPageId, setSelectedPageId] = useState('');
  const [selectedPageNameDraft, setSelectedPageNameDraft] = useState('');
  const [selectedParentForChildrenId, setSelectedParentForChildrenId] =
    useState<string | null>(null);
  const [
    selectedPageEditableByUserOverride,
    setSelectedPageEditableByUserOverride
  ] = useState<boolean | null>(null);
  const [miniLayouts, setMiniLayouts] = useState<{
    lg: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    sm: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    xs: Array<{ i: string; x: number; y: number; w: number; h: number }>;
  }>(() => buildMiniLayoutsFromPage(null));
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [nodeSortOrder, setNodeSortOrder] = useState('0');
  const [nodePropsText, setNodePropsText] = useState('{}');
  const [selectedProductForNode, setSelectedProductForNode] = useState('');
  const [selectedStepForNode, setSelectedStepForNode] = useState('');
  const [themeDraft, setThemeDraft] = useState<TenantTheme | null>(null);

  const membersQuery = api.users.listMembers.useQuery();
  const joinRequestsQuery = api.users.listJoinRequests.useQuery();
  const invitesQuery = api.tenants.listInvites.useQuery();
  const productAccessesQuery = api.users.listProductAccesses.useQuery();
  const productsQuery = api.products.list.useQuery();
  const tenantModuleCatalogQuery = api.products.tenantModuleCatalog.useQuery();
  const pagesQuery = api.nodePages.list.useQuery();
  const currentTenantQuery = api.tenants.current.useQuery(undefined, {
    retry: false
  });
  const selectedProductDetailsQuery = api.products.byId.useQuery(
    { productId: selectedProductId },
    { enabled: Boolean(selectedProductId) }
  );

  const selectedPage = useMemo(
    () =>
      (pagesQuery.data ?? []).find((page) => page.id === selectedPageId) ??
      null,
    [pagesQuery.data, selectedPageId]
  );
  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);
  const selectedPageEditableByUser =
    selectedPageEditableByUserOverride ?? readEditableByUser(selectedPage);
  const rootPages = useMemo(
    () =>
      pages
        .filter((page) => !page.parentPageId)
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            a.name.localeCompare(b.name)
        ),
    [pages]
  );
  const pagesById = useMemo(
    () => new Map(pages.map((page) => [page.id, page])),
    [pages]
  );
  const pagesByParent = useMemo(() => {
    const grouped = new Map<string | null, typeof pages>();
    grouped.set(null, rootPages);
    for (const page of pages) {
      if (!page.parentPageId) continue;
      const list = grouped.get(page.parentPageId) ?? [];
      list.push(page);
      grouped.set(page.parentPageId, list);
    }
    for (const [key, list] of grouped) {
      grouped.set(
        key,
        [...list].sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            a.name.localeCompare(b.name)
        )
      );
    }
    return grouped;
  }, [pages, rootPages]);
  const structureSelectedId =
    selectedParentForChildrenId ?? selectedPageId ?? null;
  const structurePathIds = useMemo(() => {
    if (!structureSelectedId) return [] as string[];
    const path: string[] = [];
    let cursor = pagesById.get(structureSelectedId) ?? null;
    while (cursor) {
      path.unshift(cursor.id);
      cursor = cursor.parentPageId
        ? (pagesById.get(cursor.parentPageId) ?? null)
        : null;
    }
    return path;
  }, [pagesById, structureSelectedId]);
  const selectedProduct = useMemo(
    () =>
      (productsQuery.data ?? []).find(
        (product) => product.id === selectedProductId
      ) ?? null,
    [productsQuery.data, selectedProductId]
  );
  const selectedProductDetails = selectedProductDetailsQuery.data;
  const selectedProductDetailsData = selectedProductDetails as
    | {
        steps?: ProductStepRecord[];
        assets?: ProductAssetRecord[];
        features?: ProductFeatureRecord[];
        moduleConfigs?: ProductModuleConfigRecord[];
      }
    | undefined;
  const selectedProductSteps = selectedProductDetailsData?.steps ?? [];
  const selectedProductAssets = selectedProductDetailsData?.assets ?? [];
  const selectedProductFeatures = selectedProductDetailsData?.features ?? [];
  const selectedProductModuleConfigs =
    selectedProductDetailsData?.moduleConfigs ?? [];
  const selectedProductEnabledModules = useMemo(
    () =>
      new Set(
        selectedProductModuleConfigs
          .filter((entry) => entry.isEnabled)
          .map((entry) => entry.moduleType as ProductModuleType)
      ),
    [selectedProductModuleConfigs]
  );
  const selectedFeature = useMemo(
    () =>
      selectedProductFeatures.find(
        (feature) => feature.id === selectedFeatureEditorId
      ) ?? null,
    [selectedFeatureEditorId, selectedProductFeatures]
  );
  const isStandaloneCourseEditor =
    selectedFeatureEditorId === STANDALONE_COURSE_EDITOR_ID;
  const canEditStandaloneCourse =
    selectedProductEnabledModules.has('COURSE') || selectedProduct?.type === 'COURSE';
  const scopedSteps = useMemo(
    () =>
      selectedProductSteps
        .filter((step) =>
          isStandaloneCourseEditor
            ? !step.featureId
            : step.featureId === selectedFeature?.id
        )
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [isStandaloneCourseEditor, selectedFeature?.id, selectedProductSteps]
  );
  const scopedAssets = useMemo(
    () =>
      selectedProductAssets
        .filter((asset) =>
          isStandaloneCourseEditor
            ? !asset.featureId
            : asset.featureId === selectedFeature?.id
        )
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [isStandaloneCourseEditor, selectedFeature?.id, selectedProductAssets]
  );
  const selectedScopedStep = useMemo(
    () => scopedSteps.find((step) => step.id === selectedStepEditorId) ?? null,
    [scopedSteps, selectedStepEditorId]
  );
  const selectedStepAssets = useMemo(
    () =>
      selectedScopedStep
        ? scopedAssets.filter((asset) => asset.stepId === selectedScopedStep.id)
        : [],
    [scopedAssets, selectedScopedStep]
  );
  const scopedLooseAssets = useMemo(
    () => scopedAssets.filter((asset) => !asset.stepId),
    [scopedAssets]
  );
  const tenantModuleCatalog = useMemo(
    () => tenantModuleCatalogQuery.data ?? [],
    [tenantModuleCatalogQuery.data]
  );
  const enabledModulesForTenant = useMemo(
    () =>
      new Set(
        tenantModuleCatalog
          .filter((entry) => entry.isEnabled)
          .map((entry) => entry.moduleType as ProductModuleType)
      ),
    [tenantModuleCatalog]
  );
  const libraryTenantModule = useMemo(
    () =>
      tenantModuleCatalog.find(
        (entry) => entry.moduleType === 'LIBRARY'
      ) as
        | {
            moduleType: 'LIBRARY';
            isEnabled: boolean;
            settings?: Record<string, unknown> | null;
          }
        | undefined,
    [tenantModuleCatalog]
  );
  const librarySystemTagsValue = useMemo(
    () =>
      librarySystemTagsDraft ??
      readSystemTags(libraryTenantModule?.settings).join('\n'),
    [librarySystemTagsDraft, libraryTenantModule]
  );
  const availableFeatureBlueprints = useMemo(() => {
    if (!selectedProduct) return [] as FeatureBlueprint[];
    const existingTitles = new Set(
      selectedProductFeatures.map((feature) => feature.title.trim().toLowerCase())
    );
    return FEATURE_BLUEPRINTS[selectedProduct.type].filter((blueprint) => {
      if (existingTitles.has(blueprint.title.trim().toLowerCase())) return false;
      if (!blueprint.moduleType) return true;
      return (
        enabledModulesForTenant.has(blueprint.moduleType) &&
        selectedProductEnabledModules.has(blueprint.moduleType)
      );
    });
  }, [
    enabledModulesForTenant,
    selectedProduct,
    selectedProductEnabledModules,
    selectedProductFeatures
  ]);
  const tenantTheme = useMemo(
    () => readTenantTheme(currentTenantQuery.data?.tenant?.settings),
    [currentTenantQuery.data?.tenant?.settings]
  );
  const editedTheme = themeDraft ?? tenantTheme;

  const inviteMutation = api.tenants.inviteByEmail.useMutation({
    onSuccess: async () => {
      setInviteEmail('');
      await Promise.all([
        utils.tenants.listInvites.invalidate(),
        utils.users.listJoinRequests.invalidate()
      ]);
    }
  });
  const unlockMutation = api.tenants.unlockByEmail.useMutation({
    onSuccess: async () => {
      setUnlockEmail('');
      await Promise.all([
        utils.tenants.listInvites.invalidate(),
        utils.users.listMembers.invalidate()
      ]);
    }
  });
  const grantAccessMutation = api.users.grantProductAccess.useMutation({
    onSuccess: async () => {
      await utils.users.listProductAccesses.invalidate();
    }
  });

  const createProductMutation = api.products.create.useMutation({
    onSuccess: async (product) => {
      setNewProductTitle('');
      setNewProductSubtitle('');
      setNewProductDescription('');
      setSelectedProductId(product.id);
      await utils.products.list.invalidate();
    }
  });
  const updateProductMutation = api.products.update.useMutation({
    onSuccess: async () => {
      setIsEditProductModalOpen(false);
      await Promise.all([
        utils.products.list.invalidate(),
        selectedProductId
          ? utils.products.byId.invalidate({ productId: selectedProductId })
          : Promise.resolve()
      ]);
    }
  });
  const updateTenantModuleCapabilityMutation =
    api.products.updateTenantModuleCapability.useMutation({
      onSuccess: async () => {
        setLibrarySystemTagsDraft(null);
        await utils.products.tenantModuleCatalog.invalidate();
      }
    });
  const createDemoCourseContentMutation =
    api.products.createDemoCourseContent.useMutation({
      onSuccess: async () => {
        await utils.products.byId.invalidate();
      }
    });
  const createDummyUploadMutation = api.uploads.createDummyUpload.useMutation();
  const createFeatureMutation = api.productFeatures.create.useMutation({
    onSuccess: async (feature) => {
      setNewFeatureName('');
      setNewFeatureDescription('');
      setSelectedFeatureEditorId(feature.id);
      await utils.products.byId.invalidate();
    }
  });
  const updateFeatureMutation = api.productFeatures.update.useMutation({
    onSuccess: async () => {
      setIsEditFeatureModalOpen(false);
      await utils.products.byId.invalidate();
    }
  });
  const removeFeatureMutation = api.productFeatures.remove.useMutation({
    onSuccess: async () => {
      setIsEditFeatureModalOpen(false);
      await utils.products.byId.invalidate();
    }
  });
  const createStepMutation = api.productSteps.create.useMutation({
    onSuccess: async () => {
      setNewStepName('');
      setNewStepDescription('');
      setNewStepRequired(true);
      setNewStepLocked(true);
      await utils.products.byId.invalidate();
    }
  });
  const updateStepMutation = api.productSteps.update.useMutation({
    onSuccess: async () => {
      await utils.products.byId.invalidate();
    }
  });
  const removeStepMutation = api.productSteps.removeStep.useMutation({
    onSuccess: async () => {
      setSelectedStepEditorId('');
      await utils.products.byId.invalidate();
    }
  });
  const createAssetMutation = api.productSteps.createAsset.useMutation({
    onSuccess: async () => {
      setNewAssetTitle('');
      setNewAssetUrl('');
      setNewAssetDownloadable(false);
      setAssetFeedback('Asset/link added successfully.');
      await utils.products.byId.invalidate();
    }
  });
  const removeAssetMutation = api.productSteps.removeAsset.useMutation({
    onSuccess: async () => {
      await utils.products.byId.invalidate();
    }
  });

  const upsertPageMutation = api.nodePages.upsertPage.useMutation({
    onSuccess: async () => {
      await utils.nodePages.list.invalidate();
    }
  });
  const removePageMutation = api.nodePages.removePage.useMutation({
    onSuccess: async () => {
      setSelectedPageId('');
      setSelectedPageEditableByUserOverride(null);
      setMiniLayouts(buildMiniLayoutsFromPage(null));
      await utils.nodePages.list.invalidate();
    }
  });
  const addNodeMutation = api.nodePages.addNode.useMutation({
    onSuccess: async () => {
      await utils.nodePages.list.invalidate();
    }
  });
  const removeNodeMutation = api.nodePages.removeNode.useMutation({
    onSuccess: async () => {
      setSelectedNodeId('');
      await utils.nodePages.list.invalidate();
    }
  });
  const updateNodeMutation = api.nodePages.updateNode.useMutation({
    onSuccess: async () => {
      await utils.nodePages.list.invalidate();
    }
  });
  const updateThemeMutation = api.tenants.updateTheme.useMutation({
    onSuccess: async () => {
      setThemeDraft(null);
      await utils.tenants.current.invalidate();
    }
  });

  const saveMiniGridLayout = async () => {
    if (!selectedPage) return;
    const byId = new Map(miniLayouts.lg.map((entry) => [entry.i, entry]));
    const updates = (selectedPage.items ?? [])
      .map((node) => {
        const position = byId.get(node.id);
        if (!position) return null;
        return updateNodeMutation.mutateAsync({
          nodeId: node.id,
          position: {
            xs: { ...position, w: Math.min(position.w, 2) },
            sm: { ...position, w: Math.min(position.w, 3) },
            lg: { ...position }
          }
        });
      })
      .filter(Boolean) as Array<Promise<unknown>>;

    if (!updates.length) return;
    await Promise.all(updates);
  };

  const selectPage = (pageId: string) => {
    const next = pages.find((page) => page.id === pageId) ?? null;
    setSelectedPageId(pageId);
    setSelectedPageNameDraft(next?.name ?? '');
    setSelectedPageEditableByUserOverride(next ? readEditableByUser(next) : null);
    setMiniLayouts(buildMiniLayoutsFromPage(next));
  };

  const buildAutoNewPageIdentity = () => {
    const existing = new Set(
      pages.map((page) => page.slug.replace(/^\/+|\/+$/g, ''))
    );
    let index = 0;
    let slug = 'new-page';
    while (existing.has(slug)) {
      index += 1;
      slug = `new-page${index}`;
    }
    return {
      slug,
      name: index === 0 ? 'New page' : `New page ${index}`
    };
  };

  const createPage = async (parentPageId?: string) => {
    const identity = buildAutoNewPageIdentity();
    const created = await upsertPageMutation.mutateAsync({
      name: identity.name,
      slug: identity.slug,
      parentPageId,
      requiresAuth: true,
      editableByUser: false,
      internalRoute: false,
      indexable: true,
      hidden: false,
      sortOrder: 10
    });

    await pagesQuery.refetch();
    setSelectedPageId(created.id);
    setSelectedPageNameDraft(created.name);
    setSelectedPageEditableByUserOverride(
      Boolean((created as { editableByUser?: boolean }).editableByUser)
    );
    setMiniLayouts(buildMiniLayoutsFromPage({ items: [] }));
  };

  const renderBranchRows = (parentId: string | null, depth = 0) => {
    const levelItems = pagesByParent.get(parentId) ?? [];
    if (!levelItems.length) return null;

    const selectedAtThisLevel = structurePathIds[depth] ?? null;
    const selectedNode = selectedAtThisLevel
      ? (pagesById.get(selectedAtThisLevel) ?? null)
      : null;
    const selectedChildren = selectedNode
      ? (pagesByParent.get(selectedNode.id) ?? [])
      : [];
    const noChildrenAtSelectedLevel =
      Boolean(selectedAtThisLevel) &&
      selectedChildren.length === 0 &&
      selectedParentForChildrenId === selectedAtThisLevel;

    return (
      <div className="mt-2" style={{ marginLeft: depth * 14 }}>
        <div className="flex flex-wrap items-center gap-2">
          {levelItems.map((page) => {
            const hasChildren = (pagesByParent.get(page.id)?.length ?? 0) > 0;
            const isSelectedInTree = selectedAtThisLevel === page.id;
            return (
              <div key={page.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedParentForChildrenId(page.id);
                    selectPage(page.id);
                  }}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    isSelectedInTree ? 'bg-white text-black' : 'bg-white/10 text-zinc-200 hover:bg-white/20'
                  }`}
                >
                  {page.name}
                </button>
              </div>
            );
          })}
          <button
            type="button"
            disabled={upsertPageMutation.isPending}
            onClick={() => void createPage(parentId ?? undefined)}
            className="rounded-full border border-dashed border-lime-400 bg-lime-500/10 px-3 py-2 text-xs font-bold text-lime-300 hover:bg-lime-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
        </div>

        {noChildrenAtSelectedLevel ? (
          <div className="mt-1 ml-3 border-l border-white/20 pl-3">
            {selectedAtThisLevel ? (
              <button
                type="button"
                disabled={upsertPageMutation.isPending}
                onClick={() => void createPage(selectedAtThisLevel)}
                className="mt-2 aspect-square rounded-full border border-dashed border-sky-400 bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-300 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                +
              </button>
            ) : null}
          </div>
        ) : null}

        {selectedNode && selectedChildren.length > 0
          ? renderBranchRows(selectedNode.id, depth + 1)
          : null}
      </div>
    );
  };

  const selectedPageHasChanges = Boolean(
    selectedPage &&
    (selectedPageNameDraft.trim() !== selectedPage.name ||
      selectedPageEditableByUser !== readEditableByUser(selectedPage))
  );
  const openEditProductModal = (productId: string) => {
    const target =
      (productsQuery.data ?? []).find((product) => product.id === productId) ?? null;
    if (!target) return;
    setEditingProductId(productId);
    setEditProductTitle(target.name);
    setEditProductSubtitle(
      (target as { subtitle?: string | null }).subtitle ?? ''
    );
    setEditProductDescription(target.description ?? '');
    setEditProductType(target.type as ProductType);
    setIsEditProductModalOpen(true);
  };
  const openEditFeatureModal = (feature: {
    id: string;
    title: string;
    description?: string | null;
    isVisible: boolean;
  }) => {
    setEditingFeatureId(feature.id);
    setEditFeatureTitle(feature.title);
    setEditFeatureDescription(feature.description ?? '');
    setEditFeatureVisible(feature.isVisible);
    setIsEditFeatureModalOpen(true);
  };
  const openEditStepModal = (step: ProductStepRecord) => {
    setEditingStepId(step.id);
    setSelectedStepEditorId(step.id);
    setEditStepTitle(step.title);
    setEditStepDescription(step.description ?? '');
    setEditStepRequired(step.isRequired);
    setEditStepLocked(step.lockUntilComplete);
  };
  const pendingJoinCount =
    (joinRequestsQuery.data?.pendingInvites.length ?? 0) +
    (joinRequestsQuery.data?.pendingMemberships.length ?? 0);
  const inputClass =
    'h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60';
  const selectClass =
    'h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60';

  useEffect(() => {
    if (!selectedProductId) {
      setSelectedFeatureEditorId(STANDALONE_COURSE_EDITOR_ID);
      setSelectedStepEditorId('');
      return;
    }
    if (
      selectedFeatureEditorId !== STANDALONE_COURSE_EDITOR_ID &&
      !selectedProductFeatures.some((feature) => feature.id === selectedFeatureEditorId)
    ) {
      setSelectedFeatureEditorId(
        canEditStandaloneCourse
          ? STANDALONE_COURSE_EDITOR_ID
          : (selectedProductFeatures[0]?.id ?? STANDALONE_COURSE_EDITOR_ID)
      );
    }
  }, [
    canEditStandaloneCourse,
    selectedFeatureEditorId,
    selectedProductFeatures,
    selectedProductId
  ]);

  useEffect(() => {
    if (!selectedProduct) return;
    setEditProductTitle(selectedProduct.name);
    setEditProductSubtitle(
      (selectedProduct as { subtitle?: string | null }).subtitle ?? ''
    );
    setEditProductDescription(selectedProduct.description ?? '');
    setEditProductType(selectedProduct.type as ProductType);
  }, [selectedProduct]);

  useEffect(() => {
    if (!scopedSteps.length) {
      setSelectedStepEditorId('');
      return;
    }
    if (!scopedSteps.some((step) => step.id === selectedStepEditorId)) {
      const firstStep = scopedSteps[0];
      if (!firstStep) return;
      setSelectedStepEditorId(firstStep.id);
      setEditingStepId(firstStep.id);
      setEditStepTitle(firstStep.title);
      setEditStepDescription(firstStep.description ?? '');
      setEditStepRequired(firstStep.isRequired);
      setEditStepLocked(firstStep.lockUntilComplete);
    }
  }, [scopedSteps, selectedStepEditorId]);

  useEffect(() => {
    if (!scopedSteps.some((step) => step.id === newAssetStepId)) {
      setNewAssetStepId('');
    }
  }, [newAssetStepId, scopedSteps]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{membersQuery.data?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{productsQuery.data?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{pages.length}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Pending Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{pendingJoinCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Owner panel
          </p>
          {(
            [
              { key: 'users' as const, label: 'Users', icon: Users },
              { key: 'products' as const, label: 'Products', icon: Box },
              { key: 'pages' as const, label: 'Pages', icon: FileStack }
            ] satisfies Array<{ key: Section; label: string; icon: typeof Users }>
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={`mb-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  section === item.key
                    ? 'border-indigo-500/60 bg-indigo-500/15 text-white'
                    : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-950'
                }`}
                onClick={() => setSection(item.key)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </aside>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        {section === 'users' ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Users</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-white/10 bg-black/40 p-3">
                <p className="mb-2 text-sm font-medium">Invite new users</p>
                <input
                  className="h-9 w-full rounded border border-white/20 bg-black px-2 text-xs"
                  placeholder="email@company.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
                <select
                  className="mt-2 h-9 w-full rounded border border-white/20 bg-black px-2 text-xs"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(
                      event.target.value as 'ADMIN' | 'INSTRUCTOR' | 'MEMBER'
                    )
                  }
                >
                  <option value="MEMBER">Member</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button
                  className="mt-2 h-9 w-full rounded bg-indigo-500 text-xs font-semibold text-black disabled:opacity-50"
                  onClick={() =>
                    inviteMutation.mutate({
                      email: inviteEmail,
                      role: inviteRole
                    })
                  }
                  disabled={!inviteEmail || inviteMutation.isPending}
                  type="button"
                >
                  Send invite
                </button>
              </div>
              <div className="rounded-md border border-white/10 bg-black/40 p-3">
                <p className="mb-2 text-sm font-medium">
                  Unlock specific email
                </p>
                <input
                  className="h-9 w-full rounded border border-white/20 bg-black px-2 text-xs"
                  placeholder="email@company.com"
                  value={unlockEmail}
                  onChange={(event) => setUnlockEmail(event.target.value)}
                />
                <button
                  className="mt-2 h-9 w-full rounded bg-cyan-500 text-xs font-semibold text-black disabled:opacity-50"
                  onClick={() =>
                    unlockMutation.mutate({
                      email: unlockEmail,
                      role: inviteRole
                    })
                  }
                  disabled={!unlockEmail || unlockMutation.isPending}
                  type="button"
                >
                  Unlock
                </button>
              </div>
            </div>

            <div className="rounded-md border border-white/10 bg-black/40 p-3">
              <p className="mb-2 text-sm font-medium">
                Join requests / invite queue
              </p>
              <ul className="space-y-1 text-xs text-zinc-300">
                {(joinRequestsQuery.data?.pendingInvites ?? []).map(
                  (invite) => (
                    <li key={invite.id}>
                      invite: {invite.email} - {invite.role} - {invite.status}
                    </li>
                  )
                )}
                {(joinRequestsQuery.data?.pendingMemberships ?? []).map(
                  (req) => (
                    <li key={req.id}>
                      request: {req.user.email ?? req.user.id} - {req.role}
                    </li>
                  )
                )}
                {!joinRequestsQuery.data?.pendingInvites.length &&
                !joinRequestsQuery.data?.pendingMemberships.length ? (
                  <li>No pending requests.</li>
                ) : null}
              </ul>
            </div>

            <div className="rounded-md border border-white/10 bg-black/40 p-3">
              <p className="mb-2 text-sm font-medium">Give product access</p>
              <div className="grid gap-2 md:grid-cols-3">
                <select
                  className="h-9 rounded border border-white/20 bg-black px-2 text-xs"
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                >
                  <option value="">Select user...</option>
                  {(membersQuery.data ?? []).map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.user.email ?? member.userId}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded border border-white/20 bg-black px-2 text-xs"
                  value={selectedProductForAccess}
                  onChange={(event) =>
                    setSelectedProductForAccess(event.target.value)
                  }
                >
                  <option value="">Select product...</option>
                  {(productsQuery.data ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <button
                  className="h-9 rounded bg-emerald-500 text-xs font-semibold text-black disabled:opacity-50"
                  onClick={() =>
                    grantAccessMutation.mutate({
                      userId: selectedMemberId,
                      productId: selectedProductForAccess,
                      canView: true,
                      canDownload: true,
                      canEditProgress: false
                    })
                  }
                  disabled={
                    !selectedMemberId ||
                    !selectedProductForAccess ||
                    grantAccessMutation.isPending
                  }
                  type="button"
                >
                  Grant access
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                {(productAccessesQuery.data ?? []).slice(0, 8).map((access) => (
                  <li key={access.id}>
                    {access.user.email ?? access.userId} {'->'}{' '}
                    {access.product.name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-white/10 bg-black/40 p-3">
              <p className="mb-2 text-sm font-medium">Current users</p>
              <ul className="space-y-1 text-xs text-zinc-300">
                {(membersQuery.data ?? []).map((member) => (
                  <li key={member.id}>
                    {member.user.email ?? member.userId} - {member.role} -{' '}
                    {member.status}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {section === 'products' ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Products</h2>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="mb-3 text-sm font-medium">Register a richer product</p>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className={inputClass}
                  placeholder="Title"
                  value={newProductTitle}
                  onChange={(event) => setNewProductTitle(event.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Subtitle"
                  value={newProductSubtitle}
                  onChange={(event) => setNewProductSubtitle(event.target.value)}
                />
                <textarea
                  className="h-24 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 md:col-span-2"
                  placeholder="Description"
                  value={newProductDescription}
                  onChange={(event) => setNewProductDescription(event.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['COURSE', 'Course'],
                      ['PHYSICAL_PRODUCT', 'Physical'],
                      ['DIGITAL_PRODUCT', 'Digital'],
                      ['SERVICE', 'Service'],
                      ['CUSTOM', 'Custom']
                    ] as Array<[ProductType, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNewProductType(value)}
                      className={`h-10 rounded-md border px-3 text-xs font-semibold transition ${
                        newProductType === value
                          ? 'border-indigo-500 bg-indigo-500/20 text-white'
                          : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={createDemoCourseContent}
                    onChange={(event) =>
                      setCreateDemoCourseContent(event.target.checked)
                    }
                  />
                  Add demo course content on create
                </label>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {([
                  {
                    moduleType: 'LIBRARY' as const,
                    title: 'Library module',
                    hint: 'Images, videos, PDFs, files, and links in one listing.'
                  },
                  {
                    moduleType: 'COURSE' as const,
                    title: 'Course module',
                    hint: 'Step progression with mixed assets.'
                  }
                ] as const).map((entry) => {
                  const tenantEnabled = enabledModulesForTenant.has(entry.moduleType);
                  return (
                    <label
                      key={entry.moduleType}
                      className={`rounded-md border p-3 text-xs ${
                        tenantEnabled
                          ? 'border-zinc-800 bg-zinc-950/70 text-zinc-200'
                          : 'border-zinc-900 bg-zinc-950/40 text-zinc-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={!tenantEnabled}
                          checked={
                            tenantEnabled && selectedModules[entry.moduleType]
                          }
                          onChange={(event) =>
                            setSelectedModules((prev) => ({
                              ...prev,
                              [entry.moduleType]: event.target.checked
                            }))
                          }
                        />
                        <span className="font-semibold">{entry.title}</span>
                      </div>
                      <p className="mt-1">{entry.hint}</p>
                      {!tenantEnabled ? (
                        <p className="mt-1 text-[10px]">Disabled for this tenant.</p>
                      ) : null}
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={libraryAllowDownloads}
                    onChange={(event) => setLibraryAllowDownloads(event.target.checked)}
                  />
                  Library assets can be downloadable
                </label>
                <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={courseLockSequential}
                    onChange={(event) => setCourseLockSequential(event.target.checked)}
                  />
                  Sequential course progression
                </label>
              </div>

              <Button
                className="mt-4 h-10 w-full border-emerald-500/20 bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                onClick={() =>
                  createProductMutation.mutate({
                    title: newProductTitle,
                    subtitle: newProductSubtitle || undefined,
                    description: newProductDescription || undefined,
                    type: newProductType,
                    isFree: true,
                    isVisible: true,
                    galleryOnly: !selectedModules.LIBRARY,
                    lockSequentialSteps: courseLockSequential,
                    currency: 'USD',
                    createDemoCourseContent:
                      createDemoCourseContent && selectedModules.COURSE,
                    modules: [
                      {
                        moduleType: 'LIBRARY',
                        isEnabled: selectedModules.LIBRARY,
                        sortOrder: 1,
                        settings: {
                          allowedAssetTypes: ['VIDEO', 'PDF', 'IMAGE', 'LINK', 'FILE'],
                          allowDownloads: libraryAllowDownloads
                        }
                      },
                      {
                        moduleType: 'COURSE',
                        isEnabled: selectedModules.COURSE,
                        sortOrder: 2,
                        settings: {
                          lockSequentialSteps: courseLockSequential,
                          includeTextContent: true
                        }
                      }
                    ]
                  })
                }
                disabled={!newProductTitle || createProductMutation.isPending}
                type="button"
              >
                Register product
              </Button>
              {createProductMutation.error ? (
                <p className="mt-2 text-xs text-red-300">
                  {createProductMutation.error.message}
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="mb-2 text-sm font-medium">Tenant module capabilities</p>
              <div className="grid gap-2 md:grid-cols-3">
                {tenantModuleCatalog.map((moduleEntry) => (
                  <Button
                    key={moduleEntry.moduleType}
                    className={`h-10 text-xs ${
                      moduleEntry.isEnabled
                        ? 'border-green-500/30 bg-green-500/80 text-black hover:bg-green-400'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                    }`}
                    disabled={updateTenantModuleCapabilityMutation.isPending}
                    onClick={() =>
                      updateTenantModuleCapabilityMutation.mutate({
                        moduleType: moduleEntry.moduleType,
                        isEnabled: !moduleEntry.isEnabled,
                        settings: moduleEntry.settings as Record<string, unknown>
                      })
                    }
                    type="button"
                  >
                    {moduleEntry.label}: {moduleEntry.isEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-zinc-800 bg-black/20 p-3">
                <label className="block text-xs font-medium text-zinc-200">
                  Hidden library system tags
                </label>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Added by tenant config, returned with library items for future filtering, and
                  not rendered to end users.
                </p>
                <textarea
                  value={librarySystemTagsValue}
                  onChange={(event) => setLibrarySystemTagsDraft(event.target.value)}
                  placeholder="#tag featured&#10;#tag premium"
                  className="mt-3 min-h-24 w-full rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-100 outline-none transition focus:border-zinc-600"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-zinc-500">
                    One tag per line or comma separated.
                  </p>
                  <Button
                    type="button"
                    className="h-9 border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
                    disabled={
                      updateTenantModuleCapabilityMutation.isPending || !libraryTenantModule
                    }
                    onClick={() => {
                      if (!libraryTenantModule) return;
                      updateTenantModuleCapabilityMutation.mutate({
                        moduleType: 'LIBRARY',
                        isEnabled: libraryTenantModule.isEnabled,
                        settings: {
                          ...(libraryTenantModule.settings ?? {}),
                          systemTags: parseSystemTagsInput(librarySystemTagsValue)
                        }
                      });
                    }}
                  >
                    Save hidden tags
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="mb-3 text-sm font-medium">Product list</p>
              <div className="grid gap-2 md:grid-cols-2">
                {(productsQuery.data ?? []).map((product) => {
                  const active = selectedProductId === product.id;
                  return (
                    <div
                      key={product.id}
                      className={`rounded-md border p-3 ${
                        active
                          ? 'border-indigo-500/60 bg-indigo-500/10'
                          : 'border-zinc-800 bg-zinc-950/70'
                      }`}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setSelectedProductId(product.id)}
                      >
                        <p className="text-sm font-semibold text-zinc-100">{product.name}</p>
                        {(product as { subtitle?: string | null }).subtitle ? (
                          <p className="mt-1 text-xs text-zinc-400">
                            {(product as { subtitle?: string | null }).subtitle}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-zinc-500">{product.type}</p>
                      </button>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          className="h-8 border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 hover:bg-zinc-800"
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setSelectedProductEditorView('settings');
                          }}
                        >
                          Settings
                        </Button>
                        <Button
                          type="button"
                          className="h-8 border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 hover:bg-zinc-800"
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setSelectedProductEditorView('builder');
                          }}
                        >
                          Builder
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {!productsQuery.data?.length ? (
                  <p className="text-xs text-zinc-500">No products yet.</p>
                ) : null}
              </div>
            </div>

            {selectedProduct ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Product workspace
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-white">
                        {selectedProduct.name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        A clearer builder for this{' '}
                        {PRODUCT_TYPE_LABELS[selectedProduct.type].toLowerCase()}.
                        Choose the product area first, then edit steps, then manage assets
                        inside each step.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex rounded-xl border border-zinc-800 bg-black/30 p-1">
                        {(
                          [
                            ['builder', 'Builder'],
                            ['settings', 'Settings']
                          ] as Array<[ProductEditorView, string]>
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setSelectedProductEditorView(value)}
                            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                              selectedProductEditorView === value
                                ? 'bg-white text-black'
                                : 'text-zinc-300 hover:bg-white/10'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-300">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Features
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {selectedProductFeatures.length}
                          </p>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-300">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Steps
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {selectedProductSteps.length}
                          </p>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-300">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Assets
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {selectedProductAssets.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedProductEditorView === 'settings' ? (
                  <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
                      <div className="mb-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                          Product settings
                        </p>
                        <h4 className="mt-1 text-lg font-semibold text-white">
                          Core product details
                        </h4>
                        <p className="mt-1 text-sm text-zinc-400">
                          Keep naming, description, and product type in one place instead
                          of hiding them behind a modal.
                        </p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          className={inputClass}
                          value={editProductTitle}
                          onChange={(event) => setEditProductTitle(event.target.value)}
                          placeholder="Title"
                        />
                        <input
                          className={inputClass}
                          value={editProductSubtitle}
                          onChange={(event) => setEditProductSubtitle(event.target.value)}
                          placeholder="Subtitle"
                        />
                        <textarea
                          className="h-28 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 md:col-span-2"
                          value={editProductDescription}
                          onChange={(event) =>
                            setEditProductDescription(event.target.value)
                          }
                          placeholder="Description"
                        />
                        <div className="grid grid-cols-2 gap-2 md:col-span-2">
                          {(
                            [
                              ['COURSE', 'Course'],
                              ['PHYSICAL_PRODUCT', 'Physical'],
                              ['DIGITAL_PRODUCT', 'Digital'],
                              ['SERVICE', 'Service'],
                              ['CUSTOM', 'Custom']
                            ] as Array<[ProductType, string]>
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setEditProductType(value)}
                              className={`h-10 rounded-md border px-3 text-xs font-semibold transition ${
                                editProductType === value
                                  ? 'border-indigo-500 bg-indigo-500/20 text-white'
                                  : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-900'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          type="button"
                          className="h-10 border-emerald-500/30 bg-emerald-500 px-4 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                          disabled={!editProductTitle.trim() || updateProductMutation.isPending}
                          onClick={() =>
                            updateProductMutation.mutate({
                              productId: selectedProduct.id,
                              title: editProductTitle.trim(),
                              subtitle: editProductSubtitle.trim() || undefined,
                              description: editProductDescription.trim() || undefined,
                              type: editProductType
                            })
                          }
                        >
                          Save product details
                        </Button>
                        <Button
                          type="button"
                          className="h-10 border-zinc-700 bg-zinc-900 px-4 text-xs text-zinc-200 hover:bg-zinc-800"
                          onClick={() => setSelectedProductEditorView('builder')}
                        >
                          Back to builder
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <p className="text-sm font-medium text-white">
                          Product module status
                        </p>
                        <ul className="mt-3 space-y-2 text-xs text-zinc-300">
                          {selectedProductModuleConfigs.map((moduleConfig) => (
                            <li
                              key={moduleConfig.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/30 px-3 py-3"
                            >
                              <span>{moduleConfig.moduleType}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                                  moduleConfig.isEnabled
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                {moduleConfig.isEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-indigo-300" />
                          <p className="text-sm font-medium text-white">
                            Course tools
                          </p>
                        </div>
                        <div className="mt-3 space-y-2">
                          <Button
                            className="h-10 w-full border-indigo-500/30 bg-indigo-500 text-xs font-semibold text-black hover:bg-indigo-400 disabled:opacity-50"
                            type="button"
                            disabled={
                              createDemoCourseContentMutation.isPending ||
                              !canEditStandaloneCourse
                            }
                            onClick={() =>
                              createDemoCourseContentMutation.mutate({
                                productId: selectedProduct.id
                              })
                            }
                          >
                            Generate demo standalone course content
                          </Button>
                          {!canEditStandaloneCourse ? (
                            <p className="text-xs text-amber-300">
                              Enable the course module for a richer lesson editor.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                    <div className="space-y-4">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-indigo-300" />
                          <p className="text-sm font-medium text-white">
                            Add feature
                          </p>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Start with a suggested feature or create a custom one.
                        </p>
                        <div className="mt-3 space-y-2">
                          {availableFeatureBlueprints.map((blueprint) => (
                            <button
                              key={blueprint.key}
                              type="button"
                              disabled={createFeatureMutation.isPending}
                              onClick={() =>
                                createFeatureMutation.mutate({
                                  productId: selectedProduct.id,
                                  title: blueprint.title,
                                  description: blueprint.description,
                                  sortOrder: selectedProductFeatures.length + 1,
                                  metadata: {
                                    templateKey: blueprint.key,
                                    productType: selectedProduct.type,
                                    moduleType: blueprint.moduleType ?? null
                                  }
                                })
                              }
                              className="w-full rounded-lg border border-zinc-800 bg-black/30 p-3 text-left transition hover:border-indigo-500/50 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-zinc-100">
                                  {blueprint.title}
                                </span>
                                {blueprint.moduleType ? (
                                  <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                                    {MODULE_LABELS[blueprint.moduleType]}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-zinc-400">
                                {blueprint.description}
                              </p>
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 space-y-2 border-t border-zinc-800 pt-4">
                          <input
                            className={inputClass}
                            placeholder="Custom feature name"
                            value={newFeatureName}
                            onChange={(event) => setNewFeatureName(event.target.value)}
                          />
                          <textarea
                            className="h-20 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                            placeholder="Custom feature description"
                            value={newFeatureDescription}
                            onChange={(event) =>
                              setNewFeatureDescription(event.target.value)
                            }
                          />
                          <Button
                            className="h-10 w-full border-blue-500/30 bg-blue-500 text-xs font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
                            type="button"
                            disabled={
                              !newFeatureName.trim() || createFeatureMutation.isPending
                            }
                            onClick={() =>
                              createFeatureMutation.mutate({
                                productId: selectedProduct.id,
                                title: newFeatureName.trim(),
                                description: newFeatureDescription.trim() || undefined,
                                sortOrder: selectedProductFeatures.length + 1,
                                metadata: { productType: selectedProduct.type }
                              })
                            }
                          >
                            Add custom feature
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <p className="text-sm font-medium text-white">
                          Product outline
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          Choose the area to edit, then manage its steps on the right.
                        </p>
                        <div className="mt-3 space-y-2">
                          {canEditStandaloneCourse ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedFeatureEditorId(
                                  STANDALONE_COURSE_EDITOR_ID
                                )
                              }
                              className={`w-full rounded-lg border p-3 text-left transition ${
                                isStandaloneCourseEditor
                                  ? 'border-fuchsia-500/60 bg-fuchsia-500/10'
                                  : 'border-zinc-800 bg-black/30 hover:border-zinc-700 hover:bg-black/40'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-fuchsia-300" />
                                  <span className="text-sm font-semibold text-zinc-100">
                                    Standalone course
                                  </span>
                                </div>
                                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                                  Product
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-400">
                                Lessons that belong to the whole product.
                              </p>
                            </button>
                          ) : null}

                          {selectedProductFeatures.map((feature) => {
                            const featureSteps = selectedProductSteps.filter(
                              (step) => step.featureId === feature.id
                            );
                            const featureModule = readFeatureModuleType(feature);
                            const isActive = selectedFeatureEditorId === feature.id;
                            return (
                              <div
                                key={feature.id}
                                className={`rounded-lg border p-3 transition ${
                                  isActive
                                    ? 'border-indigo-500/60 bg-indigo-500/10'
                                    : 'border-zinc-800 bg-black/30'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedFeatureEditorId(feature.id)}
                                    className="flex-1 text-left"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-zinc-100">
                                        {feature.title}
                                      </span>
                                      {!feature.isVisible ? (
                                        <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                                          Hidden
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-xs text-zinc-400">
                                      {feature.description ||
                                        'No feature description yet.'}
                                    </p>
                                  </button>
                                  <Button
                                    type="button"
                                    className="h-7 border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-200 hover:bg-zinc-800"
                                    onClick={() =>
                                      openEditFeatureModal({
                                        id: feature.id,
                                        title: feature.title,
                                        description: feature.description,
                                        isVisible: feature.isVisible
                                      })
                                    }
                                  >
                                    Edit
                                  </Button>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                                  <span className="rounded-full border border-zinc-800 px-2 py-1">
                                    {featureSteps.length} step
                                    {featureSteps.length === 1 ? '' : 's'}
                                  </span>
                                  {featureModule ? (
                                    <span className="rounded-full border border-zinc-800 px-2 py-1">
                                      {MODULE_LABELS[featureModule]}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                              Builder
                            </p>
                            <h4 className="mt-1 text-lg font-semibold text-white">
                              {isStandaloneCourseEditor
                                ? 'Standalone course'
                                : (selectedFeature?.title ?? 'Select a feature')}
                            </h4>
                            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                              {isStandaloneCourseEditor
                                ? canEditStandaloneCourse
                                  ? 'Each step now owns its own content and assets.'
                                  : 'Enable the course module on this product to manage standalone course content.'
                                : selectedFeature?.description ||
                                  'Select a feature to manage its step-based experience.'}
                            </p>
                          </div>
                          {!isStandaloneCourseEditor && selectedFeature ? (
                            <Button
                              type="button"
                              className="h-9 border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 hover:bg-zinc-800"
                              onClick={() =>
                                openEditFeatureModal({
                                  id: selectedFeature.id,
                                  title: selectedFeature.title,
                                  description: selectedFeature.description,
                                  isVisible: selectedFeature.isVisible
                                })
                              }
                            >
                              Edit feature settings
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                        <div className="space-y-4">
                          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                            <p className="mb-3 text-sm font-medium text-white">
                              New step
                            </p>
                            <div className="space-y-2">
                              <input
                                className={inputClass}
                                placeholder="Step name"
                                value={newStepName}
                                onChange={(event) =>
                                  setNewStepName(event.target.value)
                                }
                              />
                              <textarea
                                className="h-20 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                                placeholder="Step description"
                                value={newStepDescription}
                                onChange={(event) =>
                                  setNewStepDescription(event.target.value)
                                }
                              />
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                                  <input
                                    type="checkbox"
                                    checked={newStepRequired}
                                    onChange={(event) =>
                                      setNewStepRequired(event.target.checked)
                                    }
                                  />
                                  Required
                                </label>
                                <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                                  <input
                                    type="checkbox"
                                    checked={newStepLocked}
                                    onChange={(event) =>
                                      setNewStepLocked(event.target.checked)
                                    }
                                  />
                                  Locked
                                </label>
                              </div>
                              <Button
                                className="h-10 w-full border-fuchsia-500/30 bg-fuchsia-500 text-xs font-semibold text-black hover:bg-fuchsia-400 disabled:opacity-50"
                                type="button"
                                disabled={
                                  !newStepName.trim() ||
                                  createStepMutation.isPending ||
                                  (!selectedFeature && !isStandaloneCourseEditor) ||
                                  (isStandaloneCourseEditor && !canEditStandaloneCourse)
                                }
                                onClick={() =>
                                  createStepMutation.mutate({
                                    productId: selectedProduct.id,
                                    featureId: isStandaloneCourseEditor
                                      ? undefined
                                      : (selectedFeature?.id ?? undefined),
                                    title: newStepName.trim(),
                                    description:
                                      newStepDescription.trim() || undefined,
                                    sortOrder: scopedSteps.length + 1,
                                    lockUntilComplete: newStepLocked,
                                    isRequired: newStepRequired
                                  })
                                }
                              >
                                Add step
                              </Button>
                            </div>
                          </div>

                          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                            <p className="mb-3 text-sm font-medium text-white">
                              Steps in this editor
                            </p>
                            <div className="space-y-2">
                              {scopedSteps.map((step, index) => (
                                <button
                                  key={step.id}
                                  type="button"
                                  onClick={() => openEditStepModal(step)}
                                  className={`w-full rounded-lg border p-3 text-left transition ${
                                    selectedStepEditorId === step.id
                                      ? 'border-emerald-500/60 bg-emerald-500/10'
                                      : 'border-zinc-800 bg-black/30 hover:border-zinc-700 hover:bg-black/40'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                                        Step {index + 1}
                                      </p>
                                      <p className="mt-1 text-sm font-semibold text-zinc-100">
                                        {step.title}
                                      </p>
                                      <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                                        {step.description ||
                                          'No step description yet.'}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 text-[10px] text-zinc-400">
                                      <span>{step.isRequired ? 'Required' : 'Optional'}</span>
                                      <span>{step.lockUntilComplete ? 'Locked' : 'Open'}</span>
                                    </div>
                                  </div>
                                </button>
                              ))}
                              {!scopedSteps.length ? (
                                <div className="rounded-lg border border-dashed border-zinc-800 bg-black/20 p-3 text-xs text-zinc-500">
                                  Add the first step to start building this flow.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {selectedScopedStep ? (
                            <>
                              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                      Step editor
                                    </p>
                                    <h5 className="mt-1 text-lg font-semibold text-white">
                                      {selectedScopedStep.title}
                                    </h5>
                                  </div>
                                  <Button
                                    type="button"
                                    className="h-9 border-red-500/30 bg-red-500/80 px-3 text-xs font-semibold text-black hover:bg-red-400 disabled:opacity-50"
                                    disabled={removeStepMutation.isPending}
                                    onClick={() =>
                                      removeStepMutation.mutate({
                                        stepId: selectedScopedStep.id
                                      })
                                    }
                                  >
                                    Remove step
                                  </Button>
                                </div>

                                <div className="mt-4 grid gap-3">
                                  <input
                                    className={inputClass}
                                    value={editStepTitle}
                                    onChange={(event) =>
                                      setEditStepTitle(event.target.value)
                                    }
                                    placeholder="Step title"
                                  />
                                  <textarea
                                    className="h-28 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                                    value={editStepDescription}
                                    onChange={(event) =>
                                      setEditStepDescription(event.target.value)
                                    }
                                    placeholder="Describe what happens in this step"
                                  />
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                                      <input
                                        type="checkbox"
                                        checked={editStepRequired}
                                        onChange={(event) =>
                                          setEditStepRequired(event.target.checked)
                                        }
                                      />
                                      Required
                                    </label>
                                    <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                                      <input
                                        type="checkbox"
                                        checked={editStepLocked}
                                        onChange={(event) =>
                                          setEditStepLocked(event.target.checked)
                                        }
                                      />
                                      Lock until complete
                                    </label>
                                  </div>
                                  <Button
                                    type="button"
                                    className="h-10 border-emerald-500/30 bg-emerald-500 px-4 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                                    disabled={!editStepTitle.trim() || updateStepMutation.isPending}
                                    onClick={() =>
                                      updateStepMutation.mutate({
                                        stepId: selectedScopedStep.id,
                                        title: editStepTitle.trim(),
                                        description:
                                          editStepDescription.trim() || null,
                                        isRequired: editStepRequired,
                                        lockUntilComplete: editStepLocked
                                      })
                                    }
                                  >
                                    Save step
                                  </Button>
                                </div>
                              </div>

                              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      Step assets
                                    </p>
                                    <p className="mt-1 text-xs text-zinc-400">
                                      Add resources directly inside the selected step.
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
                                    {selectedStepAssets.length} asset
                                    {selectedStepAssets.length === 1 ? '' : 's'}
                                  </span>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
                                  <div className="space-y-2">
                                    <input
                                      className={inputClass}
                                      placeholder="Asset title"
                                      value={newAssetTitle}
                                      onChange={(event) =>
                                        setNewAssetTitle(event.target.value)
                                      }
                                    />
                                    <input
                                      className={inputClass}
                                      placeholder="https://your-link-or-file-url"
                                      value={newAssetUrl}
                                      onChange={(event) =>
                                        setNewAssetUrl(event.target.value)
                                      }
                                    />
                                    <div className="grid grid-cols-3 gap-2">
                                      {(
                                        [
                                          'LINK',
                                          'VIDEO',
                                          'PDF',
                                          'IMAGE',
                                          'FILE'
                                        ] as ProductAssetType[]
                                      ).map((assetType) => (
                                        <button
                                          key={assetType}
                                          type="button"
                                          onClick={() => setNewAssetType(assetType)}
                                          className={`h-8 rounded border px-2 text-[11px] font-semibold transition ${
                                            newAssetType === assetType
                                              ? 'border-indigo-500 bg-indigo-500/20 text-white'
                                              : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-900'
                                          }`}
                                        >
                                          {assetType}
                                        </button>
                                      ))}
                                    </div>
                                    <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                                      <input
                                        type="checkbox"
                                        checked={newAssetDownloadable}
                                        onChange={(event) =>
                                          setNewAssetDownloadable(
                                            event.target.checked
                                          )
                                        }
                                      />
                                      Downloadable asset
                                    </label>
                                    <Button
                                      className="h-10 w-full border-emerald-500/30 bg-emerald-500 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                                      type="button"
                                      disabled={
                                        !newAssetTitle.trim() ||
                                        !newAssetUrl.trim() ||
                                        createAssetMutation.isPending
                                      }
                                      onClick={async () => {
                                        setAssetFeedback('');
                                        try {
                                          await createAssetMutation.mutateAsync({
                                            productId: selectedProduct.id,
                                            featureId: isStandaloneCourseEditor
                                              ? undefined
                                              : (selectedFeature?.id ?? undefined),
                                            stepId: selectedScopedStep.id,
                                            moduleType: 'COURSE',
                                            placement: 'STEP',
                                            title: newAssetTitle.trim(),
                                            type: newAssetType,
                                            url: newAssetUrl.trim(),
                                            interactionMode:
                                              newAssetType === 'LINK'
                                                ? 'LINK'
                                                : newAssetDownloadable
                                                  ? 'DOWNLOAD'
                                                  : 'OPEN',
                                            isDownloadable: newAssetDownloadable,
                                            sortOrder: selectedStepAssets.length + 1
                                          });
                                        } catch (error) {
                                          setAssetFeedback(
                                            error instanceof Error
                                              ? error.message
                                              : 'Could not create asset/link.'
                                          );
                                        }
                                      }}
                                    >
                                      Add asset to step
                                    </Button>
                                    {assetFeedback ? (
                                      <p className="text-[11px] text-zinc-300">
                                        {assetFeedback}
                                      </p>
                                    ) : null}
                                  </div>

                                  <div className="space-y-2">
                                    {selectedStepAssets.map((asset) => (
                                      <div
                                        key={asset.id}
                                        className="rounded-lg border border-zinc-800 bg-black/30 p-3"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-zinc-100">
                                              [{asset.type}] {asset.title}
                                            </p>
                                            <p className="mt-1 truncate text-xs text-zinc-400">
                                              {asset.url}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {asset.isDownloadable ? (
                                              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                                            ) : null}
                                            <Button
                                              type="button"
                                              className="h-7 border-red-500/30 bg-red-500/80 px-2 text-[11px] font-semibold text-black hover:bg-red-400 disabled:opacity-50"
                                              disabled={removeAssetMutation.isPending}
                                              onClick={() =>
                                                removeAssetMutation.mutate({
                                                  assetId: asset.id
                                                })
                                              }
                                            >
                                              Remove
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    {!selectedStepAssets.length ? (
                                      <div className="rounded-lg border border-dashed border-zinc-800 bg-black/20 p-3 text-xs text-zinc-500">
                                        No assets attached to this step yet.
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              {scopedLooseAssets.length ? (
                                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                                  <p className="text-sm font-medium text-white">
                                    Unattached assets
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-400">
                                    These assets belong to this editor but are not attached
                                    to a step yet.
                                  </p>
                                  <div className="mt-3 space-y-2">
                                    {scopedLooseAssets.map((asset) => (
                                      <div
                                        key={asset.id}
                                        className="rounded-lg border border-zinc-800 bg-black/30 p-3"
                                      >
                                        <p className="text-sm font-semibold text-zinc-100">
                                          [{asset.type}] {asset.title}
                                        </p>
                                        <p className="mt-1 truncate text-xs text-zinc-400">
                                          {asset.url}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-sm text-zinc-500">
                              Select a step from the left to edit its details and assets.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {isEditProductModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-100">Edit product</p>
                <button
                  type="button"
                  onClick={() => setIsEditProductModalOpen(false)}
                  className="rounded border border-zinc-700 p-1 text-zinc-300 hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className={inputClass}
                  value={editProductTitle}
                  onChange={(event) => setEditProductTitle(event.target.value)}
                  placeholder="Title"
                />
                <input
                  className={inputClass}
                  value={editProductSubtitle}
                  onChange={(event) => setEditProductSubtitle(event.target.value)}
                  placeholder="Subtitle"
                />
                <textarea
                  className="h-24 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 md:col-span-2"
                  value={editProductDescription}
                  onChange={(event) => setEditProductDescription(event.target.value)}
                  placeholder="Description"
                />
                <div className="grid grid-cols-2 gap-2 md:col-span-2">
                  {(
                    [
                      ['COURSE', 'Course'],
                      ['PHYSICAL_PRODUCT', 'Physical'],
                      ['DIGITAL_PRODUCT', 'Digital'],
                      ['SERVICE', 'Service'],
                      ['CUSTOM', 'Custom']
                    ] as Array<[ProductType, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEditProductType(value)}
                      className={`h-10 rounded-md border px-3 text-xs font-semibold transition ${
                        editProductType === value
                          ? 'border-indigo-500 bg-indigo-500/20 text-white'
                          : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  className="h-9 border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setIsEditProductModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-9 border-emerald-500/30 bg-emerald-500 px-3 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                  disabled={!editProductTitle.trim() || updateProductMutation.isPending}
                  onClick={() =>
                    updateProductMutation.mutate({
                      productId: editingProductId,
                      title: editProductTitle.trim(),
                      subtitle: editProductSubtitle.trim() || undefined,
                      description: editProductDescription.trim() || undefined,
                      type: editProductType
                    })
                  }
                >
                  Save product
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {isEditFeatureModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-100">Edit feature</p>
                <button
                  type="button"
                  onClick={() => setIsEditFeatureModalOpen(false)}
                  className="rounded border border-zinc-700 p-1 text-zinc-300 hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <input
                  className={inputClass}
                  value={editFeatureTitle}
                  onChange={(event) => setEditFeatureTitle(event.target.value)}
                  placeholder="Feature title"
                />
                <textarea
                  className="h-24 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                  value={editFeatureDescription}
                  onChange={(event) => setEditFeatureDescription(event.target.value)}
                  placeholder="Feature description"
                />
                <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={editFeatureVisible}
                    onChange={(event) => setEditFeatureVisible(event.target.checked)}
                  />
                  Feature visible to tenant users
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  className="h-9 border-red-500/30 bg-red-500/80 px-3 text-xs font-semibold text-black hover:bg-red-400 disabled:opacity-50"
                  disabled={removeFeatureMutation.isPending}
                  onClick={() =>
                    removeFeatureMutation.mutate({
                      featureId: editingFeatureId
                    })
                  }
                >
                  Remove feature
                </Button>
                <Button
                  type="button"
                  className="h-9 border-emerald-500/30 bg-emerald-500 px-3 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                  disabled={!editFeatureTitle.trim() || updateFeatureMutation.isPending}
                  onClick={() =>
                    updateFeatureMutation.mutate({
                      featureId: editingFeatureId,
                      title: editFeatureTitle.trim(),
                      description: editFeatureDescription.trim() || null,
                      isVisible: editFeatureVisible
                    })
                  }
                >
                  Save feature
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {isEditStepModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-100">Edit step</p>
                <button
                  type="button"
                  onClick={() => setIsEditStepModalOpen(false)}
                  className="rounded border border-zinc-700 p-1 text-zinc-300 hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <input
                  className={inputClass}
                  value={editStepTitle}
                  onChange={(event) => setEditStepTitle(event.target.value)}
                  placeholder="Step title"
                />
                <textarea
                  className="h-24 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                  value={editStepDescription}
                  onChange={(event) => setEditStepDescription(event.target.value)}
                  placeholder="Step description"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={editStepRequired}
                      onChange={(event) => setEditStepRequired(event.target.checked)}
                    />
                    Required
                  </label>
                  <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={editStepLocked}
                      onChange={(event) => setEditStepLocked(event.target.checked)}
                    />
                    Lock until complete
                  </label>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  className="h-9 border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setIsEditStepModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-9 border-emerald-500/30 bg-emerald-500 px-3 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                  disabled={!editStepTitle.trim() || updateStepMutation.isPending}
                  onClick={() =>
                    updateStepMutation.mutate({
                      stepId: editingStepId,
                      title: editStepTitle.trim(),
                      description: editStepDescription.trim() || null,
                      isRequired: editStepRequired,
                      lockUntilComplete: editStepLocked
                    })
                  }
                >
                  Save step
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {section === 'pages' ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Pages</h2>
            <p className="text-xs text-zinc-300">
              Home and Dashboard are locked system pages. You can create child
              pages and edit node visualization.
            </p>

            <div className="rounded-md border border-white/10 bg-black/40 p-3">
              <p className="mb-2 text-sm font-medium">Navigation replica</p>
              {renderBranchRows(null)}
            </div>

            {selectedPage ? (
              <div className="rounded-md border border-white/10 bg-black/40 p-3">
                <p className="mb-2 text-sm font-medium">
                  Visual editor for {selectedPage.name} (
                  {selectedPage.slug || '/'})
                </p>
                <div className="mb-3 grid gap-2 md:grid-cols-4">
                  <input
                    className="h-9 rounded border border-white/20 bg-black px-2 text-xs"
                    value={selectedPageNameDraft}
                    onChange={(event) =>
                      setSelectedPageNameDraft(event.target.value)
                    }
                  />
                  <label className="flex h-9 items-center gap-2 rounded border border-white/20 bg-black px-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedPageEditableByUser}
                      onChange={(event) =>
                        setSelectedPageEditableByUserOverride(
                          event.target.checked
                        )
                      }
                    />
                    Page editable by user
                  </label>
                  {selectedPageHasChanges ? (
                    <button
                      type="button"
                      className="h-9 rounded bg-emerald-500 text-xs font-semibold text-black disabled:opacity-50"
                      disabled={
                        selectedPage.isSystem || upsertPageMutation.isPending
                      }
                      onClick={() =>
                        upsertPageMutation.mutate({
                          pageId: selectedPage.id,
                          name: selectedPageNameDraft.trim() || 'New page',
                          slug: toPageSlug(selectedPageNameDraft),
                          description: selectedPage.description ?? undefined,
                          parentPageId: selectedPage.parentPageId ?? undefined,
                          requiresAuth: selectedPage.requiresAuth,
                          editableByUser: selectedPageEditableByUser,
                          internalRoute: selectedPage.internalRoute,
                          indexable: selectedPage.indexable,
                          hidden: selectedPage.hidden,
                          sortOrder: selectedPage.sortOrder
                        })
                      }
                    >
                      Save page settings
                    </button>
                  ) : (
                    <div className="flex h-9 items-center rounded border border-white/10 px-2 text-[11px] text-zinc-500">
                      No changes
                    </div>
                  )}
                  <Link
                    className="flex h-9 items-center justify-center rounded bg-white/10 text-xs"
                    href={slugPath(selectedPage.slug) as any}
                  >
                    Open page
                  </Link>
                  {!selectedPage.isSystem ? (
                    <button
                      className="h-9 rounded bg-red-500/80 px-2 py-1 text-xs font-semibold text-black"
                      onClick={() =>
                        removePageMutation.mutate({ pageId: selectedPage.id })
                      }
                      type="button"
                    >
                      Remove page
                    </button>
                  ) : (
                    <div className="flex h-9 items-center rounded border border-white/10 px-2 text-[11px] text-zinc-400">
                      System pages cannot be edited/removed.
                    </div>
                  )}
                </div>

                <div className="mb-3 rounded border border-white/10 bg-black/50 p-2">
                  <p className="mb-2 text-xs font-medium text-zinc-300">
                    Mini layout editor (React Grid)
                  </p>
                  <MiniResponsiveGridLayout
                    className="layout"
                    layouts={miniLayouts}
                    breakpoints={{ lg: 1024, sm: 640, xs: 0 }}
                    cols={{ lg: 6, sm: 3, xs: 2 }}
                    rowHeight={18}
                    margin={[8, 8]}
                    onLayoutChange={(_, allLayouts) => {
                      const lg = (allLayouts.lg ?? []) as Array<{
                        i: string;
                        x: number;
                        y: number;
                        w: number;
                        h: number;
                      }>;
                      setMiniLayouts({
                        lg,
                        sm: lg.map((item) => ({
                          ...item,
                          w: Math.min(item.w, 3)
                        })),
                        xs: lg.map((item) => ({
                          ...item,
                          w: Math.min(item.w, 2)
                        }))
                      });
                    }}
                  >
                    {(selectedPage.items ?? []).map((node) => {
                      const layoutEntry = miniLayouts.lg.find(
                        (entry) => entry.i === node.id
                      );
                      const position =
                        layoutEntry ?? parseNodePosition(node.position).lg;
                      return (
                        <div
                          key={node.id}
                          data-grid={{
                            x: position.x,
                            y: position.y,
                            w: position.w,
                            h: position.h,
                            minW: 1,
                            minH: 2
                          }}
                          className="rounded border border-white/10 bg-zinc-900/80 p-1 text-[10px]"
                        >
                          <p className="truncate font-semibold">{node.type}</p>
                          <p className="truncate text-zinc-400">
                            {node.nodeKey}
                          </p>
                        </div>
                      );
                    })}
                  </MiniResponsiveGridLayout>
                  <button
                    type="button"
                    className="mt-2 h-8 rounded bg-indigo-500 px-3 text-[11px] font-semibold text-black disabled:opacity-50"
                    disabled={updateNodeMutation.isPending}
                    onClick={saveMiniGridLayout}
                  >
                    Save mini layout
                  </button>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <select
                    className="h-9 rounded border border-white/20 bg-black px-2 text-xs"
                    value={selectedProductForNode}
                    onChange={(event) =>
                      setSelectedProductForNode(event.target.value)
                    }
                  >
                    <option value="">Select product...</option>
                    {(productsQuery.data ?? []).map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded border border-white/20 bg-black px-2 text-xs"
                    value={selectedStepForNode}
                    onChange={(event) =>
                      setSelectedStepForNode(event.target.value)
                    }
                  >
                    <option value="">Select step...</option>
                    {selectedProductSteps.map((step) => (
                      <option key={step.id} value={step.id}>
                        {step.title}
                      </option>
                    ))}
                  </select>
                  <button
                    className="h-9 rounded bg-amber-400 text-xs font-semibold text-black disabled:opacity-50"
                    onClick={() =>
                      addNodeMutation.mutate({
                        pageId: selectedPage.id,
                        nodeKey: `product-node-${Date.now()}`,
                        type: 'node-product',
                        productId: selectedProductForNode || undefined,
                        props: { productId: selectedProductForNode },
                        position: defaultPosition,
                        sortOrder: Number(nodeSortOrder || '0')
                      })
                    }
                    disabled={
                      !selectedProductForNode || addNodeMutation.isPending
                    }
                    type="button"
                  >
                    Add product node
                  </button>
                  <button
                    className="h-9 rounded bg-sky-400 text-xs font-semibold text-black disabled:opacity-50 md:col-span-3"
                    onClick={() =>
                      addNodeMutation.mutate({
                        pageId: selectedPage.id,
                        nodeKey: `step-node-${Date.now()}`,
                        type: 'node-course-step',
                        productId: selectedProductForNode || undefined,
                        stepId: selectedStepForNode || undefined,
                        props: {
                          productId: selectedProductForNode,
                          stepId: selectedStepForNode
                        },
                        position: defaultPosition,
                        sortOrder: Number(nodeSortOrder || '0') + 1
                      })
                    }
                    disabled={
                      !selectedProductForNode ||
                      !selectedStepForNode ||
                      addNodeMutation.isPending
                    }
                    type="button"
                  >
                    Add course step node
                  </button>
                  <button
                    className="h-9 rounded bg-emerald-400 text-xs font-semibold text-black disabled:opacity-50 md:col-span-3"
                    onClick={() =>
                      addNodeMutation.mutate({
                        pageId: selectedPage.id,
                        nodeKey: `step-viewer-node-${Date.now()}`,
                        type: 'node-step-viewer',
                        productId: selectedProductForNode || undefined,
                        props: {
                          productId: selectedProductForNode,
                          title: 'Course steps'
                        },
                        position: {
                          xs: { x: 0, y: 0, w: 2, h: 18 },
                          sm: { x: 0, y: 0, w: 3, h: 18 },
                          lg: { x: 0, y: 0, w: 5, h: 18 }
                        },
                        sortOrder: Number(nodeSortOrder || '0') + 2
                      })
                    }
                    disabled={!selectedProductForNode || addNodeMutation.isPending}
                    type="button"
                  >
                    Add step viewer node
                  </button>
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <input
                    className="h-9 rounded border border-white/20 bg-black px-2 text-xs"
                    placeholder="Sort order"
                    value={nodeSortOrder}
                    onChange={(event) => setNodeSortOrder(event.target.value)}
                  />
                  <textarea
                    className="h-20 rounded border border-white/20 bg-black px-2 py-1 text-xs"
                    value={nodePropsText}
                    onChange={(event) => setNodePropsText(event.target.value)}
                  />
                </div>

                <ul className="mt-3 space-y-1 text-xs text-zinc-300">
                  {(selectedPage.items ?? []).map((node) => (
                    <li
                      key={node.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedNodeId(node.id)}
                      >
                        {node.nodeKey} [{node.type}]
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded bg-violet-500/80 px-2 py-1 text-[10px] font-semibold text-black"
                          onClick={() => {
                            let parsed: Record<string, unknown> = {};
                            try {
                              parsed = JSON.parse(nodePropsText) as Record<
                                string,
                                unknown
                              >;
                            } catch {
                              parsed = {};
                            }
                            updateNodeMutation.mutate({
                              nodeId: node.id,
                              sortOrder: Number(nodeSortOrder || '0'),
                              props: parsed
                            });
                          }}
                        >
                          update
                        </button>
                        <button
                          type="button"
                          className="rounded bg-red-500/80 px-2 py-1 text-[10px] font-semibold text-black"
                          onClick={() =>
                            removeNodeMutation.mutate({ nodeId: node.id })
                          }
                        >
                          remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {selectedNodeId ? (
                  <p className="mt-2 text-[11px] text-zinc-400">
                    selected node: {selectedNodeId}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-md border border-white/10 bg-black/40 p-3">
              <p className="mb-2 text-sm font-medium">Tenant theme (10 colors)</p>
              <div className="grid gap-2 md:grid-cols-5">
                {TENANT_THEME_FIELDS.map((field) => (
                  <label key={field.key} className="text-xs">
                    {field.label}
                    <input
                      className="mt-1 h-9 w-full rounded border border-white/20 bg-black px-2"
                      type="color"
                      value={editedTheme[field.key]}
                      onChange={(event) =>
                        setThemeDraft((prev) => ({
                          ...(prev ?? tenantTheme),
                          [field.key]: event.target.value
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                className="mt-3 h-9 rounded bg-orange-500 px-4 text-xs font-semibold text-black disabled:opacity-50"
                onClick={() =>
                  updateThemeMutation.mutate({
                    ...editedTheme
                  })
                }
                disabled={updateThemeMutation.isPending}
                type="button"
              >
                Save tenant theme
              </button>
            </div>
          </div>
        ) : null}
      </section>
      </div>
    </div>
  );
}
