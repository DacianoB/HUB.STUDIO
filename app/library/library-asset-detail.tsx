'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Expand,
  Eye,
  FileText,
  Heart,
  Link2,
  X
} from 'lucide-react';

import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

type LibraryAssetDetailPanelProps = {
  assetId: string;
  backHref: string;
  pageName: string;
  embedded?: boolean;
  inGrid?: boolean;
  initialAsset?: InitialAssetData;
};

type AssetMetadata = {
  showViews?: boolean;
  showDownloads?: boolean;
  showLikes?: boolean;
  viewInGallery?: boolean;
};

type InitialAssetData = {
  id: string;
  productId: string;
  title: string;
  description?: string | null;
  type: string;
  url: string;
  isDownloadable?: boolean | null;
  metadata?: unknown;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  targetUrl?: string | null;
  openInNewTab?: boolean | null;
  stats?: {
    likes: number;
    views: number;
    downloads: number;
  };
  currentUserLiked?: boolean;
};

const LIBRARY_VISITOR_TOKEN_KEY = 'hub.libraryVisitorToken';

function readMetadata(metadata: unknown): AssetMetadata {
  if (!metadata || typeof metadata !== 'object') return {};
  return metadata as AssetMetadata;
}

function normalizeSlug(slug: string) {
  return slug.replace(/^\/+|\/+$/g, '');
}

function PinActionButton({
  label,
  children,
  onClick,
  className
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[var(--tenant-text-main)] transition hover:text-[var(--tenant-text-secondary)] ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function LibraryAssetDetailPanel({
  assetId,
  backHref,
  pageName,
  embedded = false,
  inGrid = false,
  initialAsset
}: LibraryAssetDetailPanelProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [visitorToken, setVisitorToken] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const stored = window.localStorage.getItem(LIBRARY_VISITOR_TOKEN_KEY);
    return stored || undefined;
  });
  const assetQuery = api.products.libraryAssetById.useQuery(
    {
      assetId,
      visitorToken
    },
    {
      retry: false
    }
  );
  const trackedAsset = assetQuery.data ?? initialAsset;
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
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isExpanded) {
      setIsZoomed(false);
    }
  }, [isExpanded]);

  useEffect(() => {
    const asset = trackedAsset;
    if (!asset) return;
    if (viewedAssetIdsRef.current.has(asset.id)) return;

    viewedAssetIdsRef.current.add(asset.id);

    trackAssetInteraction(
      {
        productId: asset.productId,
        assetId: asset.id,
        action: 'VIEWED',
        visitorToken,
        metadata: {
          source: embedded ? 'library-gallery-inline' : 'library-item-page'
        }
      },
      {
        onError: () => {
          viewedAssetIdsRef.current.delete(asset.id);
        }
      }
    );
  }, [trackedAsset, embedded, trackAssetInteraction, visitorToken]);

  const assetLocationPrefix = useMemo(() => {
    const normalizedBackHref = normalizeSlug(backHref);
    return normalizedBackHref ? `${normalizedBackHref}/` : '';
  }, [backHref]);

  if (assetQuery.isLoading && !initialAsset) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[var(--tenant-node-radius)] border border-[var(--tenant-border)] bg-[var(--tenant-card-bg)] px-4 text-[var(--tenant-text-main)]">
        Loading library item...
      </div>
    );
  }

  if (!trackedAsset) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[var(--tenant-node-radius)] border border-[var(--tenant-border)] bg-[var(--tenant-card-bg)] px-4 text-[var(--tenant-text-main)]">
        Library item not found.
      </div>
    );
  }

  const asset = trackedAsset;
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
  const stats = [
    showLikes ? `${asset.stats?.likes ?? 0} likes` : null,
    showViews ? `${asset.stats?.views ?? 0} views` : null,
    showDownloads ? `${asset.stats?.downloads ?? 0} downloads` : null
  ].filter(Boolean);

  if (inGrid) {
    return (
      <section className="flex h-full flex-col rounded-[var(--tenant-node-radius)] border border-[var(--tenant-border)] bg-[var(--tenant-card-bg)] p-4 text-black">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex shrink-0 items-center gap-2">
              <PinActionButton
                label={`Back to ${pageName}`}
                onClick={() => router.push(backHref as any)}
                className="w-11 bg-transparent px-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </PinActionButton>
              {showLikes ? (
                <PinActionButton
                  label={asset.currentUserLiked ? 'Unlike item' : 'Like item'}
                  onClick={() =>
                    toggleLike.mutate({
                      assetId: asset.id,
                      visitorToken
                    })
                  }
                  className={`bg-transparent px-0 ${asset.currentUserLiked ? 'text-[#ff4964]' : ''}`}
                >
                  <Heart
                    className={`h-5 w-5 ${asset.currentUserLiked ? 'fill-current' : ''}`}
                  />
                  <span className="text-sm font-semibold">
                    {asset.stats?.likes ?? 0}
                  </span>
                </PinActionButton>
              ) : null}
              {canDownload && (
                <a
                  href={asset.url}
                  download
                  className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[var(--tenant-text-main)] transition hover:text-[var(--tenant-text-secondary)]"
                  onClick={() =>
                    markDownloaded.mutate({
                      productId: asset.productId,
                      assetId: asset.id,
                      visitorToken
                    })
                  }
                >
                  <Download className="h-5 w-5" />
                  <span className="text-sm font-semibold">
                    {showDownloads ? (asset.stats?.downloads ?? 0) : 'Download'}
                  </span>
                </a>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {showViews ? (
              <span className="inline-flex h-11 items-center gap-2 rounded-full  px-4 text-sm font-semibold text-[var(--tenant-text-main)]">
                <Eye className="h-5 w-5" />
                <span>{asset.stats?.views ?? 0}</span>
              </span>
            ) : null}
            {canOpenLink && resolvedTargetUrl ? (
              <a
                href={resolvedTargetUrl}
                target={opensInNewTab ? '_blank' : '_self'}
                rel={opensInNewTab ? 'noreferrer noopener' : undefined}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#e9e3da] px-4 text-sm font-semibold text-[var(--tenant-text-main)] transition hover:bg-[#ddd5ca]"
                onClick={() =>
                  trackAssetInteraction({
                    productId: asset.productId,
                    assetId: asset.id,
                    action: 'CLICKED',
                    visitorToken,
                    metadata: {
                      source: 'library-gallery-inline',
                      targetUrl: resolvedTargetUrl
                    }
                  })
                }
              >
                <Link2 className="h-5 w-5" />
                <span>Visit</span>
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--tenant-node-radius)] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
          <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-[var(--tenant-node-radius)] bg-[#efebe4] p-4">
            {asset.type === 'VIDEO' ? (
              <video
                src={asset.url}
                controls
                poster={previewUrl ?? undefined}
                className="h-full max-h-full w-full rounded-[var(--tenant-node-radius)] overflow-hidden object-contain max-md:object-cover"
                style={{ backgroundColor: '#efebe4' }}
              />
            ) : asset.type === 'IMAGE' ? (
              <Image
                src={asset.url}
                alt={asset.title}
                width={1600}
                height={1600}
                unoptimized
                className="h-full w-auto max-w-full rounded-[20px] object-contain max-[1500px]:object-cover"
              />
            ) : asset.type === 'PDF' ? (
              <iframe
                src={asset.url}
                title={asset.title}
                className="h-full w-full rounded-[20px] bg-white"
              />
            ) : previewUrl ? (
              <div
                className="h-full w-full rounded-[20px] bg-cover bg-center"
                style={{ backgroundImage: `url(${previewUrl})` }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-[20px] bg-[#ebe6dc]">
                {asset.type === 'LINK' ? (
                  <Link2 className="h-10 w-10 text-black/70" />
                ) : (
                  <FileText className="h-10 w-10 text-black/70" />
                )}
              </div>
            )}

            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
              {asset.type === 'IMAGE' ? (
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-black shadow-sm transition hover:bg-white"
                  aria-label="Expand image"
                >
                  <Expand className="h-5 w-5" />
                </button>
              ) : null}
              {canOpenLink && resolvedTargetUrl ? (
                <a
                  href={resolvedTargetUrl}
                  target={opensInNewTab ? '_blank' : '_self'}
                  rel={opensInNewTab ? 'noreferrer noopener' : undefined}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-black shadow-sm transition hover:bg-white"
                  aria-label="Open link"
                  onClick={() =>
                    trackAssetInteraction({
                      productId: asset.productId,
                      assetId: asset.id,
                      action: 'CLICKED',
                      visitorToken,
                      metadata: {
                        source: 'library-gallery-inline',
                        targetUrl: resolvedTargetUrl
                      }
                    })
                  }
                >
                  <Link2 className="h-5 w-5" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto] md:items-start">
            <div className="min-w-0">
              <p className="text-xl font-semibold leading-tight text-black">
                {asset.title}
              </p>
              {asset.description?.trim() ? (
                <p className="mt-2 line-clamp-2 text-sm text-black/65">
                  {asset.description.trim()}
                </p>
              ) : null}
            </div>

            {/* {stats.length > 0 ? (
              <div className="flex items-center gap-2 rounded-full bg-[#efe8de] px-3 py-2 text-xs font-medium text-black/65">
                {showLikes ? (
                  <span>{asset.stats?.likes ?? 0} likes</span>
                ) : null}
                {showViews ? (
                  <span>{asset.stats?.views ?? 0} views</span>
                ) : null}
                {showDownloads ? (
                  <span>{asset.stats?.downloads ?? 0} downloads</span>
                ) : null}
              </div>
            ) : null} */}
          </div>
        </div>

        {isClient && asset.type === 'IMAGE'
          ? createPortal(
              <AnimatePresence>
                {isExpanded ? (
                  <motion.div
                    className="fixed inset-0 z-[9999] overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(64,64,64,0.22),_transparent_28%),linear-gradient(180deg,rgba(4,4,6,0.92),rgba(9,9,11,0.98))]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsExpanded(false)}
                    />

                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)] opacity-40" />

                    <div className="absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs font-medium text-white/75 backdrop-blur-xl">
                      <button
                        type="button"
                        onClick={() => setIsZoomed((current) => !current)}
                        className="inline-flex items-center rounded-full bg-white/8 px-3 py-1.5 text-white transition hover:bg-white/14"
                      >
                        {isZoomed ? 'Fit' : 'Zoom'}
                      </button>
                      <span className="hidden sm:inline">
                        {isZoomed
                          ? 'Click image to reset zoom'
                          : 'Click image to zoom in'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsExpanded(false)}
                      className="absolute right-5 top-5 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-xl transition hover:bg-white/10"
                      aria-label="Close expanded image"
                    >
                      <X className="h-5 w-5" />
                    </button>

                    <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 20 }}
                        transition={{
                          duration: 0.28,
                          ease: [0.22, 1, 0.36, 1]
                        }}
                        className="relative flex h-full w-full items-center justify-center"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <motion.button
                          type="button"
                          onClick={() => setIsZoomed((current) => !current)}
                          animate={{
                            cursor: isZoomed ? 'zoom-out' : 'zoom-in'
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 220,
                            damping: 24
                          }}
                          className="group relative flex h-[88vh] w-[min(92vw,1440px)] items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-[#050505] shadow-[0_40px_120px_rgba(0,0,0,0.75)]"
                        >
                          <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_20%,transparent_80%,rgba(255,255,255,0.03))]" />
                          <motion.div
                            animate={{ scale: isZoomed ? 1.55 : 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 220,
                              damping: 24
                            }}
                            className="flex h-full w-full items-center justify-center bg-[#050505]"
                          >
                            <Image
                              src={asset.url}
                              alt={asset.title}
                              width={2400}
                              height={2400}
                              unoptimized
                              className="max-h-[82vh] w-auto max-w-[88vw] object-contain"
                            />
                          </motion.div>
                        </motion.button>
                      </motion.div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>,
              document.body
            )
          : null}
      </section>
    );
  }

  return (
    <section
      className={
        inGrid
          ? 'flex h-full flex-col overflow-hidden'
          : embedded
            ? 'pb-6'
            : 'px-4 pb-6'
      }
    >
      <div
        className={`flex items-center gap-2 ${
          inGrid ? 'px-4 py-4' : embedded ? 'px-0 py-0 pb-4' : 'mt-4 px-6 py-4'
        }`}
      >
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
          title={`${assetLocationPrefix}${asset.id}`}
        >
          {asset.title}
        </div>
      </div>

      <style>{`
        [data-tenant-grid] input::placeholder {
          color: var(--tenant-text-secondary);
        }
      `}</style>

      <div className={`${inGrid ? 'flex-1 px-4 pb-4' : ''}`}>
        <div className="flex h-full gap-6 max-md:flex-col">
          <div
            className="min-w-0 flex-1 overflow-hidden border shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
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

            <div
              className={`flex items-center justify-center bg-black p-4 md:p-8 ${
                inGrid ? 'h-full min-h-0' : 'min-h-[420px] md:min-h-[540px]'
              }`}
              style={{ backgroundColor: '#000000' }}
            >
              {asset.type === 'VIDEO' ? (
                <video
                  src={asset.url}
                  controls
                  poster={previewUrl ?? undefined}
                  className={`w-full object-contain ${
                    inGrid ? 'h-full max-h-full' : 'max-h-[72vh]'
                  }`}
                  style={{ backgroundColor: '#000000' }}
                />
              ) : asset.type === 'IMAGE' ? (
                <Image
                  src={asset.url}
                  alt={asset.title}
                  width={1600}
                  height={1600}
                  unoptimized
                  className={`max-w-full object-contain ${
                    inGrid ? 'h-full max-h-full w-auto' : 'max-h-[72vh]'
                  }`}
                />
              ) : asset.type === 'PDF' ? (
                <iframe
                  src={asset.url}
                  title={asset.title}
                  className={`w-full bg-white ${
                    inGrid ? 'h-full min-h-0' : 'h-[72vh] min-h-[520px]'
                  }`}
                />
              ) : previewUrl ? (
                <div
                  className={`flex w-full items-center justify-center bg-cover bg-center ${
                    inGrid ? 'h-full min-h-0' : 'min-h-[420px]'
                  }`}
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
                  className={`flex w-full items-center justify-center ${
                    inGrid ? 'h-full min-h-0' : 'min-h-[420px]'
                  }`}
                  style={{
                    background:
                      'radial-gradient(circle at top, var(--tenant-accent)2e, transparent 40%), linear-gradient(180deg, rgba(24,24,27,0.5), rgba(9,9,11,0.96))'
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

          <aside className="w-full max-w-[340px] space-y-4 max-md:max-w-none">
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
                          source: embedded
                            ? 'library-gallery-inline'
                            : 'library-item-page',
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
              className="mt-3 flex gap-2 border p-3 *:w-full *:grow"
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
                  <span>{asset.stats?.likes ?? 0}</span>
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
                  <span>{asset.stats?.views ?? 0}</span>
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
                  <span>{asset.stats?.downloads ?? 0}</span>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
