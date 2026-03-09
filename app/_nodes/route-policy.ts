import { pagesConfig } from "~/app/_nodes/pages";
import type { Preset } from "~/app/_nodes/schemas";

interface RoutePolicy {
  requiresAuth: boolean;
  internalRoute: boolean;
  indexable: boolean;
  hidden: boolean;
}

function walkPresets(
  entries: Record<string, Preset>,
  visitor: (preset: Preset) => void,
) {
  for (const preset of Object.values(entries)) {
    visitor(preset);
    if (preset.children) walkPresets(preset.children, visitor);
  }
}

function normalizeSlug(slug: string) {
  return slug.replace(/^\/+|\/+$/g, "");
}

export function resolveExistingPresetSlug(inputSlug: string) {
  const normalizedInput = normalizeSlug(inputSlug);
  const availableSlugs = new Set<string>();

  walkPresets(pagesConfig.presets, (preset) => {
    const candidate = normalizeSlug(preset.slug);
    availableSlugs.add(candidate);
  });

  if (availableSlugs.has(normalizedInput)) return normalizedInput;

  if (normalizedInput.startsWith("site/")) {
    const withoutSitePrefix = normalizedInput.slice("site/".length);
    if (availableSlugs.has(withoutSitePrefix)) return withoutSitePrefix;
  } else if (normalizedInput.length > 0) {
    const withSitePrefix = `site/${normalizedInput}`;
    if (availableSlugs.has(withSitePrefix)) return withSitePrefix;
  }

  return null;
}

export function resolveDynamicRoutePolicy(inputSlug: string): RoutePolicy {
  const normalizedInput =
    resolveExistingPresetSlug(inputSlug) ?? normalizeSlug(inputSlug);
  let policy: RoutePolicy = {
    requiresAuth: false,
    internalRoute: false,
    indexable: true,
    hidden: false,
  };

  walkPresets(pagesConfig.presets, (preset) => {
    const candidate = normalizeSlug(preset.slug);
    if (candidate !== normalizedInput) return;

    policy = {
      requiresAuth: Boolean(preset.requiresAuth),
      internalRoute: Boolean(preset.internalRoute),
      indexable: preset.indexable ?? true,
      hidden: Boolean(preset.hidden),
    };
  });

  return policy;
}
