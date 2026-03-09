import type { Session } from "next-auth";

import type { PagesConfig, Preset, PresetItem } from "~/app/_nodes/schemas";
import { db } from "~/server/db";

function normalizeSlug(slug: string) {
  return slug.replace(/^\/+|\/+$/g, "");
}

function keyFromSlug(slug: string, fallback: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return fallback;
  return normalized.replace(/[^\w/.-]/g, "").replace(/[/.-]/g, "_");
}

function toPresetItem(input: {
  nodeKey: string;
  type: string;
  props: unknown;
  position: unknown;
}): PresetItem {
  const fallback = {
    xs: { x: 0, y: 0, w: 2, h: 6 },
    sm: { x: 0, y: 0, w: 3, h: 6 },
    lg: { x: 0, y: 0, w: 4, h: 6 },
  };

  const candidate =
    input.position && typeof input.position === "object" ? (input.position as any) : fallback;

  return {
    i: input.nodeKey,
    type: input.type,
    props:
      input.props && typeof input.props === "object"
        ? (input.props as Record<string, unknown>)
        : {},
    position: {
      xs: candidate.xs ?? fallback.xs,
      sm: candidate.sm ?? fallback.sm,
      lg: candidate.lg ?? fallback.lg,
    },
  };
}

export async function getTenantPagesConfig(
  session: Session | null,
): Promise<PagesConfig | null> {
  const tenantId = session?.user?.activeTenantId;
  if (!tenantId) return null;

  const pages = await db.tenantNodePage.findMany({
    where: { tenantId },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (!pages.length) return null;

  const byId = new Map<string, Preset>();
  const byParent = new Map<string, Array<{ id: string; sortOrder: number; slug: string }>>();

  for (const page of pages) {
    byId.set(page.id, {
      name: page.name,
      description: page.description ?? "",
      slug: page.slug,
      requiresAuth: page.requiresAuth,
      editableByUser: page.editableByUser,
      internalRoute: page.internalRoute,
      indexable: page.indexable,
      hidden: page.hidden,
      items: page.items.map((item) =>
        toPresetItem({
          nodeKey: item.nodeKey,
          type: item.type,
          props: item.props,
          position: item.position,
        }),
      ),
      children: {},
    });
    const parentKey = page.parentPageId ?? "__root__";
    const list = byParent.get(parentKey) ?? [];
    list.push({ id: page.id, sortOrder: page.sortOrder, slug: page.slug });
    byParent.set(parentKey, list);
  }

  const attachChildren = (parentId: string): Record<string, Preset> => {
    const children = (byParent.get(parentId) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
    );
    const result: Record<string, Preset> = {};
    for (const child of children) {
      const preset = byId.get(child.id);
      if (!preset) continue;
      preset.children = attachChildren(child.id);
      const childKey = keyFromSlug(child.slug, child.id);
      result[childKey] = preset;
    }
    return result;
  };

  const rootChildren = (byParent.get("__root__") ?? []).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
  );

  const presets: Record<string, Preset> = {};
  for (const root of rootChildren) {
    const preset = byId.get(root.id);
    if (!preset) continue;
    preset.children = attachChildren(root.id);
    presets[keyFromSlug(root.slug, root.id)] = preset;
  }

  return { presets };
}

export function resolveExistingPresetSlugFromConfig(
  config: PagesConfig,
  inputSlug: string,
): string | null {
  const target = normalizeSlug(inputSlug);
  const slugs = new Set<string>();
  const walk = (entries: Record<string, Preset>) => {
    for (const preset of Object.values(entries)) {
      slugs.add(normalizeSlug(preset.slug));
      if (preset.children) walk(preset.children);
    }
  };
  walk(config.presets);
  return slugs.has(target) ? target : null;
}

export function resolveDynamicRoutePolicyFromConfig(config: PagesConfig, inputSlug: string) {
  const target = normalizeSlug(inputSlug);
  let policy = {
    requiresAuth: false,
    internalRoute: false,
    indexable: true,
    hidden: false,
  };
  const walk = (entries: Record<string, Preset>) => {
    for (const preset of Object.values(entries)) {
      if (normalizeSlug(preset.slug) === target) {
        policy = {
          requiresAuth: Boolean(preset.requiresAuth),
          internalRoute: Boolean(preset.internalRoute),
          indexable: preset.indexable ?? true,
          hidden: Boolean(preset.hidden),
        };
      }
      if (preset.children) walk(preset.children);
    }
  };
  walk(config.presets);
  return policy;
}

export async function resolveTenantLibraryAssetRoute(
  session: Session | null,
  inputSlug: string,
) {
  const tenantId = session?.user?.activeTenantId;
  if (!tenantId) return null;

  const normalized = normalizeSlug(inputSlug);
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const assetId = segments[segments.length - 1] ?? "";
  const requestedPageSlug = segments.slice(0, -1).join("/");
  const isLegacyGalleryRoute = segments[0] === "galeria";
  if (!assetId) return null;

  const candidatePages = await db.tenantNodePage.findMany({
    where: {
      tenantId,
    },
    include: {
      items: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  let matchedProductId: string | null = null;
  let matchedPage = null as (typeof candidatePages)[number] | null;
  for (const page of candidatePages) {
    if (
      !isLegacyGalleryRoute &&
      normalizeSlug(page.slug) !== requestedPageSlug
    ) {
      continue;
    }

    for (const node of page.items) {
      const type = node.type.startsWith("node-") ? node.type.slice("node-".length) : node.type;
      if (type !== "library_view" && type !== "library-view") continue;
      const props =
        node.props && typeof node.props === "object"
          ? (node.props as Record<string, unknown>)
          : {};
      const assets = Array.isArray(props.assets) ? props.assets : [];
      const hasAsset = assets.some((asset) => {
        if (!asset || typeof asset !== "object") return false;
        return String((asset as Record<string, unknown>).id ?? "") === assetId;
      });
      const productId =
        typeof props.productId === "string"
          ? props.productId
          : node.productId ?? null;
      if (hasAsset && productId) {
        matchedProductId = productId;
        matchedPage = page;
        break;
      }
    }
    if (matchedProductId) break;
  }

  if (!matchedProductId || !matchedPage) return null;

  const asset = await db.productAsset.findFirst({
    where: {
      tenantId,
      id: assetId,
      productId: matchedProductId,
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
  });

  if (!asset) return null;

  const canonicalPageSlug = normalizeSlug(matchedPage.slug);
  const canonicalSlug = [canonicalPageSlug, assetId].filter(Boolean).join("/");

  return {
    pageSlug: canonicalPageSlug,
    canonicalSlug,
    isLegacyGalleryRoute,
    pageName: matchedPage.name,
    sourcePageSlug: matchedPage.slug,
    requiresAuth: matchedPage.requiresAuth,
    internalRoute: matchedPage.internalRoute,
    hidden: matchedPage.hidden,
    indexable: matchedPage.indexable,
    assetId,
    productId: matchedProductId,
    asset,
  };
}
