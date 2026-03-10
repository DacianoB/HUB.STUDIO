'use client';

import { useEffect, useMemo, useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';

import { TenantAppChrome } from '~/app/_components/tenant-app-chrome';
import { ComponentRegistry } from '~/app/_nodes/component-registry';
import componentsCatalog from '~/app/_nodes/components.json';
import { pagesConfig } from '~/app/_nodes/pages';
import type { PagesConfig, Preset } from '~/app/_nodes/schemas';
import { readTenantBranding } from '~/app/_nodes/tenant-theme';
import { LibraryAssetDetailPanel } from '~/app/library/library-asset-detail';
import { api } from '~/trpc/react';

const ResponsiveGridLayout = WidthProvider(Responsive);

type DynamicGridProps = {
  routePresetSlug?: string;
  isAuthenticated?: boolean;
  runtimePagesConfig?: PagesConfig;
  embeddedLibraryAsset?: {
    assetId: string;
    pageName: string;
    backHref: string;
    sourceNodeId?: string;
    asset?: Record<string, unknown>;
  };
  adminPreview?: {
    forcedBreakpoint: StoredLayoutBreakpoint;
    layoutOverrides: Record<StoredLayoutBreakpoint, GridLayoutItem[]>;
    onLayoutChange?: (
      breakpoint: StoredLayoutBreakpoint,
      layout: GridLayoutItem[]
    ) => void;
    selectedNodeId?: string;
    onSelectNode?: (nodeId: string) => void;
  };
};

type StoredLayoutBreakpoint = 'lg' | 'sm' | 'xs';
type GridLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};
type RuntimeItem = {
  i: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  props?: Record<string, unknown>;
  position?: Record<StoredLayoutBreakpoint, GridLayoutItem>;
};

type LibraryLayoutStyle = 'uniform' | 'masonry' | 'pinterest';
type LibraryRandomness = 'low' | 'medium' | 'high';
type LibraryAssetSnapshot = {
  id: string;
  title: string;
  url: string;
  type: string;
  targetUrl?: string | null;
  openInNewTab?: boolean | null;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
};
type LibraryItemLayout = {
  w: number[];
  h: number[];
};

type ComponentConfig = {
  name?: string;
  description?: string;
  tags?: string[];
  internal?: boolean;
  defaultLayout?: {
    w?: number[] | number;
    h?: number[] | number;
    minW?: number;
    minH?: number;
  };
};

const GRID_BREAKPOINTS = {
  xl: 1700,
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0
};
const GRID_COLS = { xl: 5, lg: 5, md: 4, sm: 3, xs: 2, xxs: 2 };
type FlatPreset = {
  key: string;
  name: string;
  description: string;
  slug: string;
  requiresAuth: boolean;
  editableByUser: boolean;
  hidden: boolean;
  internalRoute: boolean;
};

function normalizeSlug(slug: string) {
  return slug.replace(/^\/+|\/+$/g, '');
}

function logicalNodeType(type: string) {
  return type.startsWith('node-') ? type.slice('node-'.length) : type;
}

function isLibraryViewNodeType(type: string) {
  const logical = logicalNodeType(type);
  return logical === 'library_view' || logical === 'library-view';
}

function isTextNodeType(type: string) {
  return logicalNodeType(type) === 'text';
}

function readLibraryProductId(props?: Record<string, unknown>) {
  return typeof props?.productId === 'string' ? props.productId : '';
}

function toLibraryAssetSnapshot(
  asset: Record<string, unknown>
): LibraryAssetSnapshot {
  return {
    id: String(asset.id ?? ''),
    title: String(asset.title ?? ''),
    url: String(asset.url ?? ''),
    type: String(asset.type ?? 'FILE'),
    targetUrl: typeof asset.targetUrl === 'string' ? asset.targetUrl : null,
    openInNewTab:
      typeof asset.openInNewTab === 'boolean' ? asset.openInNewTab : null,
    previewUrl: typeof asset.previewUrl === 'string' ? asset.previewUrl : null,
    thumbnailUrl:
      typeof asset.thumbnailUrl === 'string' ? asset.thumbnailUrl : null
  };
}

function readLibraryLayoutStyle(
  props?: Record<string, unknown>
): LibraryLayoutStyle {
  const value = typeof props?.layoutStyle === 'string' ? props.layoutStyle : '';
  if (value === 'uniform' || value === 'masonry' || value === 'pinterest') {
    return value;
  }
  return 'pinterest';
}

function readLibraryRandomness(
  props?: Record<string, unknown>
): LibraryRandomness {
  const value = typeof props?.randomness === 'string' ? props.randomness : '';
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return 'medium';
}

function readLibraryAssets(
  props?: Record<string, unknown>
): LibraryAssetSnapshot[] {
  const raw = props?.assets;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (asset): asset is Record<string, unknown> =>
        Boolean(asset) && typeof asset === 'object'
    )
    .map((asset) => toLibraryAssetSnapshot(asset))
    .filter((asset) => Boolean(asset.id) && Boolean(asset.url));
}

function readLibraryItemLayout(
  props?: Record<string, unknown>
): LibraryItemLayout {
  const raw =
    props?.itemLayout && typeof props.itemLayout === 'object'
      ? (props.itemLayout as Record<string, unknown>)
      : {};
  const widths = Array.isArray(raw.w)
    ? raw.w
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];
  const heights = Array.isArray(raw.h)
    ? raw.h
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];
  return {
    w: widths.length ? widths : [1],
    h: heights.length ? heights : [6, 8, 10]
  };
}

function hashLibrarySeed(input: string) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) % 2147483647;
  }
  return value;
}

function buildLibraryHeightCandidates(
  baseHeight: number,
  layoutStyle: LibraryLayoutStyle,
  randomness: LibraryRandomness
) {
  const normalizedBase = Math.max(6, baseHeight || 8);
  const heightsByStyle: Record<LibraryLayoutStyle, number[]> = {
    uniform: [normalizedBase],
    masonry: [normalizedBase - 2, normalizedBase, normalizedBase + 2],
    pinterest: [
      normalizedBase - 2,
      normalizedBase,
      normalizedBase + 2,
      normalizedBase + 4
    ]
  };
  const allowedByRandomness: Record<LibraryRandomness, number> = {
    low: 2,
    medium: 3,
    high: 4
  };
  return heightsByStyle[layoutStyle]
    .slice(0, allowedByRandomness[randomness])
    .map((value) => Math.max(4, value));
}

function getStoredBreakpointKey(
  breakpoint: keyof typeof GRID_BREAKPOINTS | string
): StoredLayoutBreakpoint {
  if (breakpoint === 'xs' || breakpoint === 'xxs') return 'xs';
  if (breakpoint === 'sm') return 'sm';
  return 'lg';
}

function clampGridItem(position: GridLayoutItem, cols: number): GridLayoutItem {
  const w = Math.max(1, Math.min(position.w, cols));
  const x = Math.max(0, Math.min(position.x, Math.max(0, cols - w)));
  return {
    i: position.i,
    x,
    y: Math.max(0, position.y),
    w,
    h: Math.max(2, position.h)
  };
}

function toResponsiveLayouts(
  layouts: Record<StoredLayoutBreakpoint, GridLayoutItem[]>
) {
  return {
    xl: layouts.lg.map((item) => clampGridItem(item, GRID_COLS.xl)),
    lg: layouts.lg.map((item) => clampGridItem(item, GRID_COLS.lg)),
    md: layouts.lg.map((item) => clampGridItem(item, GRID_COLS.md)),
    sm: layouts.sm.map((item) => clampGridItem(item, GRID_COLS.sm)),
    xs: layouts.xs.map((item) => clampGridItem(item, GRID_COLS.xs)),
    xxs: layouts.xs.map((item) => clampGridItem(item, GRID_COLS.xxs))
  };
}

function filterStoredLayoutEntries(
  layout: Array<{ i: string; x: number; y: number; w: number; h: number }>,
  allowedIds: Set<string>
) {
  return layout
    .filter((entry) => allowedIds.has(entry.i))
    .map((entry) => ({
      i: entry.i,
      x: entry.x,
      y: entry.y,
      w: entry.w,
      h: entry.h
    }));
}

function expandLibraryViewItems(
  items: RuntimeItem[],
  sourcePageSlug?: string,
  liveAssetsByProductId?: Map<string, LibraryAssetSnapshot[]>,
  breakpoint: StoredLayoutBreakpoint = 'lg',
  layoutById?: Map<string, GridLayoutItem>,
  embeddedLibraryAsset?: DynamicGridProps['embeddedLibraryAsset']
) {
  const regularItems: RuntimeItem[] = [];
  const librarySources: RuntimeItem[] = [];
  const normalizedSourcePageSlug = normalizeSlug(sourcePageSlug ?? '');
  const activeCols =
    breakpoint === 'lg'
      ? GRID_COLS.lg
      : breakpoint === 'sm'
        ? GRID_COLS.sm
        : GRID_COLS.xs;
  const detailWidth =
    breakpoint === 'lg'
      ? Math.max(3, activeCols - 2)
      : breakpoint === 'sm'
        ? Math.max(2, activeCols - 1)
        : activeCols;
  const detailHeight = breakpoint === 'lg' ? 20 : breakpoint === 'sm' ? 22 : 20;

  for (const item of items) {
    if (isLibraryViewNodeType(item.type)) {
      librarySources.push(item);
      continue;
    }
    regularItems.push(item);
  }

  const occupied = new Set<string>();
  const occupy = (x: number, y: number, w: number, h: number) => {
    for (let xi = x; xi < x + w; xi += 1) {
      for (let yi = y; yi < y + h; yi += 1) {
        occupied.add(`${xi}:${yi}`);
      }
    }
  };
  const canPlace = (x: number, y: number, w: number, h: number) => {
    if (x < 0 || x + w > activeCols) return false;
    for (let xi = x; xi < x + w; xi += 1) {
      for (let yi = y; yi < y + h; yi += 1) {
        if (occupied.has(`${xi}:${yi}`)) return false;
      }
    }
    return true;
  };
  const findPlacement = (w: number, h: number, startY: number) => {
    for (let y = Math.max(0, startY); y < 500; y += 1) {
      for (let x = 0; x <= activeCols - w; x += 1) {
        if (canPlace(x, y, w, h)) return { x, y };
      }
    }
    return { x: 0, y: Math.max(0, startY) };
  };

  for (const item of regularItems) {
    const position = layoutById?.get(item.i) ??
      item.position?.[breakpoint] ?? {
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h
      };
    occupy(position.x, position.y, position.w, position.h);
  }

  const expandedItems = librarySources.flatMap((item) => {
    const productId = readLibraryProductId(item.props);
    const fallbackAssets = readLibraryAssets(item.props);
    const liveAssets = productId
      ? (liveAssetsByProductId?.get(productId) ?? [])
      : [];
    const assets =
      liveAssets.length > 0 || !productId
        ? liveAssets.length > 0
          ? liveAssets
          : fallbackAssets
        : fallbackAssets;
    const shouldPromoteEmbeddedAsset =
      Boolean(embeddedLibraryAsset?.assetId) &&
      (!embeddedLibraryAsset?.sourceNodeId ||
        embeddedLibraryAsset.sourceNodeId === item.i);
    const orderedAssets = shouldPromoteEmbeddedAsset
      ? [
          ...assets.filter(
            (asset) => asset.id === embeddedLibraryAsset?.assetId
          ),
          ...assets.filter(
            (asset) => asset.id !== embeddedLibraryAsset?.assetId
          )
        ]
      : assets;
    const basePosition = layoutById?.get(item.i) ??
      item.position?.[breakpoint] ?? {
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h
      };
    const itemLayout = readLibraryItemLayout(item.props);
    const widths = itemLayout.w.map((value) =>
      Math.max(1, Math.min(value, activeCols))
    );
    const heights = itemLayout.h.map((value) => Math.max(4, value));

    return orderedAssets.map((asset, index) => {
      if (
        embeddedLibraryAsset?.assetId === asset.id &&
        (!embeddedLibraryAsset.sourceNodeId ||
          embeddedLibraryAsset.sourceNodeId === item.i)
      ) {
        const placement = findPlacement(
          detailWidth,
          detailHeight,
          basePosition.y
        );
        occupy(placement.x, placement.y, detailWidth, detailHeight);
        return {
          i: `${item.i}::asset-detail::${asset.id}`,
          type: 'library-asset-detail',
          x: placement.x,
          y: placement.y,
          w: detailWidth,
          h: detailHeight,
          props: {
            assetId: asset.id,
            backHref: embeddedLibraryAsset.backHref,
            pageName: embeddedLibraryAsset.pageName,
            sourceNodeId: item.i,
            initialAsset: embeddedLibraryAsset.asset
          }
        } satisfies RuntimeItem;
      }

      const seed = hashLibrarySeed(`${item.i}:${asset.id}:${index}`);
      const w = widths[seed % widths.length] ?? 1;
      const h = heights[seed % heights.length] ?? basePosition.h;
      const placement = findPlacement(w, h, basePosition.y);
      occupy(placement.x, placement.y, w, h);
      return {
        i: `${item.i}::asset::${asset.id}`,
        type: 'library-asset-item',
        x: placement.x,
        y: placement.y,
        w,
        h,
        props: {
          asset,
          sourceNodeId: item.i,
          sourcePageSlug: normalizedSourcePageSlug || undefined
        }
      } satisfies RuntimeItem;
    });
  });

  return [...regularItems, ...expandedItems];
}

function pathFromSlug(slug: string) {
  const normalized = normalizeSlug(slug);
  return normalized ? `/${normalized}` : '/';
}

function findPresetBySlug(
  slug: string | undefined,
  config: PagesConfig
): Preset | null {
  const target = normalizeSlug(slug ?? '');
  const stack = Object.values(config.presets);

  while (stack.length > 0) {
    const current = stack.shift();
    if (!current) break;
    if (normalizeSlug(current.slug) === target) return current;
    if (current.children) stack.push(...Object.values(current.children));
  }
  return null;
}

function flattenPresets(
  entries: Record<string, Preset>,
  parentKey = ''
): FlatPreset[] {
  const output: FlatPreset[] = [];

  for (const [localKey, preset] of Object.entries(entries)) {
    const key = parentKey ? `${parentKey}.${localKey}` : localKey;
    output.push({
      key,
      name: preset.name,
      description: preset.description ?? '',
      slug: preset.slug,
      requiresAuth: Boolean(preset.requiresAuth),
      editableByUser: Boolean(preset.editableByUser),
      hidden: Boolean(preset.hidden),
      internalRoute: Boolean(preset.internalRoute)
    });

    if (preset.children) {
      output.push(...flattenPresets(preset.children, key));
    }
  }

  return output;
}

function buildRuntimeItems(preset: Preset): RuntimeItem[] {
  return preset.items
    .filter((item) => item.position.lg.w > 0 && item.position.lg.h > 0)
    .map((item) => ({
      i: item.i,
      type: item.type,
      x: item.position.lg.x,
      y: item.position.lg.y,
      w: item.position.lg.w,
      h: item.position.lg.h,
      props: item.props,
      position: {
        lg: {
          i: item.i,
          x: item.position.lg.x,
          y: item.position.lg.y,
          w: item.position.lg.w,
          h: item.position.lg.h
        },
        sm: {
          i: item.i,
          x: item.position.sm.x,
          y: item.position.sm.y,
          w: item.position.sm.w,
          h: item.position.sm.h
        },
        xs: {
          i: item.i,
          x: item.position.xs.x,
          y: item.position.xs.y,
          w: item.position.xs.w,
          h: item.position.xs.h
        }
      }
    }));
}

function buildLayouts(items: RuntimeItem[]) {
  return toResponsiveLayouts({
    lg: items.map(
      (item) =>
        item.position?.lg ??
        clampGridItem(
          {
            i: item.i,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h
          },
          GRID_COLS.lg
        )
    ),
    sm: items.map(
      (item) =>
        item.position?.sm ??
        clampGridItem(
          {
            i: item.i,
            x: item.x,
            y: item.y,
            w: Math.min(item.w, GRID_COLS.sm),
            h: item.h
          },
          GRID_COLS.sm
        )
    ),
    xs: items.map(
      (item) =>
        item.position?.xs ??
        clampGridItem(
          {
            i: item.i,
            x: item.x,
            y: item.y,
            w: Math.min(item.w, GRID_COLS.xs),
            h: item.h
          },
          GRID_COLS.xs
        )
    )
  });
}

function getLibraryTransitionLayoutId(item: RuntimeItem) {
  if (item.type === 'library-asset-detail') {
    const assetId =
      item.props && typeof item.props === 'object'
        ? (item.props as Record<string, unknown>).assetId
        : undefined;
    return typeof assetId === 'string' && assetId
      ? `library-asset-${assetId}`
      : undefined;
  }

  if (item.type === 'library-asset-item') {
    const asset =
      item.props && typeof item.props === 'object'
        ? ((item.props as Record<string, unknown>).asset as
            | Record<string, unknown>
            | undefined)
        : undefined;
    const assetId = asset?.id;
    return typeof assetId === 'string' && assetId
      ? `library-asset-${assetId}`
      : undefined;
  }

  return undefined;
}

export function DynamicGrid({
  routePresetSlug = '',
  isAuthenticated = false,
  runtimePagesConfig,
  embeddedLibraryAsset,
  adminPreview
}: DynamicGridProps) {
  const activePagesConfig = runtimePagesConfig ?? pagesConfig;
  const preset = useMemo(
    () =>
      findPresetBySlug(routePresetSlug, activePagesConfig) ??
      activePagesConfig.presets['/'] ??
      Object.values(activePagesConfig.presets)[0],
    [routePresetSlug, activePagesConfig]
  );

  if (!preset) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm">
          Missing preset configuration.
        </div>
      </div>
    );
  }

  return (
    <DynamicGridCanvas
      key={preset.slug || 'root'}
      preset={preset}
      isAuthenticated={isAuthenticated}
      runtimePagesConfig={activePagesConfig}
      embeddedLibraryAsset={embeddedLibraryAsset}
      adminPreview={adminPreview}
    />
  );
}

function DynamicGridCanvas({
  preset,
  isAuthenticated,
  runtimePagesConfig,
  embeddedLibraryAsset,
  adminPreview
}: {
  preset: Preset;
  isAuthenticated: boolean;
  runtimePagesConfig: PagesConfig;
  embeddedLibraryAsset?: DynamicGridProps['embeddedLibraryAsset'];
  adminPreview?: DynamicGridProps['adminPreview'];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const isLoggedIn = sessionStatus === 'authenticated' || isAuthenticated;
  const authStatus = isLoggedIn ? 'authenticated' : 'unauthenticated';
  const userName = session?.user?.name ?? session?.user?.email ?? 'Conta';
  const userImage = session?.user?.image;
  const userInitial = userName.trim().charAt(0).toUpperCase() || 'U';
  const currentTenantQuery = api.tenants.current.useQuery(undefined, {
    enabled: isLoggedIn,
    retry: false
  });

  const initialItems = useMemo(() => buildRuntimeItems(preset), [preset]);
  const normalizedRouteSlug = useMemo(
    () => normalizeSlug(preset.slug),
    [preset.slug]
  );
  const lockedSearchPrefix = useMemo(() => {
    if (!normalizedRouteSlug) return '';
    const [root] = normalizedRouteSlug.split('/');
    return root ? `${root}/` : '';
  }, [normalizedRouteSlug]);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<RuntimeItem[]>(() => initialItems);
  const [layouts, setLayouts] = useState(() => buildLayouts(initialItems));
  const [currentBreakpoint, setCurrentBreakpoint] =
    useState<keyof typeof GRID_BREAKPOINTS>('lg');

  const allPresets = useMemo(
    () => flattenPresets(runtimePagesConfig.presets),
    [runtimePagesConfig]
  );
  const visiblePresets = useMemo(
    () => allPresets.filter((entry) => !entry.hidden && !entry.internalRoute),
    [allPresets]
  );
  const rootVisiblePresets = useMemo(
    () => visiblePresets.filter((entry) => !entry.key.includes('.')),
    [visiblePresets]
  );
  const visiblePresetsByKey = useMemo(
    () => new Map(visiblePresets.map((entry) => [entry.key, entry])),
    [visiblePresets]
  );
  const currentPresetEntry = useMemo(
    () =>
      visiblePresets.find(
        (entry) => normalizeSlug(entry.slug) === normalizeSlug(preset.slug)
      ),
    [visiblePresets, preset.slug]
  );
  const canUserEditLayout = Boolean(currentPresetEntry?.editableByUser);
  useEffect(() => {
    if (!canUserEditLayout) setIsEditing(false);
  }, [canUserEditLayout]);
  const isAdminPreview = Boolean(adminPreview);
  const isLockedForUser = !isAdminPreview && !canUserEditLayout;
  const isLayoutEditing = isAdminPreview ? true : isEditing;
  useEffect(() => {
    if (adminPreview?.forcedBreakpoint) {
      setCurrentBreakpoint(adminPreview.forcedBreakpoint);
    }
  }, [adminPreview?.forcedBreakpoint]);
  const activeStoredBreakpoint = isAdminPreview
    ? (adminPreview?.forcedBreakpoint ?? 'lg')
    : getStoredBreakpointKey(currentBreakpoint);
  const effectiveLayouts = useMemo(
    () =>
      adminPreview
        ? toResponsiveLayouts(adminPreview.layoutOverrides)
        : layouts,
    [adminPreview, layouts]
  );
  const defaultNavParent = useMemo(() => {
    if (!currentPresetEntry) return null;
    const parts = currentPresetEntry.key.split('.');
    if (parts.length > 1) return parts.slice(0, -1).join('.');

    const hasDirectChildren = visiblePresets.some(
      (candidate) =>
        candidate.key.startsWith(`${currentPresetEntry.key}.`) &&
        candidate.key.split('.').length === parts.length + 1
    );
    return hasDirectChildren ? currentPresetEntry.key : null;
  }, [currentPresetEntry, visiblePresets]);
  const [presetNavParentKey, setPresetNavParentKey] = useState<string | null>(
    defaultNavParent
  );
  useEffect(() => {
    setPresetNavParentKey(defaultNavParent);
  }, [defaultNavParent]);

  const presetNavEntries = useMemo(() => {
    if (!presetNavParentKey) return rootVisiblePresets;
    const targetDepth = presetNavParentKey.split('.').length + 1;
    return visiblePresets.filter(
      (entry) =>
        entry.key.startsWith(`${presetNavParentKey}.`) &&
        entry.key.split('.').length === targetDepth
    );
  }, [presetNavParentKey, rootVisiblePresets, visiblePresets]);

  const filteredItems = useMemo(
    () => (preset.requiresAuth && authStatus !== 'authenticated' ? [] : items),
    [preset.requiresAuth, authStatus, items]
  );
  const libraryProductIds = useMemo(
    () =>
      Array.from(
        new Set(
          filteredItems
            .filter((item) => isLibraryViewNodeType(item.type))
            .map((item) => readLibraryProductId(item.props))
            .filter(Boolean)
        )
      ),
    [filteredItems]
  );
  const libraryProductQueries = api.useQueries((t) =>
    libraryProductIds.map((productId) =>
      t.products.libraryAssetsByProductId({ productId })
    )
  );
  const liveLibraryAssetsByProductId = useMemo(() => {
    const next = new Map<string, LibraryAssetSnapshot[]>();

    libraryProductIds.forEach((productId, index) => {
      const productAssets = libraryProductQueries[index]?.data as
        | Array<Record<string, unknown>>
        | undefined;
      const assets = (productAssets ?? [])
        .map((asset) => toLibraryAssetSnapshot(asset))
        .filter((asset) => Boolean(asset.id) && Boolean(asset.url));

      if (libraryProductQueries[index]?.status === 'success') {
        next.set(productId, assets);
      }
    });

    return next;
  }, [libraryProductIds, libraryProductQueries]);

  const componentEntries = useMemo(() => {
    const entries = Object.entries(
      componentsCatalog as Record<string, ComponentConfig>
    );
    const deduped = new Map<string, { key: string; config: ComponentConfig }>();

    for (const [key, config] of entries) {
      const logical = logicalNodeType(key);
      const existing = deduped.get(logical);
      if (!existing) {
        deduped.set(logical, { key, config });
        continue;
      }
      if (existing.key.startsWith('node-') && !key.startsWith('node-')) {
        deduped.set(logical, { key, config });
      }
    }

    return Array.from(deduped.values());
  }, []);

  const searchNodeItems = useMemo(() => {
    if (isAdminPreview) return [] as RuntimeItem[];
    const q = search.trim().toLowerCase();
    if (!q) return [] as RuntimeItem[];

    const existingTypes = new Set(
      items.map((item) => logicalNodeType(item.type))
    );
    const matches = componentEntries
      .filter(({ key, config }) => {
        if (config.internal) return false;
        if (existingTypes.has(logicalNodeType(key))) return false;
        const haystack =
          `${key} ${config.name ?? ''} ${config.description ?? ''} ${(
            config.tags ?? []
          ).join(' ')}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 12);

    const baseY = items.reduce(
      (max, item) => Math.max(max, item.y + item.h),
      0
    );

    return matches.map(({ key, config }, index) => {
      const cols = GRID_COLS.lg;
      const rawW = Array.isArray(config.defaultLayout?.w)
        ? config.defaultLayout?.w[0]
        : config.defaultLayout?.w;
      const rawH = Array.isArray(config.defaultLayout?.h)
        ? config.defaultLayout?.h[0]
        : config.defaultLayout?.h;
      const w = Math.max(1, Math.min(Number(rawW) || 1, cols));
      const h = Math.max(2, Number(rawH) || 6);
      return {
        i: `search-node-${logicalNodeType(key)}-${index}`,
        type: key,
        x: index % cols,
        y: baseY + Math.floor(index / cols) * h,
        w,
        h,
        props: { __searchResult: true, __searchQuery: q }
      };
    });
  }, [search, items, componentEntries, isAdminPreview]);

  const gridItemsToRender = useMemo(() => {
    if (isAdminPreview) {
      return [...filteredItems, ...searchNodeItems];
    }

    return [
      // Library assets are expanded after regular nodes and fill remaining slots.
      ...expandLibraryViewItems(
        filteredItems,
        preset.slug,
        liveLibraryAssetsByProductId,
        activeStoredBreakpoint,
        new Map(
          (effectiveLayouts[currentBreakpoint] ?? []).map((entry) => [
            entry.i,
            {
              i: entry.i,
              x: entry.x,
              y: entry.y,
              w: entry.w,
              h: entry.h
            } satisfies GridLayoutItem
          ])
        ),
        embeddedLibraryAsset
      ),
      ...searchNodeItems
    ];
  }, [
    filteredItems,
    searchNodeItems,
    isAdminPreview,
    preset.slug,
    liveLibraryAssetsByProductId,
    activeStoredBreakpoint,
    effectiveLayouts,
    currentBreakpoint,
    embeddedLibraryAsset
  ]);

  const tenantBranding = useMemo(
    () => readTenantBranding(currentTenantQuery.data?.tenant?.settings),
    [currentTenantQuery.data?.tenant?.settings]
  );
  const tenantTheme = tenantBranding.theme;
  const tenantLogoUrl = tenantBranding.logoUrl;
  const tenantName = currentTenantQuery.data?.tenant?.name?.trim() || 'HUB';

  if (preset.requiresAuth && authStatus !== 'authenticated') {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
          This route requires authentication.
        </div>
      </div>
    );
  }

  return (
    <TenantAppChrome
      tenantName={tenantName}
      tenantLogoUrl={tenantLogoUrl}
      tenantTheme={tenantTheme}
      nodeRadius={tenantBranding.nodeRadius}
      isLoggedIn={isLoggedIn}
      pathname={pathname}
      userName={userName}
      userImage={userImage}
      userInitial={userInitial}
      tenantSlug={currentTenantQuery.data?.tenant?.slug}
      tenantRole={currentTenantQuery.data?.role ?? session?.user?.tenantRole}
      isGlobalAdmin={session?.user?.isGlobalAdmin}
      searchValue={search}
      searchPrefix={lockedSearchPrefix}
      onSearchChange={setSearch}
      searchDisabled={isAdminPreview}
      shellHeightClassName={isAdminPreview ? 'h-[820px]' : 'h-screen'}
    >
      <div className="flex h-fit items-center gap-2 px-6 py-4 mt-4">
        {presetNavParentKey ? (
          <button
            type="button"
            disabled={isAdminPreview}
            onClick={() => {
              const currentKey = currentPresetEntry?.key;
              const isTopLevelParentContext =
                Boolean(currentKey) &&
                currentKey === presetNavParentKey &&
                !presetNavParentKey.includes('.');
              if (isTopLevelParentContext) {
                router.push('/');
                return;
              }

              const parentEntry = visiblePresetsByKey.get(presetNavParentKey);
              if (!parentEntry) {
                const parts = presetNavParentKey.split('.');
                setPresetNavParentKey(
                  parts.length > 1 ? parts.slice(0, -1).join('.') : null
                );
                return;
              }
              router.push(pathFromSlug(parentEntry.slug) as any);
            }}
            className="shrink-0 px-3 py-2 text-xs font-semibold transition-colors hover:bg-[var(--tenant-button-primary-hover)] hover:text-[var(--tenant-button-text)]"
            style={{
              borderRadius: 'var(--tenant-node-radius-pill)',
              backgroundColor: 'var(--tenant-card-bg)',
              color: 'var(--tenant-text-secondary)'
            }}
          >
            Voltar
          </button>
        ) : null}

        {presetNavEntries.map((entry) => {
          const isLocked =
            entry.requiresAuth && authStatus === 'unauthenticated';
          const isActive =
            normalizeSlug(entry.slug) === normalizeSlug(preset.slug);
          const hasChildren = visiblePresets.some(
            (candidate) =>
              candidate.key.startsWith(`${entry.key}.`) &&
              candidate.key.split('.').length ===
                entry.key.split('.').length + 1
          );

          return (
            <button
              key={entry.key}
              type="button"
              disabled={isAdminPreview || isLocked}
              onClick={() => {
                if (isLocked) return;
                if (hasChildren) {
                  setPresetNavParentKey(entry.key);
                  if (!isActive) router.push(pathFromSlug(entry.slug) as any);
                  return;
                }
                router.push(pathFromSlug(entry.slug) as any);
              }}
              className={`shrink-0 px-4 py-2 text-xs font-semibold transition-colors ${
                isLocked
                  ? ''
                  : isActive
                    ? 'bg-[var(--tenant-button-primary)] text-[var(--tenant-button-text)]'
                    : 'text-[var(--tenant-text-secondary)] hover:bg-[var(--tenant-button-primary-hover)] hover:text-[var(--tenant-button-text)]'
              }`}
              style={
                isLocked
                  ? {
                      borderRadius: 'var(--tenant-node-radius-pill)',
                      border: '1px solid var(--tenant-border)',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      color: 'var(--tenant-border)'
                    }
                  : {
                      borderRadius: 'var(--tenant-node-radius-pill)',
                      border: '1px solid var(--tenant-border)',
                      backgroundColor: isActive
                        ? 'var(--tenant-button-primary)'
                        : 'var(--tenant-card-bg)'
                    }
              }
            >
              {entry.name}
            </button>
          );
        })}
      </div>

      <main className="relative mx-auto flex-1 w-full px-4 pb-4">
        <style>{`
            .layout .react-grid-placeholder {
              background: rgba(255, 255, 255, 0.25) !important;
              border-radius: var(--tenant-node-radius, 12px) !important;
            }
            .layout .react-grid-item.react-grid-placeholder {
              z-index: 1;
            }
            [data-tenant-grid] input::placeholder {
              color: var(--tenant-text-secondary);
            }
          `}</style>

        <LayoutGroup id={`grid-${preset.slug || 'root'}`}>
          <ResponsiveGridLayout
            className="layout"
            breakpoint={
              isAdminPreview ? adminPreview?.forcedBreakpoint : undefined
            }
            layouts={effectiveLayouts}
            breakpoints={GRID_BREAKPOINTS}
            cols={GRID_COLS}
            isDraggable={isLayoutEditing}
            isResizable={isLayoutEditing}
            rowHeight={30}
            margin={[16, 16]}
            onBreakpointChange={(breakpoint) =>
              setCurrentBreakpoint(breakpoint as keyof typeof GRID_BREAKPOINTS)
            }
            onLayoutChange={(_, allLayouts) => {
              const itemIds = new Set(filteredItems.map((entry) => entry.i));
              const activeLayout = (allLayouts[currentBreakpoint] ??
                allLayouts.lg ??
                []) as Array<{
                i: string;
                x: number;
                y: number;
                w: number;
                h: number;
              }>;
              if (adminPreview?.onLayoutChange) {
                const nextLayout = filterStoredLayoutEntries(
                  (allLayouts[adminPreview.forcedBreakpoint] ?? []) as Array<{
                    i: string;
                    x: number;
                    y: number;
                    w: number;
                    h: number;
                  }>,
                  itemIds
                );
                adminPreview.onLayoutChange(
                  adminPreview.forcedBreakpoint,
                  nextLayout
                );
                return;
              }
              if (!isLayoutEditing) return;
              setLayouts((current) => {
                const sanitize = (
                  breakpoint: keyof typeof current
                ): GridLayoutItem[] => {
                  const sourceLayout = (allLayouts[breakpoint] ?? []) as Array<{
                    i: string;
                    x: number;
                    y: number;
                    w: number;
                    h: number;
                  }>;
                  return filterStoredLayoutEntries(sourceLayout, itemIds);
                };

                return {
                  ...current,
                  lg: sanitize('lg'),
                  sm: sanitize('sm'),
                  xs: sanitize('xs')
                };
              });
              const byId = new Map(
                activeLayout.map((entry) => [entry.i, entry])
              );
              setItems((prev) =>
                prev.map((item) => {
                  const next = byId.get(item.i);
                  const basePosition = item.position ?? {
                    lg: {
                      i: item.i,
                      x: item.x,
                      y: item.y,
                      w: item.w,
                      h: item.h
                    },
                    sm: {
                      i: item.i,
                      x: item.x,
                      y: item.y,
                      w: item.w,
                      h: item.h
                    },
                    xs: {
                      i: item.i,
                      x: item.x,
                      y: item.y,
                      w: item.w,
                      h: item.h
                    }
                  };
                  return next
                    ? {
                        ...item,
                        x: next.x,
                        y: next.y,
                        w: next.w,
                        h: next.h,
                        position: {
                          ...basePosition,
                          [activeStoredBreakpoint]: {
                            i: item.i,
                            x: next.x,
                            y: next.y,
                            w: next.w,
                            h: next.h
                          }
                        }
                      }
                    : item;
                })
              );
            }}
          >
            {gridItemsToRender.map((item) => {
              const NodeComponent = ComponentRegistry[item.type];
              const isSearchNode = item.i.startsWith('search-node-');
              const sourceNodeId =
                item.props && typeof item.props === 'object'
                  ? (item.props as Record<string, unknown>).sourceNodeId
                  : undefined;
              const selectableNodeId =
                typeof sourceNodeId === 'string' ? sourceNodeId : item.i;
              const nodeProductId =
                item.props && typeof item.props === 'object'
                  ? (item.props as Record<string, unknown>).productId
                  : undefined;
              const nodeProps =
                isTextNodeType(item.type) &&
                typeof nodeProductId !== 'string' &&
                libraryProductIds[0]
                  ? {
                      ...item.props,
                      fallbackProductId: libraryProductIds[0]
                    }
                  : item.props;
              const layoutId = getLibraryTransitionLayoutId(item);

              return (
                <div
                  key={item.i}
                  data-grid={{
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h,
                    minW: 1,
                    minH: 2,
                    static:
                      isSearchNode ||
                      item.type === 'library-asset-item' ||
                      item.type === 'library-asset-detail' ||
                      !isLayoutEditing
                  }}
                  onMouseDownCapture={() =>
                    adminPreview?.onSelectNode?.(selectableNodeId)
                  }
                  className={`overflow-hidden animate-fade-in-up ${
                    isSearchNode
                      ? 'rounded-xl ring-1 ring-cyan-400/30'
                      : isLayoutEditing
                        ? 'rounded-xl ring-1 ring-amber-500/20'
                        : ''
                  } ${
                    adminPreview?.selectedNodeId === selectableNodeId
                      ? 'ring-2 ring-sky-400/50'
                      : ''
                  }`}
                  style={{
                    borderRadius: 'var(--tenant-node-radius)'
                  }}
                >
                  <motion.div
                    layout
                    layoutId={layoutId}
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 30
                    }}
                    className="relative h-full w-full"
                  >
                    {isAdminPreview &&
                    item.type !== 'library-asset-item' &&
                    item.type !== 'library-asset-detail' ? (
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-black/90 via-black/70 to-transparent px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">
                            {item.type
                              .replace(/^node-/, '')
                              .replace(/[-_]/g, ' ')}
                          </p>
                          <p className="truncate text-[10px] text-zinc-400">
                            {activeStoredBreakpoint.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    <div
                      className={
                        isAdminPreview ? 'pointer-events-none h-full' : 'h-full'
                      }
                    >
                      {item.type === 'library-asset-detail' ? (
                        <LibraryAssetDetailPanel
                          assetId={String(
                            (item.props as Record<string, unknown>)?.assetId ??
                              ''
                          )}
                          backHref={String(
                            (item.props as Record<string, unknown>)?.backHref ??
                              '/'
                          )}
                          pageName={String(
                            (item.props as Record<string, unknown>)?.pageName ??
                              'Gallery'
                          )}
                          embedded
                          inGrid
                          initialAsset={
                            (item.props as Record<string, unknown>)
                              ?.initialAsset as
                              | Record<string, unknown>
                              | undefined as any
                          }
                        />
                      ) : (
                        <NodeComponent
                          id={item.i}
                          type={item.type}
                          props={nodeProps}
                        />
                      )}
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        </LayoutGroup>
      </main>
    </TenantAppChrome>
  );
}
