'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import {
  LibraryAssetGalleryCard,
  type LibraryAssetCardAsset
} from '~/app/library/library-asset-card';
import { LibraryAssetDetailPanel } from '~/app/library/library-asset-detail';

type LibraryAssetSnapshot = LibraryAssetCardAsset & {
  systemTags?: string[];
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

function readSourcePageSlug(props?: Record<string, unknown>) {
  return typeof props?.sourcePageSlug === 'string'
    ? normalizeSlug(props.sourcePageSlug)
    : '';
}

function readSourcePageName(props?: Record<string, unknown>) {
  return typeof props?.sourcePageName === 'string' &&
    props.sourcePageName.trim()
    ? props.sourcePageName.trim()
    : 'Library';
}

function readOpenInModal(props?: Record<string, unknown>) {
  return Boolean(props?.openInModal);
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
    '--tenant-text-main': computed
      .getPropertyValue('--tenant-text-main')
      .trim(),
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
          className="relative max-h-[92vh] w-full max-w-[900px] rounded-[var(--tenant-node-radius)]"
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

  return (
    <>
      <LibraryAssetGalleryCard
        asset={asset}
        className="h-full w-full"
        href={openInModal ? undefined : linkHref}
        opensInNewTab={opensInNewTab}
        onOpen={openInModal ? openAsset : undefined}
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
