import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DynamicGrid } from "~/app/_nodes/dynamic-grid";
import { LibraryAssetPage } from "~/app/library/library-asset-page";
import { pagesConfig } from "~/app/_nodes/pages";
import {
  resolveDynamicRoutePolicy,
  resolveExistingPresetSlug,
} from "~/app/_nodes/route-policy";
import { getServerAuthSession } from "~/server/auth";
import {
  getTenantPagesConfig,
  getTenantPagesConfigByTenantId,
  resolveTenantLibraryAssetRoute,
  resolveDynamicRoutePolicyFromConfig,
  resolveExistingPresetSlugFromConfig,
} from "~/server/tenant-pages";

interface CatchAllPageProps {
  params: Promise<{ preset?: string[] }>;
}

function normalizeSlug(slug: string) {
  return slug.replace(/^\/+|\/+$/g, "");
}

export default async function CatchAllPage({ params }: CatchAllPageProps) {
  const session = await getServerAuthSession();
  const { preset = [] } = await params;
  const requested = preset.join("/");
  const libraryAssetRoute = await resolveTenantLibraryAssetRoute(session, requested);
  const tenantPagesConfig = libraryAssetRoute?.tenantId
    ? await getTenantPagesConfigByTenantId(libraryAssetRoute.tenantId)
    : await getTenantPagesConfig(session);
  const runtimeConfig = tenantPagesConfig ?? pagesConfig;
  if (libraryAssetRoute?.asset) {
    const canonicalHref = `/${libraryAssetRoute.canonicalSlug}`;

    if (libraryAssetRoute.requiresAuth && !session?.user) {
      redirect(`/auth/signin?callbackUrl=${encodeURIComponent(canonicalHref)}`);
    }

    if (normalizeSlug(requested) !== normalizeSlug(libraryAssetRoute.canonicalSlug)) {
      redirect(canonicalHref as any);
    }

    if (libraryAssetRoute.viewInGallery) {
      return (
        <main className="min-h-screen bg-black text-white">
          <DynamicGrid
            routePresetSlug={libraryAssetRoute.sourcePageSlug}
            isAuthenticated={Boolean(session?.user)}
            runtimePagesConfig={runtimeConfig}
            embeddedLibraryAsset={{
              assetId: libraryAssetRoute.assetId,
              backHref: `/${libraryAssetRoute.sourcePageSlug}`,
              pageName: libraryAssetRoute.pageName,
              sourceNodeId: libraryAssetRoute.sourceNodeId ?? undefined,
              asset: libraryAssetRoute.asset as any,
            }}
          />
        </main>
      );
    }

    return (
      <LibraryAssetPage
        assetId={libraryAssetRoute.assetId}
        backHref={`/${libraryAssetRoute.sourcePageSlug}`}
        pageName={libraryAssetRoute.pageName}
        runtimePagesConfig={runtimeConfig}
        initialAsset={libraryAssetRoute.asset as any}
      />
    );
  }

  const resolvedSlug =
    resolveExistingPresetSlugFromConfig(runtimeConfig, requested) ??
    resolveExistingPresetSlug(requested);
  const slug = resolvedSlug ?? requested;

  if (resolvedSlug && normalizeSlug(requested) !== normalizeSlug(resolvedSlug)) {
    redirect(`/${resolvedSlug}`);
  }

  const policy = tenantPagesConfig
    ? resolveDynamicRoutePolicyFromConfig(tenantPagesConfig, slug)
    : resolveDynamicRoutePolicy(slug);

  if (policy.requiresAuth && !session?.user) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/${slug}`)}`);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <DynamicGrid
        routePresetSlug={slug}
        isAuthenticated={Boolean(session?.user)}
        runtimePagesConfig={runtimeConfig}
      />
    </main>
  );
}

export async function generateMetadata({ params }: CatchAllPageProps): Promise<Metadata> {
  const session = await getServerAuthSession();
  const { preset = [] } = await params;
  const requested = preset.join("/");
  const libraryAssetRoute = await resolveTenantLibraryAssetRoute(session, requested);
  const tenantPagesConfig = libraryAssetRoute?.tenantId
    ? await getTenantPagesConfigByTenantId(libraryAssetRoute.tenantId)
    : await getTenantPagesConfig(session);
  const runtimeConfig = tenantPagesConfig ?? pagesConfig;
  if (libraryAssetRoute?.asset) {
    return {
      title: libraryAssetRoute.asset.title,
      description: libraryAssetRoute.asset.description ?? undefined,
      robots:
        libraryAssetRoute.internalRoute || libraryAssetRoute.hidden || libraryAssetRoute.indexable === false
          ? { index: false, follow: false }
          : undefined,
    };
  }
  const slug =
    resolveExistingPresetSlugFromConfig(runtimeConfig, requested) ??
    resolveExistingPresetSlug(requested) ??
    requested;
  const policy = tenantPagesConfig
    ? resolveDynamicRoutePolicyFromConfig(tenantPagesConfig, slug)
    : resolveDynamicRoutePolicy(slug);

  if (policy.internalRoute || policy.hidden || policy.indexable === false) {
    return {
      robots: { index: false, follow: false },
    };
  }
  return {};
}
