"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Braces,
  LayoutGrid,
  Lock,
  Package2,
  Plus,
  Search,
  Trash2,
  Waypoints,
} from "lucide-react";

import componentsCatalog from "~/app/_nodes/components.json";
import { DynamicGrid } from "~/app/_nodes/dynamic-grid";
import type { PagesConfig, Preset, PresetItem } from "~/app/_nodes/schemas";
import { AdminShell } from "~/app/admin/dashboard/admin-shell";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

type PageItem = {
  id: string;
  parentPageId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  requiresAuth: boolean;
  editableByUser?: boolean;
  internalRoute: boolean;
  indexable: boolean;
  hidden: boolean;
  isSystem: boolean;
  sortOrder: number;
  items?: Array<{
    id: string;
    nodeKey: string;
    title?: string | null;
    type: string;
    props?: Record<string, unknown> | null;
    position?: unknown;
    sortOrder: number;
    productId?: string | null;
    stepId?: string | null;
  }>;
};

type NodeCatalogConfig = {
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

type GridLayoutItem = { i: string; x: number; y: number; w: number; h: number };
type LibraryLayoutStyle = "uniform" | "masonry" | "pinterest";
type LibraryRandomness = "low" | "medium" | "high";
type ProductStepOption = {
  id: string;
  title: string;
  description?: string | null;
};
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
type TextVariableSource = "none" | "product_name" | "company_name";
type TextVariableTarget = "title" | "subtitle" | "both";
type TextAlign = "left" | "center" | "right";

const defaultPosition = {
  xs: { x: 0, y: 0, w: 2, h: 8 },
  sm: { x: 0, y: 0, w: 3, h: 8 },
  lg: { x: 0, y: 0, w: 4, h: 8 },
};
const libraryViewPosition = {
  xs: { x: 0, y: 0, w: 1, h: 8 },
  sm: { x: 0, y: 0, w: 1, h: 8 },
  lg: { x: 0, y: 0, w: 1, h: 8 },
};
const textNodePosition = {
  xs: { x: 0, y: 0, w: 2, h: 4 },
  sm: { x: 0, y: 0, w: 3, h: 4 },
  lg: { x: 0, y: 0, w: 3, h: 4 },
};
const GRID_BREAKPOINTS = { lg: 1200, sm: 640, xs: 0 };
const GRID_COLS = { lg: 6, sm: 3, xs: 2 };
const DEFAULT_LIBRARY_LAYOUT_STYLE: LibraryLayoutStyle = "pinterest";
const DEFAULT_LIBRARY_RANDOMNESS: LibraryRandomness = "medium";
const DEFAULT_TEXT_NODE_TITLE = "Text";
const DEFAULT_TEXT_NODE_SUBTITLE = "";
const DEFAULT_TEXT_NODE_TITLE_FONT_SIZE = 32;
const DEFAULT_TEXT_NODE_TITLE_FONT_WEIGHT = "700";
const DEFAULT_TEXT_NODE_SUBTITLE_FONT_SIZE = 16;
const DEFAULT_TEXT_NODE_SUBTITLE_FONT_WEIGHT = "400";
const DEFAULT_TEXT_NODE_TEXT_ALIGN: TextAlign = "left";
const DEFAULT_TEXT_NODE_TITLE_COLOR = "#ffffff";
const DEFAULT_TEXT_NODE_SUBTITLE_COLOR = "#d4d4d8";
const DEFAULT_TEXT_NODE_VARIABLE: TextVariableSource = "none";
const DEFAULT_TEXT_NODE_VARIABLE_TARGET: TextVariableTarget = "title";
const PREVIEW_BREAKPOINTS = {
  lg: { label: "Desktop", width: 1280 },
  sm: { label: "Tablet", width: 820 },
  xs: { label: "Mobile", width: 430 },
} as const;

function slugPath(slug: string) {
  const normalized = slug.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "/";
}

function toPageSlug(input: string) {
  const trimmed = input.trim().toLowerCase();
  const kebab = trimmed
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return kebab || "new-page";
}

function keyFromSlug(slug: string, fallback: string) {
  const normalized = slug.replace(/^\/+|\/+$/g, "");
  if (!normalized) return fallback;
  return normalized.replace(/[^\w/.-]/g, "").replace(/[/.-]/g, "_");
}

function toPresetItem(
  node: NonNullable<PageItem["items"]>[number]
): PresetItem {
  const position = parseNodePosition(node.position);
  return {
    i: node.id,
    type: node.type,
    props:
      node.props && typeof node.props === "object"
        ? (node.props as Record<string, unknown>)
        : {},
    position,
  };
}

function buildRuntimePagesConfig(pages: PageItem[]): PagesConfig {
  const byId = new Map<string, Preset>();
  const byParent = new Map<string, Array<{ id: string; slug: string; sortOrder: number }>>();

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
      items: (page.items ?? []).map((item) => toPresetItem(item)),
      children: {},
    });
    const parentKey = page.parentPageId ?? "__root__";
    const list = byParent.get(parentKey) ?? [];
    list.push({ id: page.id, slug: page.slug, sortOrder: page.sortOrder });
    byParent.set(parentKey, list);
  }

  const attachChildren = (parentId: string): Record<string, Preset> => {
    const children = (byParent.get(parentId) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug)
    );
    const result: Record<string, Preset> = {};
    for (const child of children) {
      const preset = byId.get(child.id);
      if (!preset) continue;
      preset.children = attachChildren(child.id);
      result[keyFromSlug(child.slug, child.id)] = preset;
    }
    return result;
  };

  const presets: Record<string, Preset> = {};
  const rootChildren = (byParent.get("__root__") ?? []).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug)
  );

  for (const root of rootChildren) {
    const preset = byId.get(root.id);
    if (!preset) continue;
    preset.children = attachChildren(root.id);
    presets[keyFromSlug(root.slug, root.id)] = preset;
  }

  return { presets };
}

function createNodeKey(type: string) {
  return `${logicalNodeType(type)}-${globalThis.crypto.randomUUID()}`;
}

function readEditableByUser(page: unknown) {
  if (!page || typeof page !== "object") return false;
  return Boolean((page as { editableByUser?: boolean }).editableByUser);
}

function logicalNodeType(type: string) {
  return type.startsWith("node-") ? type.slice("node-".length) : type;
}

function isLibraryViewNodeType(type: string) {
  const logical = logicalNodeType(type);
  return logical === "library_view" || logical === "library-view";
}

function isTextNodeType(type: string) {
  return logicalNodeType(type) === "text";
}

function isStepViewerNodeType(type: string) {
  const logical = logicalNodeType(type);
  return logical === "step-viewer" || logical === "step_viewer";
}

function readLibraryLayoutStyle(props?: Record<string, unknown> | null): LibraryLayoutStyle {
  const value = typeof props?.layoutStyle === "string" ? props.layoutStyle : "";
  if (value === "uniform" || value === "masonry" || value === "pinterest") {
    return value;
  }
  return DEFAULT_LIBRARY_LAYOUT_STYLE;
}

function readLibraryRandomness(props?: Record<string, unknown> | null): LibraryRandomness {
  const value = typeof props?.randomness === "string" ? props.randomness : "";
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return DEFAULT_LIBRARY_RANDOMNESS;
}

function readLibraryAssets(
  props?: Record<string, unknown> | null
): LibraryAssetSnapshot[] {
  const raw = props?.assets;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((asset): asset is Record<string, unknown> => Boolean(asset) && typeof asset === "object")
    .map((asset) => ({
      id: String(asset.id ?? ""),
      title: String(asset.title ?? ""),
      url: String(asset.url ?? ""),
      type: String(asset.type ?? "FILE"),
      targetUrl: typeof asset.targetUrl === "string" ? asset.targetUrl : null,
      openInNewTab: typeof asset.openInNewTab === "boolean" ? asset.openInNewTab : null,
      previewUrl:
        typeof asset.previewUrl === "string" ? asset.previewUrl : null,
      thumbnailUrl:
        typeof asset.thumbnailUrl === "string" ? asset.thumbnailUrl : null,
    }))
    .filter((asset) => Boolean(asset.id) && Boolean(asset.url));
}

function readLibraryItemLayout(
  props?: Record<string, unknown> | null
): LibraryItemLayout {
  const raw =
    props?.itemLayout && typeof props.itemLayout === "object"
      ? (props.itemLayout as Record<string, unknown>)
      : {};
  const widths = Array.isArray(raw.w)
    ? raw.w.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : [];
  const heights = Array.isArray(raw.h)
    ? raw.h.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : [];
  return {
    w: widths.length ? widths : [1],
    h: heights.length ? heights : [6, 8, 10],
  };
}

function readLibraryViewInGallery(props?: Record<string, unknown> | null) {
  return Boolean(props?.viewInGallery);
}

function readLibraryOpenInModal(props?: Record<string, unknown> | null) {
  return Boolean(props?.openInModal);
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
    pinterest: [normalizedBase - 2, normalizedBase, normalizedBase + 2, normalizedBase + 4],
  };
  const allowedByRandomness: Record<LibraryRandomness, number> = {
    low: 2,
    medium: 3,
    high: 4,
  };
  return heightsByStyle[layoutStyle]
    .slice(0, allowedByRandomness[randomness])
    .map((value) => Math.max(4, value));
}

function buildLibraryViewProps(
  productId: string,
  layoutStyle: LibraryLayoutStyle,
  randomness: LibraryRandomness,
  viewInGallery: boolean,
  openInModal: boolean,
  assets: LibraryAssetSnapshot[],
  itemLayout: LibraryItemLayout
) {
  return {
    productId,
    layoutStyle,
    randomness,
    viewInGallery,
    openInModal,
    assets,
    itemLayout,
  };
}

function parseLibraryOptionsInput(
  input: string,
  fallback: number[]
) {
  const parsed = input
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return parsed.length ? parsed : fallback;
}

function readTextVariableSource(
  props?: Record<string, unknown> | null
): TextVariableSource {
  const value =
    typeof props?.variableSource === "string" ? props.variableSource : "none";
  if (value === "product_name" || value === "company_name" || value === "none") {
    return value;
  }
  return DEFAULT_TEXT_NODE_VARIABLE;
}

function readTextVariableTarget(
  props?: Record<string, unknown> | null
): TextVariableTarget {
  const value =
    typeof props?.variableTarget === "string" ? props.variableTarget : "title";
  if (value === "title" || value === "subtitle" || value === "both") {
    return value;
  }
  return DEFAULT_TEXT_NODE_VARIABLE_TARGET;
}

function readTextNodeTitle(props?: Record<string, unknown> | null) {
  if (typeof props?.title === "string" && props.title.trim().length > 0) {
    return props.title;
  }
  return typeof props?.text === "string" && props.text.trim().length > 0
    ? props.text
    : DEFAULT_TEXT_NODE_TITLE;
}

function readTextNodeSubtitle(props?: Record<string, unknown> | null) {
  return typeof props?.subtitle === "string" ? props.subtitle : DEFAULT_TEXT_NODE_SUBTITLE;
}

function readTextNodeTitleFontSize(props?: Record<string, unknown> | null) {
  const value = Number(props?.titleFontSize ?? props?.fontSize);
  if (Number.isFinite(value)) {
    return Math.max(12, Math.min(120, value));
  }
  return DEFAULT_TEXT_NODE_TITLE_FONT_SIZE;
}

function readTextNodeTitleFontWeight(props?: Record<string, unknown> | null) {
  return typeof props?.titleFontWeight === "string" && props.titleFontWeight
    ? props.titleFontWeight
    : typeof props?.fontWeight === "string" && props.fontWeight
      ? props.fontWeight
      : DEFAULT_TEXT_NODE_TITLE_FONT_WEIGHT;
}

function readTextNodeSubtitleFontSize(props?: Record<string, unknown> | null) {
  const value = Number(props?.subtitleFontSize);
  if (Number.isFinite(value)) {
    return Math.max(12, Math.min(72, value));
  }
  return DEFAULT_TEXT_NODE_SUBTITLE_FONT_SIZE;
}

function readTextNodeSubtitleFontWeight(props?: Record<string, unknown> | null) {
  return typeof props?.subtitleFontWeight === "string" && props.subtitleFontWeight
    ? props.subtitleFontWeight
    : DEFAULT_TEXT_NODE_SUBTITLE_FONT_WEIGHT;
}

function readTextNodeTextAlign(props?: Record<string, unknown> | null): TextAlign {
  const value = typeof props?.textAlign === "string" ? props.textAlign : "";
  if (value === "left" || value === "center" || value === "right") {
    return value;
  }
  return DEFAULT_TEXT_NODE_TEXT_ALIGN;
}

function readTextNodeTitleColor(props?: Record<string, unknown> | null) {
  return typeof props?.titleColor === "string" && props.titleColor.trim().length > 0
    ? props.titleColor
    : typeof props?.color === "string" && props.color.trim().length > 0
      ? props.color
      : DEFAULT_TEXT_NODE_TITLE_COLOR;
}

function readTextNodeSubtitleColor(props?: Record<string, unknown> | null) {
  return typeof props?.subtitleColor === "string" && props.subtitleColor.trim().length > 0
    ? props.subtitleColor
    : DEFAULT_TEXT_NODE_SUBTITLE_COLOR;
}

function buildTextNodeProps(
  title: string,
  subtitle: string,
  variableSource: TextVariableSource,
  variableTarget: TextVariableTarget,
  titleFontSize: number,
  titleFontWeight: string,
  subtitleFontSize: number,
  subtitleFontWeight: string,
  textAlign: TextAlign,
  titleColor: string,
  subtitleColor: string,
  productId?: string
) {
  return {
    title: title.trim() || DEFAULT_TEXT_NODE_TITLE,
    subtitle: subtitle.trim(),
    variableSource,
    variableTarget,
    titleFontSize: Math.max(
      12,
      Math.min(120, titleFontSize || DEFAULT_TEXT_NODE_TITLE_FONT_SIZE)
    ),
    titleFontWeight: titleFontWeight || DEFAULT_TEXT_NODE_TITLE_FONT_WEIGHT,
    subtitleFontSize: Math.max(
      12,
      Math.min(72, subtitleFontSize || DEFAULT_TEXT_NODE_SUBTITLE_FONT_SIZE)
    ),
    subtitleFontWeight: subtitleFontWeight || DEFAULT_TEXT_NODE_SUBTITLE_FONT_WEIGHT,
    textAlign,
    titleColor: titleColor.trim() || DEFAULT_TEXT_NODE_TITLE_COLOR,
    subtitleColor: subtitleColor.trim() || DEFAULT_TEXT_NODE_SUBTITLE_COLOR,
    ...(variableSource === "product_name" && productId ? { productId } : {}),
  };
}

function expandLibraryViewItems(
  items: Array<{
    id: string;
    type: string;
    title?: string | null;
    props?: Record<string, unknown> | null;
    position?: unknown;
  }>
) {
  const regularItems: Array<{
    id: string;
    type: string;
    title?: string | null;
    props?: Record<string, unknown> | null;
    position?: unknown;
    sourceNodeId?: string;
  }> = [];
  const librarySources: Array<{
    id: string;
    type: string;
    title?: string | null;
    props?: Record<string, unknown> | null;
    position?: unknown;
  }> = [];

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
    if (x < 0 || x + w > GRID_COLS.lg) return false;
    for (let xi = x; xi < x + w; xi += 1) {
      for (let yi = y; yi < y + h; yi += 1) {
        if (occupied.has(`${xi}:${yi}`)) return false;
      }
    }
    return true;
  };
  const findPlacement = (w: number, h: number, startY: number) => {
    for (let y = Math.max(0, startY); y < 500; y += 1) {
      for (let x = 0; x <= GRID_COLS.lg - w; x += 1) {
        if (canPlace(x, y, w, h)) {
          return { x, y };
        }
      }
    }
    return { x: 0, y: Math.max(0, startY) };
  };

  for (const item of regularItems) {
    const position = parseNodePosition(item.position).lg;
    occupy(position.x, position.y, position.w, position.h);
  }

  const expandedItems = librarySources.flatMap((item) => {
    const props = (item.props ?? {}) as Record<string, unknown>;
    const assets = readLibraryAssets(props);
    const position = parseNodePosition(item.position).lg;
    const itemLayout = readLibraryItemLayout(props);
    const widths = itemLayout.w.map((value) => Math.max(1, Math.min(value, GRID_COLS.lg)));
    const heights = itemLayout.h.map((value) => Math.max(4, value));

    return assets.map((asset, index) => {
      const seed = hashLibrarySeed(`${item.id}:${asset.id}:${index}`);
      const w = widths[seed % widths.length] ?? 1;
      const h = heights[seed % heights.length] ?? position.h;
      const placement = findPlacement(w, h, position.y);
      occupy(placement.x, placement.y, w, h);
      return {
        id: `${item.id}::asset::${asset.id}`,
        type: "library-asset-item",
        title: null,
        props: {
          asset,
          sourceNodeId: item.id,
        },
        position: {
          lg: { x: placement.x, y: placement.y, w, h },
          sm: { x: Math.min(placement.x, 2), y: placement.y, w: Math.min(w, 3), h },
          xs: { x: Math.min(placement.x, 1), y: placement.y, w: Math.min(w, 2), h },
        },
        sourceNodeId: item.id,
      };
    });
  });

  return [...regularItems, ...expandedItems];
}

function titleFromType(type: string) {
  return logicalNodeType(type)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseNodePosition(position: unknown) {
  const fallback = defaultPosition;
  if (!position || typeof position !== "object") return fallback;
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
      h: Number(candidate.xs?.h ?? fallback.xs.h),
    },
    sm: {
      x: Number(candidate.sm?.x ?? fallback.sm.x),
      y: Number(candidate.sm?.y ?? fallback.sm.y),
      w: Number(candidate.sm?.w ?? fallback.sm.w),
      h: Number(candidate.sm?.h ?? fallback.sm.h),
    },
    lg: {
      x: Number(candidate.lg?.x ?? fallback.lg.x),
      y: Number(candidate.lg?.y ?? fallback.lg.y),
      w: Number(candidate.lg?.w ?? fallback.lg.w),
      h: Number(candidate.lg?.h ?? fallback.lg.h),
    },
  };
}

function buildLayoutsFromPage(page: PageItem | null) {
  if (!page) return { lg: [], sm: [], xs: [] } as Record<string, GridLayoutItem[]>;
  return {
    lg: (page.items ?? []).map((node) => {
      const position = parseNodePosition(node.position).lg;
      return { i: node.id, x: position.x, y: position.y, w: position.w, h: position.h };
    }),
    sm: (page.items ?? []).map((node) => {
      const position = parseNodePosition(node.position).sm;
      return { i: node.id, x: position.x, y: position.y, w: position.w, h: position.h };
    }),
    xs: (page.items ?? []).map((node) => {
      const position = parseNodePosition(node.position).xs;
      return { i: node.id, x: position.x, y: position.y, w: position.w, h: position.h };
    }),
  };
}

function clampGridItem(entry: GridLayoutItem, cols: number): GridLayoutItem {
  const w = Math.max(1, Math.min(entry.w, cols));
  return {
    i: entry.i,
    x: Math.max(0, Math.min(entry.x, Math.max(0, cols - w))),
    y: Math.max(0, entry.y),
    w,
    h: Math.max(2, entry.h),
  };
}

export function PagesDashboard() {
  const utils = api.useUtils();
  const pagesQuery = api.nodePages.list.useQuery();
  const productsQuery = api.products.list.useQuery();
  const currentTenantQuery = api.tenants.current.useQuery(undefined, {
    retry: false,
  });

  const [selectedPageId, setSelectedPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [pageDescription, setPageDescription] = useState("");
  const [pageEditableByUser, setPageEditableByUser] = useState(false);
  const [selectedParentPageId, setSelectedParentPageId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [nodeTitle, setNodeTitle] = useState("");
  const [nodeSortOrder, setNodeSortOrder] = useState("0");
  const [advancedNodePropsText, setAdvancedNodePropsText] = useState("{}");
  const [selectedProductForNode, setSelectedProductForNode] = useState("");
  const [selectedStepForNode, setSelectedStepForNode] = useState("");
  const [libraryLayoutStyle, setLibraryLayoutStyle] = useState<LibraryLayoutStyle>(
    DEFAULT_LIBRARY_LAYOUT_STYLE
  );
  const [libraryRandomness, setLibraryRandomness] = useState<LibraryRandomness>(
    DEFAULT_LIBRARY_RANDOMNESS
  );
  const [libraryViewInGallery, setLibraryViewInGallery] = useState(false);
  const [libraryOpenInModal, setLibraryOpenInModal] = useState(false);
  const [libraryWidthOptionsText, setLibraryWidthOptionsText] = useState("1");
  const [libraryHeightOptionsText, setLibraryHeightOptionsText] = useState("6,8,10");
  const [textNodeTitle, setTextNodeTitle] = useState(DEFAULT_TEXT_NODE_TITLE);
  const [textNodeSubtitle, setTextNodeSubtitle] = useState(DEFAULT_TEXT_NODE_SUBTITLE);
  const [textNodeVariableSource, setTextNodeVariableSource] =
    useState<TextVariableSource>(DEFAULT_TEXT_NODE_VARIABLE);
  const [textNodeVariableTarget, setTextNodeVariableTarget] =
    useState<TextVariableTarget>(DEFAULT_TEXT_NODE_VARIABLE_TARGET);
  const [textNodeTitleFontSize, setTextNodeTitleFontSize] = useState(
    String(DEFAULT_TEXT_NODE_TITLE_FONT_SIZE)
  );
  const [textNodeTitleFontWeight, setTextNodeTitleFontWeight] = useState(
    DEFAULT_TEXT_NODE_TITLE_FONT_WEIGHT
  );
  const [textNodeSubtitleFontSize, setTextNodeSubtitleFontSize] = useState(
    String(DEFAULT_TEXT_NODE_SUBTITLE_FONT_SIZE)
  );
  const [textNodeSubtitleFontWeight, setTextNodeSubtitleFontWeight] = useState(
    DEFAULT_TEXT_NODE_SUBTITLE_FONT_WEIGHT
  );
  const [textNodeTextAlign, setTextNodeTextAlign] = useState<TextAlign>(
    DEFAULT_TEXT_NODE_TEXT_ALIGN
  );
  const [textNodeTitleColor, setTextNodeTitleColor] = useState(
    DEFAULT_TEXT_NODE_TITLE_COLOR
  );
  const [textNodeSubtitleColor, setTextNodeSubtitleColor] = useState(
    DEFAULT_TEXT_NODE_SUBTITLE_COLOR
  );
  const [nodeSearch, setNodeSearch] = useState("");
  const [previewBreakpoint, setPreviewBreakpoint] =
    useState<keyof typeof PREVIEW_BREAKPOINTS>("lg");
  const [pageLayouts, setPageLayouts] = useState<Record<string, GridLayoutItem[]>>(
    () => buildLayoutsFromPage(null)
  );

  const pages = useMemo(() => (pagesQuery.data ?? []) as PageItem[], [pagesQuery.data]);
  const pageLimitReached =
    (currentTenantQuery.data?.policy?.maxPages ?? null) !== null &&
    (currentTenantQuery.data?.usage.pages ?? 0) >=
      (currentTenantQuery.data?.policy?.maxPages ?? 0);
  const allowUserEditablePages =
    currentTenantQuery.data?.policy?.allowUserEditablePages ?? true;
  const runtimePagesConfig = useMemo(() => buildRuntimePagesConfig(pages), [pages]);
  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? null,
    [pages, selectedPageId]
  );
  const selectedNode = useMemo(
    () => selectedPage?.items?.find((node) => node.id === selectedNodeId) ?? null,
    [selectedNodeId, selectedPage]
  );
  const selectedProductDetailsQuery = api.products.byId.useQuery(
    { productId: selectedProductForNode },
    { enabled: Boolean(selectedProductForNode) }
  );
  const selectedProductDetails = selectedProductDetailsQuery.data as
    | { steps?: ProductStepOption[]; assets?: Array<Record<string, unknown>> }
    | undefined;
  const selectedProductSteps = selectedProductDetails?.steps ?? [];
  const selectedProductLibraryAssets = useMemo(
    () =>
      (selectedProductDetails?.assets ?? [])
        .filter((asset) => {
          if (asset.stepId) return false;
          if (asset.moduleType === "COURSE") return false;
          if (asset.placement === "STEP") return false;
          return true;
        })
        .map((asset) => ({
          id: String(asset.id ?? ""),
          title: String(asset.title ?? ""),
          url: String(asset.url ?? ""),
          type: String(asset.type ?? "FILE"),
          targetUrl:
            typeof asset.targetUrl === "string" ? asset.targetUrl : null,
          openInNewTab:
            typeof asset.openInNewTab === "boolean" ? asset.openInNewTab : null,
          previewUrl:
            typeof asset.previewUrl === "string" ? asset.previewUrl : null,
          thumbnailUrl:
            typeof asset.thumbnailUrl === "string" ? asset.thumbnailUrl : null,
        }))
        .filter((asset) => Boolean(asset.id) && Boolean(asset.url)),
    [selectedProductDetails?.assets]
  );
  const selectedProductPreview =
    (productsQuery.data ?? []).find((product) => product.id === selectedProductForNode) ??
    null;
  const selectedStepPreview =
    selectedProductSteps.find((step) => step.id === selectedStepForNode) ?? null;
  const selectedParent = useMemo(
    () =>
      selectedPage?.parentPageId
        ? pages.find((page) => page.id === selectedPage.parentPageId) ?? null
        : null,
    [pages, selectedPage]
  );
  const selectedPageFallbackProductId = useMemo(() => {
    const libraryNode = (selectedPage?.items ?? []).find((item) =>
      isLibraryViewNodeType(item.type)
    );
    const props = (libraryNode?.props ?? {}) as Record<string, unknown>;
    return typeof props.productId === "string" ? props.productId : "";
  }, [selectedPage]);

  const pagesByParent = useMemo(() => {
    const grouped = new Map<string | null, PageItem[]>();
    grouped.set(null, []);

    for (const page of pages) {
      const key = page.parentPageId ?? null;
      const current = grouped.get(key) ?? [];
      current.push(page);
      grouped.set(key, current);
    }

    for (const [key, list] of grouped) {
      grouped.set(
        key,
        [...list].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
        )
      );
    }

    return grouped;
  }, [pages]);
  const rootPages = useMemo(() => pagesByParent.get(null) ?? [], [pagesByParent]);
  const parentLevelPages = useMemo(() => {
    if (!selectedParent) return [];
    return pagesByParent.get(selectedParent.parentPageId ?? null) ?? [];
  }, [pagesByParent, selectedParent]);
  const selectedLevelPages = useMemo(() => {
    if (!selectedPage) return rootPages;
    return pagesByParent.get(selectedPage.parentPageId ?? null) ?? [];
  }, [pagesByParent, rootPages, selectedPage]);
  const childPages = useMemo(() => {
    if (!selectedPage) return [];
    return pagesByParent.get(selectedPage.id) ?? [];
  }, [pagesByParent, selectedPage]);
  const nodeCatalogEntries = useMemo(() => {
    const entries = Object.entries(
      componentsCatalog as Record<string, NodeCatalogConfig>
    );
    const deduped = new Map<
      string,
      { key: string; logicalType: string; config: NodeCatalogConfig }
    >();

    for (const [key, config] of entries) {
      if (config.internal) continue;
      const logicalType = logicalNodeType(key);
      const existing = deduped.get(logicalType);
      if (!existing) {
        deduped.set(logicalType, { key, logicalType, config });
        continue;
      }
      if (existing.key.startsWith("node-") && !key.startsWith("node-")) {
        deduped.set(logicalType, { key, logicalType, config });
      }
    }

    return Array.from(deduped.values()).sort((a, b) =>
      (a.config.name ?? titleFromType(a.key)).localeCompare(
        b.config.name ?? titleFromType(b.key)
      )
    );
  }, []);
  const filteredNodeCatalogEntries = useMemo(() => {
    const query = nodeSearch.trim().toLowerCase();
    if (!query) return nodeCatalogEntries.slice(0, 12);
    return nodeCatalogEntries
      .filter(({ key, logicalType, config }) => {
        const haystack = [
          key,
          logicalType,
          config.name ?? "",
          config.description ?? "",
          ...(config.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 12);
  }, [nodeCatalogEntries, nodeSearch]);

  const upsertPageMutation = api.nodePages.upsertPage.useMutation({
    onSuccess: async (page) => {
      await utils.nodePages.list.invalidate();
      selectPage(page.id);
    },
  });
  const removePageMutation = api.nodePages.removePage.useMutation({
    onSuccess: async () => {
      setSelectedPageId("");
      setSelectedNodeId("");
      setPageName("");
      setPageDescription("");
      setPageEditableByUser(false);
      await utils.nodePages.list.invalidate();
    },
  });
  const addNodeMutation = api.nodePages.addNode.useMutation({
    onSuccess: async () => {
      await utils.nodePages.list.invalidate();
    },
  });
  const updateNodeMutation = api.nodePages.updateNode.useMutation({
    onSuccess: async () => {
      await utils.nodePages.list.invalidate();
    },
  });
  const removeNodeMutation = api.nodePages.removeNode.useMutation({
    onSuccess: async () => {
      setSelectedNodeId("");
      await utils.nodePages.list.invalidate();
    },
  });

  function selectPage(pageId: string) {
    const page = pages.find((entry) => entry.id === pageId) ?? null;
    setSelectedPageId(pageId);
    setPageName(page?.name ?? "");
    setPageDescription(page?.description ?? "");
    setPageEditableByUser(page ? readEditableByUser(page) : false);
    setSelectedParentPageId(page?.parentPageId ?? "");
    setSelectedNodeId("");
    setNodeTitle("");
    setNodeSortOrder("0");
    setAdvancedNodePropsText("{}");
    setSelectedProductForNode("");
    setSelectedStepForNode("");
    setLibraryLayoutStyle(DEFAULT_LIBRARY_LAYOUT_STYLE);
    setLibraryRandomness(DEFAULT_LIBRARY_RANDOMNESS);
    setLibraryViewInGallery(false);
    setLibraryOpenInModal(false);
    setLibraryWidthOptionsText("1");
    setLibraryHeightOptionsText("6,8,10");
    setTextNodeTitle(DEFAULT_TEXT_NODE_TITLE);
    setTextNodeSubtitle(DEFAULT_TEXT_NODE_SUBTITLE);
    setTextNodeVariableSource(DEFAULT_TEXT_NODE_VARIABLE);
    setTextNodeVariableTarget(DEFAULT_TEXT_NODE_VARIABLE_TARGET);
    setTextNodeTitleFontSize(String(DEFAULT_TEXT_NODE_TITLE_FONT_SIZE));
    setTextNodeTitleFontWeight(DEFAULT_TEXT_NODE_TITLE_FONT_WEIGHT);
    setTextNodeSubtitleFontSize(String(DEFAULT_TEXT_NODE_SUBTITLE_FONT_SIZE));
    setTextNodeSubtitleFontWeight(DEFAULT_TEXT_NODE_SUBTITLE_FONT_WEIGHT);
    setTextNodeTextAlign(DEFAULT_TEXT_NODE_TEXT_ALIGN);
    setTextNodeTitleColor(DEFAULT_TEXT_NODE_TITLE_COLOR);
    setTextNodeSubtitleColor(DEFAULT_TEXT_NODE_SUBTITLE_COLOR);
    setPageLayouts(buildLayoutsFromPage(page));
  }

  function selectNode(nodeId: string) {
    const node = selectedPage?.items?.find((entry) => entry.id === nodeId) ?? null;
    if (!node) return;
    const props = (node.props ?? {}) as Record<string, unknown>;
    setSelectedNodeId(nodeId);
    setNodeTitle(node.title ?? "");
    setNodeSortOrder(String(node.sortOrder ?? 0));
    setAdvancedNodePropsText(JSON.stringify(props, null, 2));
    setSelectedProductForNode(
      (typeof props.productId === "string" ? props.productId : node.productId) ?? ""
    );
    setSelectedStepForNode(
      (typeof props.stepId === "string" ? props.stepId : node.stepId) ?? ""
    );
    setLibraryLayoutStyle(readLibraryLayoutStyle(props));
    setLibraryRandomness(readLibraryRandomness(props));
    setLibraryViewInGallery(readLibraryViewInGallery(props));
    setLibraryOpenInModal(readLibraryOpenInModal(props));
    const itemLayout = readLibraryItemLayout(props);
    setLibraryWidthOptionsText(itemLayout.w.join(","));
    setLibraryHeightOptionsText(itemLayout.h.join(","));
    setTextNodeTitle(readTextNodeTitle(props));
    setTextNodeSubtitle(readTextNodeSubtitle(props));
    setTextNodeVariableSource(readTextVariableSource(props));
    setTextNodeVariableTarget(readTextVariableTarget(props));
    setTextNodeTitleFontSize(String(readTextNodeTitleFontSize(props)));
    setTextNodeTitleFontWeight(readTextNodeTitleFontWeight(props));
    setTextNodeSubtitleFontSize(String(readTextNodeSubtitleFontSize(props)));
    setTextNodeSubtitleFontWeight(readTextNodeSubtitleFontWeight(props));
    setTextNodeTextAlign(readTextNodeTextAlign(props));
    setTextNodeTitleColor(readTextNodeTitleColor(props));
    setTextNodeSubtitleColor(readTextNodeSubtitleColor(props));
  }

  async function createPage(parentPageId?: string) {
    if (pageLimitReached) return;

    const existing = new Set(pages.map((page) => page.slug.replace(/^\/+|\/+$/g, "")));
    let slug = "new-page";
    let index = 0;
    while (existing.has(slug)) {
      index += 1;
      slug = `new-page-${index}`;
    }
    await upsertPageMutation.mutateAsync({
      name: index === 0 ? "New page" : `New page ${index}`,
      slug,
      parentPageId,
      description: "",
      requiresAuth: true,
      editableByUser: false,
      internalRoute: false,
      indexable: true,
      hidden: false,
      sortOrder: 10,
    });
  }

  useEffect(() => {
    setPageLayouts(buildLayoutsFromPage(selectedPage));
  }, [selectedPage]);

  useEffect(() => {
    if (allowUserEditablePages || !pageEditableByUser) return;
    setPageEditableByUser(false);
  }, [allowUserEditablePages, pageEditableByUser]);

  async function saveGridLayout() {
    if (!selectedPage) return;

    const layoutsByBreakpoint = {
      lg: new Map((pageLayouts.lg ?? []).map((entry) => [entry.i, entry])),
      sm: new Map((pageLayouts.sm ?? []).map((entry) => [entry.i, entry])),
      xs: new Map((pageLayouts.xs ?? []).map((entry) => [entry.i, entry])),
    };
    const updates = (selectedPage.items ?? [])
      .map((node) => {
        const fallback = parseNodePosition(node.position);
        const lgPosition = layoutsByBreakpoint.lg.get(node.id);
        const smPosition = layoutsByBreakpoint.sm.get(node.id);
        const xsPosition = layoutsByBreakpoint.xs.get(node.id);
        return updateNodeMutation.mutateAsync({
          nodeId: node.id,
          position: {
            lg: clampGridItem(
              lgPosition ?? { i: node.id, ...fallback.lg },
              GRID_COLS.lg
            ),
            sm: clampGridItem(
              smPosition ?? { i: node.id, ...fallback.sm },
              GRID_COLS.sm
            ),
            xs: clampGridItem(
              xsPosition ?? { i: node.id, ...fallback.xs },
              GRID_COLS.xs
            ),
          },
        });
      })
      .filter(Boolean) as Array<Promise<unknown>>;

    if (!updates.length) return;
    await Promise.all(updates);
  }

  async function addCatalogNode(nodeType: string, config: NodeCatalogConfig) {
    if (!selectedPage) return;

    const baseY = (pageLayouts.lg ?? []).reduce(
      (max, item) => Math.max(max, item.y + item.h),
      0
    );
    const rawW = Array.isArray(config.defaultLayout?.w)
      ? config.defaultLayout?.w[0]
      : config.defaultLayout?.w;
    const rawH = Array.isArray(config.defaultLayout?.h)
      ? config.defaultLayout?.h[0]
      : config.defaultLayout?.h;
    const width = Math.max(1, Math.min(Number(rawW) || 1, GRID_COLS.lg));
    const height = Math.max(2, Number(rawH) || 6);
    const props = isLibraryViewNodeType(nodeType)
      ? selectedProductForNode
        ? buildLibraryViewProps(
            selectedProductForNode,
            DEFAULT_LIBRARY_LAYOUT_STYLE,
            DEFAULT_LIBRARY_RANDOMNESS,
            false,
            false,
            selectedProductLibraryAssets,
            { w: [1], h: [6, 8, 10] }
          )
        : {}
      : isTextNodeType(nodeType)
        ? buildTextNodeProps(
            DEFAULT_TEXT_NODE_TITLE,
            DEFAULT_TEXT_NODE_SUBTITLE,
            DEFAULT_TEXT_NODE_VARIABLE,
            DEFAULT_TEXT_NODE_VARIABLE_TARGET,
            DEFAULT_TEXT_NODE_TITLE_FONT_SIZE,
            DEFAULT_TEXT_NODE_TITLE_FONT_WEIGHT,
            DEFAULT_TEXT_NODE_SUBTITLE_FONT_SIZE,
            DEFAULT_TEXT_NODE_SUBTITLE_FONT_WEIGHT,
            DEFAULT_TEXT_NODE_TEXT_ALIGN,
            DEFAULT_TEXT_NODE_TITLE_COLOR,
            DEFAULT_TEXT_NODE_SUBTITLE_COLOR
          )
        : isStepViewerNodeType(nodeType)
          ? selectedProductForNode
            ? {
                productId: selectedProductForNode,
                title: "Course steps",
              }
            : {}
        : {};

    await addNodeMutation.mutateAsync({
      pageId: selectedPage.id,
      nodeKey: createNodeKey(nodeType),
      title: config.name ?? titleFromType(nodeType),
      type: nodeType,
      props,
      productId: isStepViewerNodeType(nodeType)
        ? selectedProductForNode || undefined
        : undefined,
      position: {
        lg: { x: 0, y: baseY, w: width, h: height },
        sm: { x: 0, y: baseY, w: Math.min(width, 3), h: height },
        xs: { x: 0, y: baseY, w: Math.min(width, 2), h: height },
      },
      sortOrder: (selectedPage.items?.length ?? 0) + 1,
    });
  }

  function renderPageRow(
    levelPages: PageItem[],
    activePageId: string | null,
    addParentId: string | null,
    addLabel = "Add page"
  ) {
    if (!levelPages.length) return null;

    return (
      <div
        className="grid items-center gap-3"
        style={{
          gridTemplateColumns: `repeat(${levelPages.length}, minmax(0, 1fr)) 52px`,
        }}
      >
        {levelPages.map((page) => {
          const isActive = page.id === activePageId;
          const isUserLocked = !readEditableByUser(page);
          return (
            <button
              key={page.id}
              type="button"
              onClick={() => selectPage(page.id)}
              className={`min-h-[72px] rounded-2xl border px-3 py-3 text-left transition ${
                isActive
                  ? "border-white bg-zinc-100 text-black"
                  : "border-white/80 bg-transparent text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-mono text-[12px] font-semibold uppercase tracking-[0.14em]">
                  {page.name}
                </p>
                {isUserLocked ? (
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      isActive
                        ? "bg-black/10 text-black/75"
                        : "border border-white/10 bg-white/5 text-zinc-300"
                    }`}
                  >
                    <Lock className="h-3 w-3" />
                    Locked
                  </span>
                ) : null}
              </div>
              <p
                className={`mt-2 truncate text-[11px] ${
                  isActive ? "text-black/70" : "text-zinc-400"
                }`}
              >
                {slugPath(page.slug)}
              </p>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => void createPage(addParentId ?? undefined)}
          disabled={pageLimitReached}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-white/80 bg-transparent text-white transition hover:bg-white/5"
          aria-label={addLabel}
          title={addLabel}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  function renderConnector(levelPages: PageItem[], fromPageId: string | null) {
    if (!levelPages.length || !fromPageId) return null;
    const columnIndex = levelPages.findIndex((page) => page.id === fromPageId);
    if (columnIndex < 0) return null;

    return (
      <div
        className="mt-1 grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${levelPages.length}, minmax(0, 1fr)) 52px`,
        }}
      >
        <div
          className="flex justify-center"
          style={{ gridColumn: `${columnIndex + 1} / span 1` }}
        >
          <div className="h-6 w-px bg-white/70" />
        </div>
      </div>
    );
  }

  function renderChildAdd(levelPages: PageItem[], fromPageId: string) {
    if (!levelPages.length) return null;
    const columnIndex = levelPages.findIndex((page) => page.id === fromPageId);
    if (columnIndex < 0) return null;

    return (
      <div
        className="mt-1 grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${levelPages.length}, minmax(0, 1fr)) 52px`,
        }}
      >
        <div
          className="flex justify-center"
          style={{ gridColumn: `${columnIndex + 1} / span 1` }}
        >
          <button
            type="button"
            onClick={() => void createPage(fromPageId)}
            disabled={pageLimitReached}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-2xl border border-white/80 bg-transparent text-white transition hover:bg-white/5"
            aria-label="Add child page"
            title="Add child page"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  function renderHierarchyNavigator() {
    if (!pages.length) {
      return (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
          No pages yet.
        </div>
      );
    }

    if (!selectedPage) {
      return (
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              Root navigation
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Pick a page to edit it, or add a new root page on the same row.
            </p>
          </div>
          {renderPageRow(rootPages, null, null, "Add root page")}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {selectedParent ? (
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              Parent level
            </p>
            {renderPageRow(
              parentLevelPages,
              selectedParent.id,
              selectedParent.parentPageId ?? null,
              "Add page on parent level"
            )}
            {renderConnector(parentLevelPages, selectedParent.id)}
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
            Current level
          </p>
          {renderPageRow(
            selectedLevelPages,
            selectedPage.id,
            selectedPage.parentPageId ?? null,
            "Add page on current level"
          )}
          {renderConnector(selectedLevelPages, selectedPage.id)}
          {childPages.length
            ? renderPageRow(childPages, null, selectedPage.id, "Add child page")
            : renderChildAdd(selectedLevelPages, selectedPage.id)}
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      title="Pages"
      description="Create tenant pages, manage hierarchy, and edit the nodes that live inside each page."
      actions={
        <Button
          className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400"
          disabled={pageLimitReached}
          onClick={() => void createPage()}
        >
          <Plus className="mr-2 h-4 w-4" />
          {pageLimitReached ? "Page limit reached" : "New root page"}
        </Button>
      }
    >
      <div className="space-y-4">
        {pageLimitReached ? (
          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            This tenant is at its configured page limit. Remove an existing custom page or ask a
            global admin to raise the cap.
          </div>
        ) : null}
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Waypoints className="h-4 w-4 text-sky-300" />
            <h2 className="text-lg font-semibold text-white">Page hierarchy</h2>
          </div>
          <p className="mb-5 text-sm text-zinc-400">
            This now mirrors the original platform navigator: siblings stay on one row, and child creation hangs directly below the selected page.
          </p>
          {renderHierarchyNavigator()}
        </div>

        {selectedPage ? (
          <>
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                      Page editor
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">
                        {selectedPage.name}
                      </h2>
                      {!readEditableByUser(selectedPage) ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                          <Lock className="h-3 w-3" />
                          Locked for users
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={slugPath(selectedPage.slug) as any}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-zinc-200 hover:bg-white/5"
                    >
                      Open page
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                    {!selectedPage.isSystem ? (
                      <Button
                        className="h-10 rounded-xl border-red-500/30 bg-red-500/80 px-4 text-sm font-semibold text-black hover:bg-red-400 disabled:opacity-50"
                        disabled={removePageMutation.isPending}
                        onClick={() =>
                          removePageMutation.mutate({ pageId: selectedPage.id })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
                  <div className="space-y-3">
                    <input
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                      value={pageName}
                      onChange={(event) => setPageName(event.target.value)}
                      placeholder="Page name"
                    />
                    <textarea
                      className="h-24 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                      value={pageDescription}
                      onChange={(event) => setPageDescription(event.target.value)}
                      placeholder="Page description"
                    />
                    <select
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                      value={selectedParentPageId}
                      onChange={(event) => setSelectedParentPageId(event.target.value)}
                      disabled={selectedPage.isSystem}
                    >
                      <option value="">No parent page</option>
                      {pages
                        .filter((page) => page.id !== selectedPage.id)
                        .map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.name}
                          </option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={pageEditableByUser}
                        onChange={(event) =>
                          setPageEditableByUser(event.target.checked)
                        }
                        disabled={selectedPage.isSystem || !allowUserEditablePages}
                      />
                      Page editable by user
                    </label>
                    {!selectedPage.isSystem ? (
                      <Button
                        className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                        disabled={!pageName.trim() || upsertPageMutation.isPending}
                        onClick={() =>
                          upsertPageMutation.mutate({
                            pageId: selectedPage.id,
                            name: pageName.trim(),
                            slug: toPageSlug(pageName),
                            description: pageDescription.trim() || undefined,
                            parentPageId: selectedParentPageId || undefined,
                            requiresAuth: selectedPage.requiresAuth,
                            editableByUser: pageEditableByUser,
                            internalRoute: selectedPage.internalRoute,
                            indexable: selectedPage.indexable,
                            hidden: selectedPage.hidden,
                            sortOrder: selectedPage.sortOrder,
                          })
                        }
                      >
                        Save page settings
                      </Button>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
                        System pages cannot be edited here.
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Current route
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {slugPath(selectedPage.slug)}
                      </p>
                      <p className="mt-2 text-sm text-zinc-400">
                        Parent:{" "}
                        {selectedPage.parentPageId
                          ? pages.find((page) => page.id === selectedPage.parentPageId)?.name ??
                            "Unknown"
                          : "Root"}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm font-semibold text-white">Child pages</p>
                      <div className="mt-3 space-y-2">
                        {pages
                          .filter((page) => page.parentPageId === selectedPage.id)
                          .map((page) => (
                            <button
                              key={page.id}
                              type="button"
                              onClick={() => selectPage(page.id)}
                              className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-left text-sm text-zinc-300 hover:bg-white/5"
                            >
                              {page.name}
                            </button>
                          ))}
                        <Button
                          className="h-10 w-full rounded-xl border-sky-500/30 bg-sky-500 text-sm font-semibold text-black hover:bg-sky-400"
                          onClick={() => void createPage(selectedPage.id)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add child page
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Package2 className="h-4 w-4 text-amber-300" />
                      <h2 className="text-lg font-semibold text-white">
                        Node library
                      </h2>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                          Quick add
                        </p>
                        <select
                          className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                          value={selectedProductForNode}
                          onChange={(event) => {
                            setSelectedProductForNode(event.target.value);
                            setSelectedStepForNode("");
                          }}
                        >
                          <option value="">Select product...</option>
                          {(productsQuery.data ?? []).map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                        <div className="grid gap-2">
                          <Button
                            className="h-11 rounded-xl border-violet-500/30 bg-violet-500 px-4 text-sm font-semibold text-black hover:bg-violet-400 disabled:opacity-50"
                            disabled={!selectedProductForNode || addNodeMutation.isPending}
                            onClick={() =>
                              addNodeMutation.mutate({
                                pageId: selectedPage.id,
                                nodeKey: createNodeKey("library_view"),
                                title:
                                  selectedProductPreview?.name
                                    ? `${selectedProductPreview.name} library`
                                    : "Library view",
                                type: "library_view",
                                productId: selectedProductForNode || undefined,
                                props: buildLibraryViewProps(
                                  selectedProductForNode,
                                  DEFAULT_LIBRARY_LAYOUT_STYLE,
                                  DEFAULT_LIBRARY_RANDOMNESS,
                                  false,
                                  false,
                                  selectedProductLibraryAssets,
                                  { w: [1], h: [6, 8, 10] }
                                ),
                                position: libraryViewPosition,
                                sortOrder: Number(nodeSortOrder || "0") + 1,
                              })
                            }
                          >
                            Add library view
                          </Button>
                          <Button
                            className="h-11 rounded-xl border-sky-500/30 bg-sky-500 px-4 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
                            disabled={addNodeMutation.isPending}
                            onClick={() =>
                              addNodeMutation.mutate({
                                pageId: selectedPage.id,
                                nodeKey: createNodeKey("text"),
                                title: "Text node",
                                type: "text",
                                props: buildTextNodeProps(
                                  DEFAULT_TEXT_NODE_TITLE,
                                  DEFAULT_TEXT_NODE_SUBTITLE,
                                  DEFAULT_TEXT_NODE_VARIABLE,
                                  DEFAULT_TEXT_NODE_VARIABLE_TARGET,
                                  DEFAULT_TEXT_NODE_TITLE_FONT_SIZE,
                                  DEFAULT_TEXT_NODE_TITLE_FONT_WEIGHT,
                                  DEFAULT_TEXT_NODE_SUBTITLE_FONT_SIZE,
                                  DEFAULT_TEXT_NODE_SUBTITLE_FONT_WEIGHT,
                                  DEFAULT_TEXT_NODE_TEXT_ALIGN,
                                  DEFAULT_TEXT_NODE_TITLE_COLOR,
                                  DEFAULT_TEXT_NODE_SUBTITLE_COLOR
                                ),
                                position: textNodePosition,
                                sortOrder: Number(nodeSortOrder || "0") + 1,
                              })
                            }
                          >
                            Add text node
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-zinc-500" />
                          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                            Search `_nodes`
                          </p>
                        </div>
                        <input
                          className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                          placeholder="Search nodes by name, type, or tag"
                          value={nodeSearch}
                          onChange={(event) => setNodeSearch(event.target.value)}
                        />
                        <div className="grid gap-2">
                          {filteredNodeCatalogEntries.map(({ key, config }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => void addCatalogNode(key, config)}
                              className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-left transition hover:border-sky-400/40 hover:bg-white/5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white">
                                    {config.name ?? titleFromType(key)}
                                  </p>
                                  <p className="mt-1 truncate text-[11px] text-zinc-500">
                                    {key}
                                  </p>
                                </div>
                                <span className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                                  Add
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-zinc-400">
                                {config.description ?? "Drop this node into the page grid."}
                              </p>
                            </button>
                          ))}
                          {!filteredNodeCatalogEntries.length ? (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
                              No matching nodes found.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                    <h2 className="text-lg font-semibold text-white">Node editor</h2>
                    <div className="mt-4 space-y-3">
                      {selectedNode ? (
                        <>
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                              Selected node
                            </p>
                            <p className="mt-2 text-lg font-semibold text-white">
                              {selectedNode.nodeKey}
                            </p>
                            <p className="mt-1 text-sm text-zinc-400">
                              {selectedNode.type}
                            </p>
                          </div>

                          <input
                            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                            placeholder="Node title"
                            value={nodeTitle}
                            onChange={(event) => setNodeTitle(event.target.value)}
                          />

                          <input
                            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                            placeholder="Sort order"
                            value={nodeSortOrder}
                            onChange={(event) => setNodeSortOrder(event.target.value)}
                          />

                          {selectedNode.type === "node-product" ? (
                            <>
                              <select
                                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                value={selectedProductForNode}
                                onChange={(event) => {
                                  setSelectedProductForNode(event.target.value);
                                  setSelectedStepForNode("");
                                }}
                              >
                                <option value="">Select product...</option>
                                {(productsQuery.data ?? []).map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                  Product preview
                                </p>
                                <p className="mt-2 text-lg font-semibold text-white">
                                  {selectedProductPreview?.name ?? "Select a product"}
                                </p>
                                <p className="mt-1 text-sm text-zinc-400">
                                  {selectedProductPreview?.description ??
                                    "This node will render the selected product card inside the page."}
                                </p>
                              </div>
                            </>
                          ) : null}

                          {selectedNode.type === "node-course-step" ? (
                            <>
                              <select
                                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                value={selectedProductForNode}
                                onChange={(event) => {
                                  setSelectedProductForNode(event.target.value);
                                  setSelectedStepForNode("");
                                }}
                              >
                                <option value="">Select product...</option>
                                {(productsQuery.data ?? []).map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>

                              <select
                                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                value={selectedStepForNode}
                                onChange={(event) => setSelectedStepForNode(event.target.value)}
                              >
                                <option value="">Select step...</option>
                                {selectedProductSteps.map((step) => (
                                  <option key={step.id} value={step.id}>
                                    {step.title}
                                  </option>
                                ))}
                              </select>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                  Step preview
                                </p>
                                <p className="mt-2 text-lg font-semibold text-white">
                                  {selectedStepPreview?.title ?? "Select a course step"}
                                </p>
                                <p className="mt-1 text-sm text-zinc-400">
                                  {selectedStepPreview?.description ??
                                    "This node will render the selected course step inside the page."}
                                </p>
                              </div>
                            </>
                          ) : null}

                          {isStepViewerNodeType(selectedNode.type) ? (
                            <>
                              <select
                                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                value={selectedProductForNode}
                                onChange={(event) => {
                                  setSelectedProductForNode(event.target.value);
                                  setSelectedStepForNode("");
                                }}
                              >
                                <option value="">Select product...</option>
                                {(productsQuery.data ?? []).map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                  Step viewer product
                                </p>
                                <p className="mt-2 text-lg font-semibold text-white">
                                  {selectedProductPreview?.name ?? "Select a product"}
                                </p>
                                <p className="mt-1 text-sm text-zinc-400">
                                  This node renders the selected product&apos;s course step flow.
                                </p>
                              </div>
                            </>
                          ) : null}

                          {isLibraryViewNodeType(selectedNode.type) ? (
                            <>
                              <select
                                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                value={selectedProductForNode}
                                onChange={(event) => setSelectedProductForNode(event.target.value)}
                              >
                                <option value="">Select product...</option>
                                {(productsQuery.data ?? []).map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                  Item grid config
                                </p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <p className="mb-2 text-xs text-zinc-400">
                                      Width options
                                    </p>
                                    <input
                                      className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none transition focus:border-sky-400/50"
                                      value={libraryWidthOptionsText}
                                      onChange={(event) =>
                                        setLibraryWidthOptionsText(event.target.value)
                                      }
                                      placeholder="1"
                                    />
                                  </div>
                                  <div>
                                    <p className="mb-2 text-xs text-zinc-400">
                                      Height options
                                    </p>
                                    <input
                                      className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none transition focus:border-sky-400/50"
                                      value={libraryHeightOptionsText}
                                      onChange={(event) =>
                                        setLibraryHeightOptionsText(event.target.value)
                                      }
                                      placeholder="6,8,10"
                                    />
                                  </div>
                                </div>
                                <p className="mt-3 text-xs text-zinc-400">
                                  Use comma-separated values like `w: [1]` and `h: [6,8,10]`.
                                  Each library item is randomized using these exact size options.
                                </p>
                                <label className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                                  <input
                                    type="checkbox"
                                    checked={libraryViewInGallery}
                                    onChange={(event) => {
                                      const checked = event.target.checked;
                                      setLibraryViewInGallery(checked);
                                      if (checked) {
                                        setLibraryOpenInModal(false);
                                      }
                                    }}
                                  />
                                  Open selected item inside the gallery
                                </label>
                                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                                  <input
                                    type="checkbox"
                                    checked={libraryOpenInModal}
                                    onChange={(event) => {
                                      const checked = event.target.checked;
                                      setLibraryOpenInModal(checked);
                                      if (checked) {
                                        setLibraryViewInGallery(false);
                                      }
                                    }}
                                  />
                                  Open selected item in a modal
                                </label>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                  Library preview
                                </p>
                                <p className="mt-2 text-lg font-semibold text-white">
                                  {selectedProductPreview?.name ?? "Select a product"}
                                </p>
                                <p className="mt-1 text-sm text-zinc-400">
                                  This node renders the selected product library as real page-grid
                                  items. Gallery mode keeps the selected asset in the same page,
                                  while modal mode opens the asset in an overlay like the step
                                  viewer.
                                </p>
                              </div>
                            </>
                          ) : null}

                          {isTextNodeType(selectedNode.type) ? (
                            <>
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                  Text content
                                </p>
                                <div className="mt-3 grid gap-3">
                                  <input
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                    value={textNodeTitle}
                                    onChange={(event) => setTextNodeTitle(event.target.value)}
                                    placeholder="Title"
                                  />
                                  <textarea
                                    className="h-24 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                    value={textNodeSubtitle}
                                    onChange={(event) => setTextNodeSubtitle(event.target.value)}
                                    placeholder="Subtitle"
                                  />
                                </div>
                                <p className="mt-3 text-xs text-zinc-400">
                                  Use <code>{"{{value}}"}</code> in either field to inject the
                                  selected variable. Without the token, the chosen target field is
                                  replaced by the variable value.
                                </p>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                  Variable
                                </p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <select
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                    value={textNodeVariableSource}
                                    onChange={(event) =>
                                      setTextNodeVariableSource(
                                        event.target.value as TextVariableSource
                                      )
                                    }
                                  >
                                    <option value="none">Custom text only</option>
                                    <option value="product_name">Product name</option>
                                    <option value="company_name">Company name</option>
                                  </select>
                                  <select
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                    value={textNodeVariableTarget}
                                    onChange={(event) =>
                                      setTextNodeVariableTarget(
                                        event.target.value as TextVariableTarget
                                      )
                                    }
                                    disabled={textNodeVariableSource === "none"}
                                  >
                                    <option value="title">Fill title</option>
                                    <option value="subtitle">Fill subtitle</option>
                                    <option value="both">Fill both</option>
                                  </select>
                                  {textNodeVariableSource === "product_name" ? (
                                    <select
                                      className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50 sm:col-span-2"
                                      value={selectedProductForNode}
                                      onChange={(event) =>
                                        setSelectedProductForNode(event.target.value)
                                      }
                                    >
                                      <option value="">Use page library product...</option>
                                      {(productsQuery.data ?? []).map((product) => (
                                        <option key={product.id} value={product.id}>
                                          {product.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="flex h-11 items-center rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-zinc-400 sm:col-span-2">
                                      {textNodeVariableSource === "company_name"
                                        ? "Uses the current tenant/company name."
                                        : "No variable linked."}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                  Style
                                </p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <input
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                    value={textNodeTitleFontSize}
                                    onChange={(event) =>
                                      setTextNodeTitleFontSize(event.target.value)
                                    }
                                    placeholder="Title size"
                                  />
                                  <select
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                    value={textNodeTitleFontWeight}
                                    onChange={(event) =>
                                      setTextNodeTitleFontWeight(event.target.value)
                                    }
                                  >
                                    <option value="400">Regular</option>
                                    <option value="500">Medium</option>
                                    <option value="600">Semibold</option>
                                    <option value="700">Bold</option>
                                    <option value="800">Extra bold</option>
                                  </select>
                                  <input
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                    value={textNodeSubtitleFontSize}
                                    onChange={(event) =>
                                      setTextNodeSubtitleFontSize(event.target.value)
                                    }
                                    placeholder="Subtitle size"
                                  />
                                  <select
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                    value={textNodeSubtitleFontWeight}
                                    onChange={(event) =>
                                      setTextNodeSubtitleFontWeight(event.target.value)
                                    }
                                  >
                                    <option value="400">Regular</option>
                                    <option value="500">Medium</option>
                                    <option value="600">Semibold</option>
                                    <option value="700">Bold</option>
                                  </select>
                                  <select
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                    value={textNodeTextAlign}
                                    onChange={(event) =>
                                      setTextNodeTextAlign(event.target.value as TextAlign)
                                    }
                                  >
                                    <option value="left">Align left</option>
                                    <option value="center">Align center</option>
                                    <option value="right">Align right</option>
                                  </select>
                                  <div className="flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3">
                                    <input
                                      type="color"
                                      value={textNodeTitleColor}
                                      onChange={(event) =>
                                        setTextNodeTitleColor(event.target.value)
                                      }
                                      className="h-7 w-10 rounded border border-white/10 bg-transparent"
                                    />
                                    <span className="font-mono text-xs text-zinc-300">
                                      {textNodeTitleColor}
                                    </span>
                                  </div>
                                  <div className="flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 sm:col-span-2">
                                    <input
                                      type="color"
                                      value={textNodeSubtitleColor}
                                      onChange={(event) =>
                                        setTextNodeSubtitleColor(event.target.value)
                                      }
                                      className="h-7 w-10 rounded border border-white/10 bg-transparent"
                                    />
                                    <span className="font-mono text-xs text-zinc-300">
                                      {textNodeSubtitleColor}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : null}

                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <Braces className="h-4 w-4 text-zinc-400" />
                              <p className="text-sm font-semibold text-white">
                                Advanced props
                              </p>
                            </div>
                            <textarea
                              className="h-36 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 font-mono text-xs text-white outline-none transition focus:border-sky-400/50"
                              placeholder='{"custom":"value"}'
                              value={advancedNodePropsText}
                              onChange={(event) =>
                                setAdvancedNodePropsText(event.target.value)
                              }
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button
                              className="h-11 rounded-xl border-violet-500/30 bg-violet-500 px-4 text-sm font-semibold text-black hover:bg-violet-400 disabled:opacity-50"
                              disabled={
                                updateNodeMutation.isPending ||
                                ((selectedNode.type === "node-product" ||
                                  selectedNode.type === "node-course-step" ||
                                  isStepViewerNodeType(selectedNode.type) ||
                                  isLibraryViewNodeType(selectedNode.type)) &&
                                  !selectedProductForNode) ||
                                (selectedNode.type === "node-course-step" &&
                                  !selectedStepForNode) ||
                                (isTextNodeType(selectedNode.type) &&
                                  textNodeVariableSource === "product_name" &&
                                  !selectedProductForNode &&
                                  !selectedPageFallbackProductId)
                              }
                              onClick={() => {
                                let parsed: Record<string, unknown> = {};
                                try {
                                  parsed = JSON.parse(
                                    advancedNodePropsText
                                  ) as Record<string, unknown>;
                                } catch {
                                  parsed = {};
                                }

                                if (selectedNode.type === "node-product") {
                                  parsed.productId = selectedProductForNode;
                                }

                                if (selectedNode.type === "node-course-step") {
                                  parsed.productId = selectedProductForNode;
                                  parsed.stepId = selectedStepForNode;
                                }

                                if (isStepViewerNodeType(selectedNode.type)) {
                                  parsed.productId = selectedProductForNode;
                                  parsed.title =
                                    typeof parsed.title === "string" && parsed.title.trim()
                                      ? parsed.title
                                      : "Course steps";
                                }

                                if (isLibraryViewNodeType(selectedNode.type)) {
                                  parsed = buildLibraryViewProps(
                                    selectedProductForNode,
                                    libraryLayoutStyle,
                                    libraryRandomness,
                                    libraryViewInGallery,
                                    libraryOpenInModal,
                                    selectedProductLibraryAssets,
                                    {
                                      w: parseLibraryOptionsInput(
                                        libraryWidthOptionsText,
                                        [1]
                                      ),
                                      h: parseLibraryOptionsInput(
                                        libraryHeightOptionsText,
                                        [6, 8, 10]
                                      ),
                                    }
                                  );
                                }

                                if (isTextNodeType(selectedNode.type)) {
                                  parsed = buildTextNodeProps(
                                    textNodeTitle,
                                    textNodeSubtitle,
                                    textNodeVariableSource,
                                    textNodeVariableTarget,
                                    Number(
                                      textNodeTitleFontSize || DEFAULT_TEXT_NODE_TITLE_FONT_SIZE
                                    ),
                                    textNodeTitleFontWeight,
                                    Number(
                                      textNodeSubtitleFontSize ||
                                        DEFAULT_TEXT_NODE_SUBTITLE_FONT_SIZE
                                    ),
                                    textNodeSubtitleFontWeight,
                                    textNodeTextAlign,
                                    textNodeTitleColor,
                                    textNodeSubtitleColor,
                                    selectedProductForNode || selectedPageFallbackProductId || undefined
                                  );
                                }

                                updateNodeMutation.mutate({
                                  nodeId: selectedNode.id,
                                  title: nodeTitle.trim() || null,
                                  sortOrder: Number(nodeSortOrder || "0"),
                                  props: parsed,
                                  productId:
                                    selectedNode.type === "node-product" ||
                                    selectedNode.type === "node-course-step" ||
                                    isStepViewerNodeType(selectedNode.type) ||
                                    isLibraryViewNodeType(selectedNode.type)
                                      ? selectedProductForNode || null
                                      : isTextNodeType(selectedNode.type) &&
                                          textNodeVariableSource === "product_name"
                                        ? selectedProductForNode ||
                                          selectedPageFallbackProductId ||
                                          null
                                      : null,
                                  stepId:
                                    selectedNode.type === "node-course-step"
                                      ? selectedStepForNode || null
                                      : null,
                                });
                              }}
                            >
                              Save node
                            </Button>
                            <Button
                              className="h-11 rounded-xl border-red-500/30 bg-red-500/80 px-4 text-sm font-semibold text-black hover:bg-red-400 disabled:opacity-50"
                              disabled={removeNodeMutation.isPending}
                              onClick={() =>
                                removeNodeMutation.mutate({ nodeId: selectedNode.id })
                              }
                            >
                              Remove node
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
                          Select a node from the page content list to edit its content.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-sky-300" />
                        <h2 className="text-lg font-semibold text-white">Page canvas</h2>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        Preview the actual runtime shell and edit each saved breakpoint layout independently.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {(Object.keys(PREVIEW_BREAKPOINTS) as Array<
                        keyof typeof PREVIEW_BREAKPOINTS
                      >).map((breakpoint) => (
                        <button
                          key={breakpoint}
                          type="button"
                          onClick={() => setPreviewBreakpoint(breakpoint)}
                          className={`h-10 rounded-xl border px-4 text-sm font-semibold transition ${
                            previewBreakpoint === breakpoint
                              ? "border-sky-400/50 bg-sky-400 text-black"
                              : "border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
                          }`}
                        >
                          {PREVIEW_BREAKPOINTS[breakpoint].label}
                        </button>
                      ))}
                      <Button
                        className="h-10 rounded-xl border-sky-500/30 bg-sky-500 px-4 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
                        disabled={updateNodeMutation.isPending || !(selectedPage.items ?? []).length}
                        onClick={() => void saveGridLayout()}
                      >
                        Save grid
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-white/10 bg-black/30 p-4">
                    {(selectedPage.items ?? []).length ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-400">
                          <span>
                            Editing the <span className="font-semibold text-white">{PREVIEW_BREAKPOINTS[previewBreakpoint].label}</span> layout.
                          </span>
                          <span className="font-mono uppercase tracking-[0.18em] text-zinc-500">
                            Saved separately for {previewBreakpoint}
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded-[32px] border border-white/10 bg-black/40 p-4">
                          <div
                            className="mx-auto overflow-hidden rounded-[28px] border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
                            style={{ width: PREVIEW_BREAKPOINTS[previewBreakpoint].width }}
                          >
                            <DynamicGrid
                              routePresetSlug={selectedPage.slug}
                              isAuthenticated
                              runtimePagesConfig={runtimePagesConfig}
                              adminPreview={{
                                forcedBreakpoint: previewBreakpoint,
                                layoutOverrides: {
                                  lg: pageLayouts.lg ?? [],
                                  sm: pageLayouts.sm ?? [],
                                  xs: pageLayouts.xs ?? [],
                                },
                                onLayoutChange: (breakpoint, layout) => {
                                  setPageLayouts((current) => ({
                                    ...current,
                                    [breakpoint]: layout.map((entry) =>
                                      clampGridItem(entry, GRID_COLS[breakpoint])
                                    ),
                                  }));
                                },
                                selectedNodeId,
                                onSelectNode: (nodeId) => selectNode(nodeId),
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-10 text-center text-sm text-zinc-500">
                        Search a node on the left and add it to start building this page.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {(selectedPage.items ?? []).map((node) => (
                      <div
                        key={node.id}
                        className={`rounded-2xl border px-3 py-3 transition ${
                          selectedNodeId === node.id
                            ? "border-violet-400/50 bg-violet-400/10"
                            : "border-white/10 bg-black/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => selectNode(node.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm font-semibold text-white">
                              {node.title || node.nodeKey}
                            </p>
                            <p className="mt-1 truncate text-xs text-zinc-400">
                              {node.type} · sort {node.sortOrder}
                            </p>
                          </button>
                          <Button
                            className="h-8 rounded-lg border-red-500/30 bg-red-500/80 px-2 text-[11px] font-semibold text-black hover:bg-red-400 disabled:opacity-50"
                            disabled={removeNodeMutation.isPending}
                            onClick={() =>
                              removeNodeMutation.mutate({ nodeId: node.id })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-10 text-center text-zinc-500">
            Select a page from the hierarchy above to edit its settings and page content.
          </div>
        )}
      </div>
    </AdminShell>
  );
}
