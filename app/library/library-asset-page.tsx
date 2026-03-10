'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Bell,
  Compass,
  Download,
  Eye,
  FileText,
  Heart,
  Link2,
  MessageCircle,
  Search,
  Settings
} from 'lucide-react';

import { UserMenu } from '~/app/_components/user-menu';
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
const NAV_ITEMS = [
  { label: 'Explorar', icon: Compass },
  { label: 'Notificacoes', icon: Bell },
  { label: 'Mensagens', icon: MessageCircle }
];

function readMetadata(metadata: unknown): AssetMetadata {
  if (!metadata || typeof metadata !== 'object') return {};
  return metadata as AssetMetadata;
}

function normalizeSlug(slug: string) {
  return slug.replace(/^\/+|\/+$/g, '');
}

function initialsFromLabel(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return 'HB';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
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
  const trackInteraction = api.progress.trackAssetInteraction.useMutation();
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
    if (!assetQuery.data) return;
    trackInteraction.mutate({
      productId: assetQuery.data.productId,
      assetId: assetQuery.data.id,
      action: 'VIEWED',
      visitorToken,
      metadata: { source: 'library-item-page' }
    });
  }, [assetQuery.data, trackInteraction, visitorToken]);

  const tenantBranding = useMemo(
    () => readTenantBranding(currentTenantQuery.data?.tenant?.settings),
    [currentTenantQuery.data?.tenant?.settings]
  );
  const tenantTheme = tenantBranding.theme;
  const tenantLogoUrl = tenantBranding.logoUrl;
  const tenantName = currentTenantQuery.data?.tenant?.name?.trim() || 'HUB';
  const tenantInitials = initialsFromLabel(tenantName);
  const tenantCssVars = useMemo(
    () =>
      ({
        '--tenant-bg-main': tenantTheme.bgMain,
        '--tenant-bg-secondary': tenantTheme.bgSecondary,
        '--tenant-text-main': tenantTheme.textMain,
        '--tenant-text-secondary': tenantTheme.textSecondary,
        '--tenant-border': tenantTheme.borderColor,
        '--tenant-accent': tenantTheme.accent,
        '--tenant-button-primary': tenantTheme.buttonPrimary,
        '--tenant-button-primary-hover': tenantTheme.buttonPrimaryHover,
        '--tenant-button-text': tenantTheme.buttonText,
        '--tenant-card-bg': tenantTheme.cardBg,
        '--tenant-node-radius': `${tenantBranding.nodeRadius}px`,
        '--tenant-node-radius-sm': `${Math.max(10, tenantBranding.nodeRadius - 8)}px`,
        '--tenant-node-radius-pill': `${Math.max(999, tenantBranding.nodeRadius * 2)}px`
      }) as CSSProperties,
    [tenantBranding.nodeRadius, tenantTheme]
  );
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
    <main
      className="relative flex h-screen overflow-hidden font-sans"
      data-tenant-grid
      style={{
        ...tenantCssVars,
        backgroundColor: 'var(--tenant-bg-main)',
        color: 'var(--tenant-text-main)'
      }}
    >
      <nav
        className="z-20 flex h-full w-20 shrink-0 flex-col items-center gap-2 border-r px-3 py-3 max-md:w-14 max-md:p-2"
        style={{
          borderColor: 'var(--tenant-border)',
          backgroundColor: 'var(--tenant-bg-secondary)'
        }}
      >
        <button
          className="group relative flex aspect-square w-full items-center justify-center overflow-hidden border text-xs font-bold"
          style={{
            borderRadius: 'var(--tenant-node-radius-sm)',
            borderColor: 'var(--tenant-accent)',
            backgroundColor: 'var(--tenant-accent)',
            color: 'var(--tenant-button-text)'
          }}
          title={tenantName}
        >
          {tenantLogoUrl ? (
            <img
              src={tenantLogoUrl}
              alt={tenantName}
              className="h-10 w-10 object-contain"
            />
          ) : (
            <span>{tenantInitials}</span>
          )}
        </button>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className="group relative flex aspect-square w-full items-center justify-center border p-3 transition-colors hover:bg-[var(--tenant-button-primary-hover)] hover:text-[var(--tenant-button-text)] max-md:p-2"
              title={item.label}
              type="button"
              style={{
                borderRadius: 'var(--tenant-node-radius-pill)',
                borderColor: 'var(--tenant-border)',
                backgroundColor: 'var(--tenant-card-bg)',
                color: 'var(--tenant-text-secondary)'
              }}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}

        <div className="my-1 h-px w-6 bg-[var(--tenant-border)]" />

        <div className="mt-auto flex flex-col items-center gap-1">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center border text-[var(--tenant-text-secondary)] transition-colors hover:bg-[var(--tenant-button-primary-hover)] hover:text-[var(--tenant-button-text)]"
            title="Configuracoes"
            style={{
              borderRadius: 'var(--tenant-node-radius-pill)',
              borderColor: 'var(--tenant-border)',
              backgroundColor: 'var(--tenant-card-bg)'
            }}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div
          className="sticky top-0 z-20 flex items-center gap-3 px-4 py-4 backdrop-blur-xl"
          style={{
            backgroundColor: `${tenantTheme.bgSecondary}f2`,
            borderBottom: '1px solid var(--tenant-border)'
          }}
        >
          <div className="group relative min-w-0 flex-1">
            <Search
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors"
              style={{ color: 'var(--tenant-text-secondary)' }}
            />
            <input
              type="text"
              readOnly
              value={`${assetLocationPrefix}${asset.id}`}
              className="w-full border py-2.5 pl-10 pr-4 text-sm outline-none"
              style={{
                borderRadius: 'var(--tenant-node-radius-pill)',
                borderColor: 'var(--tenant-border)',
                backgroundColor: 'var(--tenant-card-bg)',
                color: 'var(--tenant-text-main)'
              }}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <UserMenu
              isLoggedIn={isLoggedIn}
              pathname={pathname}
              userName={userName}
              userImage={userImage}
              userInitial={userInitial}
              tenantTheme={tenantTheme}
              tenantName={currentTenantQuery.data?.tenant?.name}
              tenantSlug={currentTenantQuery.data?.tenant?.slug}
              tenantRole={currentTenantQuery.data?.role ?? session?.user?.tenantRole}
              isGlobalAdmin={session?.user?.isGlobalAdmin}
            />
          </div>
        </div>

        <div className="flex h-fit items-center gap-2 px-6 py-4">
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
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div
              className="overflow-hidden border shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
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

              <div style={{ backgroundColor: 'var(--tenant-bg-main)' }}>
                {asset.type === 'VIDEO' ? (
                  <video
                    src={asset.url}
                    controls
                    poster={previewUrl ?? undefined}
                    className="aspect-video w-full object-contain"
                    style={{ backgroundColor: 'var(--tenant-bg-main)' }}
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
                        trackInteraction.mutate({
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
                      <Eye className="h-4 w-4" style={{ color: 'var(--tenant-accent)' }} />
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
      </div>
    </main>
  );
}
