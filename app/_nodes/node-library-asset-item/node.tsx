'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { FileText, Film, Link2, X } from 'lucide-react';

import { LibraryAssetDetailPanel } from '~/app/library/library-asset-detail';
import HoverPlayCard from '~/components/ui/hover-play-card';

type LibraryAssetSnapshot = {
  id?: string;
  title?: string;
  url?: string;
  type?: string;
  systemTags?: string[];
  targetUrl?: string | null;
  openInNewTab?: boolean | null;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
};

type DashboardNodeLibraryAssetItemProps = {
  props?: Record<string, unknown>;
};

function normalizeSlug(slug: string) {
  return slug.replace(/^\/+|\/+$/g, '');
}

function readAsset(
  props?: Record<string, unknown>
): LibraryAssetSnapshot | null {
  const candidate = props?.asset;
  if (!candidate || typeof candidate !== 'object') return null;
  return candidate as LibraryAssetSnapshot;
}

function readPreview(asset: LibraryAssetSnapshot | null) {
  if (!asset) return null;
  if (asset.previewUrl) return asset.previewUrl;
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  if ((asset.type === 'IMAGE' || asset.type === 'LINK') && asset.url)
    return asset.url;
  return null;
}

function readSourcePageSlug(props?: Record<string, unknown>) {
  return typeof props?.sourcePageSlug === 'string'
    ? normalizeSlug(props.sourcePageSlug)
    : '';
}

function readSourcePageName(props?: Record<string, unknown>) {
  return typeof props?.sourcePageName === 'string' && props.sourcePageName.trim()
    ? props.sourcePageName.trim()
    : 'Library';
}

function readOpenInModal(props?: Record<string, unknown>) {
  return Boolean(props?.openInModal);
}

function AssetIcon({ type }: { type?: string }) {
  if (type === 'VIDEO') return <Film className="h-6 w-6" />;
  if (type === 'PDF' || type === 'FILE')
    return <FileText className="h-6 w-6" />;
  return <Link2 className="h-6 w-6" />;
}

function readPortalThemeStyle(): CSSProperties {
  if (typeof window === 'undefined') {
    return {};
  }

  const themeRoot =
    (document.activeElement instanceof HTMLElement
      ? document.activeElement.closest('[data-tenant-grid]')
      : null) ?? document.querySelector('[data-tenant-grid]');

  if (!(themeRoot instanceof HTMLElement)) {
    return {};
  }

  const computed = window.getComputedStyle(themeRoot);
  return {
    '--tenant-bg-main': computed.getPropertyValue('--tenant-bg-main').trim(),
    '--tenant-bg-secondary': computed
      .getPropertyValue('--tenant-bg-secondary')
      .trim(),
    '--tenant-text-main': computed.getPropertyValue('--tenant-text-main').trim(),
    '--tenant-text-secondary': computed
      .getPropertyValue('--tenant-text-secondary')
      .trim(),
    '--tenant-border': computed.getPropertyValue('--tenant-border').trim(),
    '--tenant-accent': computed.getPropertyValue('--tenant-accent').trim(),
    '--tenant-button-primary': computed
      .getPropertyValue('--tenant-button-primary')
      .trim(),
    '--tenant-button-primary-hover': computed
      .getPropertyValue('--tenant-button-primary-hover')
      .trim(),
    '--tenant-button-text': computed
      .getPropertyValue('--tenant-button-text')
      .trim(),
    '--tenant-card-bg': computed.getPropertyValue('--tenant-card-bg').trim(),
    '--tenant-node-radius': computed
      .getPropertyValue('--tenant-node-radius')
      .trim(),
    '--tenant-node-radius-sm': computed
      .getPropertyValue('--tenant-node-radius-sm')
      .trim(),
    '--tenant-node-radius-pill': computed
      .getPropertyValue('--tenant-node-radius-pill')
      .trim()
  } as CSSProperties;
}

function LibraryAssetModal({
  assetId,
  pageName,
  onClose
}: {
  assetId: string;
  pageName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const portalThemeStyle = readPortalThemeStyle();

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]" style={portalThemeStyle}>
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div
          className="relative h-[92vh] w-full max-w-[900px] rounded-[var(--tenant-node-radius)]"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-black/35 backdrop-blur-sm"
            style={{
              borderColor: 'var(--tenant-border)',
              color: 'var(--tenant-text-main)'
            }}
            aria-label="Close library item preview"
          >
            <X className="h-5 w-5" />
          </button>
          <LibraryAssetDetailPanel
            assetId={assetId}
            backHref=""
            pageName={pageName}
            inGrid
            onBack={onClose}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

export function DashboardNodeLibraryAssetItem({
  props
}: DashboardNodeLibraryAssetItemProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const asset = readAsset(props);
  const preview = readPreview(asset);
  const openInModal = readOpenInModal(props);
  const sourcePageName = readSourcePageName(props);
  const sourcePageSlug = readSourcePageSlug(props);
  const linkHref =
    asset?.type === 'LINK'
      ? asset.targetUrl?.trim() || asset.url?.trim() || '#'
      : asset?.id
        ? `/${[sourcePageSlug, 'g', asset.id].filter(Boolean).join('/')}`
        : '#';
  const opensInNewTab =
    asset?.type === 'LINK' ? (asset.openInNewTab ?? true) : false;

  if (!asset) {
    return <div className="h-full w-full rounded-xl bg-zinc-950/80" />;
  }

  const openAsset = () => {
    if (openInModal && asset.id) {
      setIsModalOpen(true);
      return;
    }

    if (opensInNewTab) {
      window.open(linkHref, '_blank', 'noopener,noreferrer');
      return;
    }

    void router.push(linkHref as any);
  };

  if (asset.type === 'VIDEO' && asset.url) {
    return (
      <>
        <HoverPlayCard
          src={asset.url}
          poster={preview ?? undefined}
          title={asset.title}
          className="h-full w-full"
          onOpen={openAsset}
        />
        {isModalOpen && asset.id ? (
          <LibraryAssetModal
            assetId={asset.id}
            pageName={sourcePageName}
            onClose={() => setIsModalOpen(false)}
          />
        ) : null}
      </>
    );
  }

  const cardContent = (
    <>
      {preview ? (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[10000ms] group-hover:scale-[1.4] ease-in-out"
          style={{
            backgroundImage: ` url(${preview})`
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.2),_transparent_42%),linear-gradient(180deg,_rgba(24,24,27,0.48),_rgba(9,9,11,0.96))]" />
      )}

      <div className="relative flex h-full items-start justify-end p-3">
        {preview ? null : (
          <div className="rounded-full border border-white/10 bg-black/35 p-2 text-white/80 backdrop-blur">
            <AssetIcon type={asset.type} />
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {openInModal ? (
        <button
          type="button"
          onClick={openAsset}
          className="group relative block h-full w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950 text-left"
        >
          {cardContent}
        </button>
      ) : (
        <Link
          href={linkHref as any}
          target={opensInNewTab ? '_blank' : undefined}
          rel={opensInNewTab ? 'noreferrer noopener' : undefined}
          className="group relative block h-full w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950"
        >
          {cardContent}
        </Link>
      )}
      {isModalOpen && asset.id ? (
        <LibraryAssetModal
          assetId={asset.id}
          pageName={sourcePageName}
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </>
  );
}
