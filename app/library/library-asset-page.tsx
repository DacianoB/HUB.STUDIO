'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Download, Eye, FileText, Heart, Link2 } from 'lucide-react';

import { TenantAppChrome } from '~/app/_components/tenant-app-chrome';
import type { PagesConfig } from '~/app/_nodes/schemas';
import { readTenantBranding } from '~/app/_nodes/tenant-theme';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

type LibraryAssetPageProps = {
  assetId: string;
  backHref: string;
  pageName: string;
  runtimePagesConfig: PagesConfig;
};

type AssetMetadata = {
  showViews?: boolean;
  showDownloads?: boolean;
  showLikes?: boolean;
};

const LIBRARY_VISITOR_TOKEN_KEY = 'hub.libraryVisitorToken';
function readMetadata(metadata: unknown): AssetMetadata {
  if (!metadata || typeof metadata !== 'object') return {};
  return metadata as AssetMetadata;
}

function normalizeSlug(slug: string) {
  return slug.replace(/^\/+|\/+$/g, '');
}

export function LibraryAssetPage({
  assetId,
  backHref,
  pageName,
  runtimePagesConfig
}: LibraryAssetPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const isLoggedIn = sessionStatus === 'authenticated';
  const userName = session?.user?.name ?? session?.user?.email ?? 'Conta';
  const userImage = session?.user?.image;
  const userInitial = userName.trim().charAt(0).toUpperCase() || 'U';
  const utils = api.useUtils();
  const [visitorToken, setVisitorToken] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const stored = window.localStorage.getItem(LIBRARY_VISITOR_TOKEN_KEY);
    return stored || undefined;
  });
  const assetQuery = api.products.libraryAssetById.useQuery({
    assetId,
    visitorToken
  });
  const currentTenantQuery = api.tenants.current.useQuery(undefined, {
    enabled: isLoggedIn,
    retry: false
  });
  const viewedAssetIdsRef = useRef<Set<string>>(new Set());
  const { mutate: trackAssetInteraction } =
    api.progress.trackAssetInteraction.useMutation({
      onSuccess: (result) => {
        if (
          typeof window !== 'undefined' &&
          result.visitorToken &&
          result.visitorToken !== visitorToken
        ) {
          window.localStorage.setItem(
            LIBRARY_VISITOR_TOKEN_KEY,
            result.visitorToken
          );
          setVisitorToken(result.visitorToken);
        }
      }
    });
  const markDownloaded = api.progress.markAssetDownloaded.useMutation({
    onSuccess: (result) => {
      if (typeof window !== 'undefined' && result.visitorToken) {
        window.localStorage.setItem(
          LIBRARY_VISITOR_TOKEN_KEY,
          result.visitorToken
        );
        setVisitorToken(result.visitorToken);
      }
      void utils.products.libraryAssetById.invalidate({
        assetId,
        visitorToken
      });
    }
  });
  const toggleLike = api.products.toggleLibraryAssetLike.useMutation({
    onSuccess: async (result) => {
      if (typeof window !== 'undefined' && result.visitorToken) {
        window.localStorage.setItem(
          LIBRARY_VISITOR_TOKEN_KEY,
          result.visitorToken
        );
        setVisitorToken(result.visitorToken);
      }
      await utils.products.libraryAssetById.invalidate({
        assetId,
        visitorToken: result.visitorToken ?? visitorToken
      });
    }
  });

  useEffect(() => {
    const asset = assetQuery.data;
    if (!asset) return;
    if (viewedAssetIdsRef.current.has(asset.id)) return;

    viewedAssetIdsRef.current.add(asset.id);

    trackAssetInteraction(
      {
        productId: asset.productId,
        assetId: asset.id,
        action: 'VIEWED',
        visitorToken,
        metadata: { source: 'library-item-page' }
      },
      {
        onError: () => {
          viewedAssetIdsRef.current.delete(asset.id);
        }
      }
    );
  }, [
    assetQuery.data?.id,
    assetQuery.data?.productId,
    trackAssetInteraction,
    visitorToken
  ]);

  const tenantBranding = useMemo(
    () => readTenantBranding(currentTenantQuery.data?.tenant?.settings),
    [currentTenantQuery.data?.tenant?.settings]
  );
  const tenantTheme = tenantBranding.theme;
  const tenantLogoUrl = tenantBranding.logoUrl;
  const tenantName = currentTenantQuery.data?.tenant?.name?.trim() || 'HUB';
  const assetLocationPrefix = useMemo(() => {
    const normalizedBackHref = normalizeSlug(backHref);
    return normalizedBackHref ? `${normalizedBackHref}/` : '';
  }, [backHref]);

  if (assetQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070f] px-4 text-white">
        Loading library item...
      </div>
    );
  }

  if (!assetQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070f] px-4 text-white">
        Library item not found.
      </div>
    );
  }

  const asset = assetQuery.data;
  const metadata = readMetadata(asset.metadata);
  const showViews = metadata.showViews ?? true;
  const showDownloads = metadata.showDownloads ?? true;
  const showLikes = metadata.showLikes ?? true;
  const canDownload = Boolean(asset.isDownloadable);
  const assetMedia = asset as typeof asset & {
    previewUrl?: string | null;
    thumbnailUrl?: string | null;
  };
  const assetLink = asset as typeof asset & {
    targetUrl?: string | null;
    openInNewTab?: boolean | null;
  };
  const previewUrl =
    assetMedia.previewUrl ??
    assetMedia.thumbnailUrl ??
    (asset.type === 'IMAGE' || asset.type === 'LINK' ? asset.url : null);
  const resolvedTargetUrl =
    assetLink.targetUrl ?? (asset.type === 'LINK' ? asset.url : null);
  const opensInNewTab = assetLink.openInNewTab ?? true;
  const canOpenLink = asset.type === 'LINK' && Boolean(resolvedTargetUrl);

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
      searchValue={`${assetLocationPrefix}${asset.id}`}
      searchReadOnly
    >
      <div className="flex h-fit items-center gap-2 px-6 py-4 mt-4">
        <button
          type="button"
          onClick={() => router.push(backHref as any)}
          className="inline-flex shrink-0 items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--tenant-text-secondary)] transition-colors hover:bg-[var(--tenant-button-primary-hover)] hover:text-[var(--tenant-button-text)]"
          style={{
            borderRadius: 'var(--tenant-node-radius-pill)',
            backgroundColor: 'var(--tenant-card-bg)'
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {pageName}
        </button>

        <div
          className="shrink-0 bg-[var(--tenant-button-primary)] px-4 py-2 text-xs font-semibold text-[var(--tenant-button-text)]"
          style={{ borderRadius: 'var(--tenant-node-radius-pill)' }}
        >
          {asset.title}
        </div>
      </div>

      <section className="px-4 pb-6">
        <style>{`
            [data-tenant-grid] input::placeholder {
              color: var(--tenant-text-secondary);
            }
          `}</style>
        <div className="gap-6 flex h-full max-h-[calc(100vh-200px)] max-md:flex-col">
          <div
            className="overflow-hidden border shadow-[0_24px_80px_rgba(0,0,0,0.45)] w-fit h-full"
            style={{
              borderRadius: 'var(--tenant-node-radius)',
              borderColor: 'var(--tenant-border)',
              backgroundColor: 'var(--tenant-card-bg)'
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{
                borderBottom: '1px solid var(--tenant-border)',
                backgroundColor: 'rgba(255,255,255,0.03)'
              }}
            >
              <div>
                <p
                  className="text-xs uppercase tracking-[0.22em]"
                  style={{ color: 'var(--tenant-text-secondary)' }}
                >
                  {pageName}
                </p>
                <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
                  {asset.title}
                </h1>
              </div>
            </div>

            <div className="h-full flex" style={{ backgroundColor: '#000000' }}>
              {asset.type === 'VIDEO' ? (
                <video
                  src={asset.url}
                  controls
                  poster={previewUrl ?? undefined}
                  className="inset-0 object-contain"
                  style={{ backgroundColor: '#000000' }}
                />
              ) : asset.type === 'IMAGE' ? (
                <img
                  src={asset.url}
                  alt={asset.title}
                  className="max-h-[75vh] w-full object-contain"
                />
              ) : asset.type === 'PDF' ? (
                <iframe
                  src={asset.url}
                  title={asset.title}
                  className="h-[70vh] w-full bg-white"
                />
              ) : previewUrl ? (
                <div
                  className="flex h-[70vh] items-center justify-center bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(9,9,11,0.18), rgba(9,9,11,0.82)), url(${previewUrl})`
                  }}
                >
                  <div
                    className="border p-4 backdrop-blur"
                    style={{
                      borderRadius: 'var(--tenant-node-radius-pill)',
                      borderColor: 'var(--tenant-border)',
                      backgroundColor: 'rgba(0,0,0,0.35)',
                      color: 'var(--tenant-text-main)'
                    }}
                  >
                    {asset.type === 'LINK' ? (
                      <Link2 className="h-8 w-8" />
                    ) : (
                      <FileText className="h-8 w-8" />
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-[70vh] items-center justify-center"
                  style={{
                    background: `radial-gradient(circle at top, ${tenantTheme.accent}2e, transparent 40%), linear-gradient(180deg, rgba(24,24,27,0.5), rgba(9,9,11,0.96))`
                  }}
                >
                  <div
                    className="border p-4 backdrop-blur"
                    style={{
                      borderRadius: 'var(--tenant-node-radius-pill)',
                      borderColor: 'var(--tenant-border)',
                      backgroundColor: 'rgba(0,0,0,0.35)',
                      color: 'var(--tenant-text-main)'
                    }}
                  >
                    {asset.type === 'LINK' ? (
                      <Link2 className="h-8 w-8" />
                    ) : (
                      <FileText className="h-8 w-8" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div
              className="border p-5"
              style={{
                borderRadius: 'var(--tenant-node-radius)',
                borderColor: 'var(--tenant-border)',
                backgroundColor: 'var(--tenant-card-bg)'
              }}
            >
              <p
                className="text-xs uppercase tracking-[0.22em]"
                style={{ color: 'var(--tenant-text-secondary)' }}
              >
                Info
              </p>
              <div className="mt-4 grid gap-2">
                <div
                  className="mb-4 text-sm"
                  style={{ color: 'var(--tenant-text-secondary)' }}
                >
                  {asset.description?.trim() || ''}
                </div>
                {canOpenLink && resolvedTargetUrl ? (
                  <a
                    href={resolvedTargetUrl}
                    target={opensInNewTab ? '_blank' : '_self'}
                    rel={opensInNewTab ? 'noreferrer noopener' : undefined}
                    className="inline-flex h-11 items-center justify-center border px-4 text-sm font-semibold transition"
                    style={{
                      borderRadius: 'var(--tenant-node-radius-sm)',
                      borderColor: 'var(--tenant-border)',
                      backgroundColor: 'var(--tenant-button-primary)',
                      color: 'var(--tenant-button-text)'
                    }}
                    onClick={() =>
                      trackAssetInteraction({
                        productId: asset.productId,
                        assetId: asset.id,
                        action: 'CLICKED',
                        visitorToken,
                        metadata: {
                          source: 'library-item-page',
                          targetUrl: resolvedTargetUrl
                        }
                      })
                    }
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Open link
                  </a>
                ) : null}
                {showLikes ? (
                  <Button
                    className="h-11 px-4 text-sm font-semibold transition"
                    style={{
                      borderRadius: 'var(--tenant-node-radius-sm)',
                      borderColor: 'var(--tenant-border)',
                      backgroundColor: asset.currentUserLiked
                        ? 'var(--tenant-button-primary)'
                        : 'rgba(255,255,255,0.08)',
                      color: asset.currentUserLiked
                        ? 'var(--tenant-button-text)'
                        : 'var(--tenant-text-main)'
                    }}
                    onClick={() =>
                      toggleLike.mutate({
                        assetId: asset.id,
                        visitorToken
                      })
                    }
                  >
                    <Heart className="mr-2 h-4 w-4" />
                    {asset.currentUserLiked ? 'Curtido' : 'Curtir'}
                  </Button>
                ) : null}

                {canDownload ? (
                  <a
                    href={asset.url}
                    download
                    className="inline-flex h-11 items-center justify-center border px-4 text-sm font-semibold transition"
                    style={{
                      borderRadius: 'var(--tenant-node-radius-sm)',
                      borderColor: 'var(--tenant-border)',
                      backgroundColor: 'var(--tenant-button-primary)',
                      color: 'var(--tenant-button-text)'
                    }}
                    onClick={() =>
                      markDownloaded.mutate({
                        productId: asset.productId,
                        assetId: asset.id,
                        visitorToken
                      })
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                ) : null}
              </div>
            </div>
            <div
              className="mt-3 flex gap-2 border p-3 *:grow *:w-full"
              style={{
                borderRadius: 'var(--tenant-node-radius)',
                borderColor: 'var(--tenant-border)',
                backgroundColor: 'var(--tenant-card-bg)'
              }}
            >
              {showLikes ? (
                <div
                  className="flex items-center justify-between border px-3 py-3 text-sm"
                  style={{
                    borderRadius: 'var(--tenant-node-radius-sm)',
                    borderColor: 'var(--tenant-border)',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    color: 'var(--tenant-text-secondary)'
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Heart
                      className="h-4 w-4"
                      style={{ color: 'var(--tenant-button-primary)' }}
                    />
                  </span>
                  <span>{asset.stats.likes}</span>
                </div>
              ) : null}
              {showViews ? (
                <div
                  className="flex items-center justify-between border px-3 py-3 text-sm"
                  style={{
                    borderRadius: 'var(--tenant-node-radius-sm)',
                    borderColor: 'var(--tenant-border)',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    color: 'var(--tenant-text-secondary)'
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Eye
                      className="h-4 w-4"
                      style={{ color: 'var(--tenant-accent)' }}
                    />
                  </span>
                  <span>{asset.stats.views}</span>
                </div>
              ) : null}
              {showDownloads ? (
                <div
                  className="flex items-center justify-between border px-3 py-3 text-sm"
                  style={{
                    borderRadius: 'var(--tenant-node-radius-sm)',
                    borderColor: 'var(--tenant-border)',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    color: 'var(--tenant-text-secondary)'
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Download
                      className="h-4 w-4"
                      style={{ color: 'var(--tenant-button-primary)' }}
                    />
                  </span>
                  <span>{asset.stats.downloads}</span>
                </div>
              ) : null}
            </div>
            {/* <div
                className="rounded-[28px] border p-5"
                style={{
                  borderColor: 'var(--tenant-border)',
                  backgroundColor: 'var(--tenant-card-bg)'
                }}
              >
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  Stats
                </p>
                <div className="mt-3 grid gap-2">
                  {showLikes ? (
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-300">
                      <span className="inline-flex items-center gap-2">
                        <Heart className="h-4 w-4 text-rose-300" />
                        Likes
                      </span>
                      <span>{asset.stats.likes}</span>
                    </div>
                  ) : null}
                  {showViews ? (
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-300">
                      <span className="inline-flex items-center gap-2">
                        <Eye className="h-4 w-4 text-sky-300" />
                        Views
                      </span>
                      <span>{asset.stats.views}</span>
                    </div>
                  ) : null}
                  {showDownloads ? (
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-300">
                      <span className="inline-flex items-center gap-2">
                        <Download className="h-4 w-4 text-emerald-300" />
                        Downloads
                      </span>
                      <span>{asset.stats.downloads}</span>
                    </div>
                  ) : null}
                </div>
              </div> */}
          </aside>
        </div>
      </section>
    </TenantAppChrome>
  );
}
