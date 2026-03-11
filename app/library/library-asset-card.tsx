'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Film, Link2 } from 'lucide-react';
import { motion } from 'framer-motion';

import HoverPlayCard from '~/components/ui/hover-play-card';

export type LibraryAssetCardAsset = {
  id?: string;
  title?: string;
  url?: string;
  type?: string;
  tags?: string[];
  targetUrl?: string | null;
  openInNewTab?: boolean | null;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
};

export function readLibraryAssetCardPreview(
  asset: LibraryAssetCardAsset | null
) {
  if (!asset) return null;
  if (asset.previewUrl) return asset.previewUrl;
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  if ((asset.type === 'IMAGE' || asset.type === 'LINK') && asset.url) {
    return asset.url;
  }
  return null;
}

function AssetIcon({ type }: { type?: string }) {
  if (type === 'VIDEO') return <Film className="h-6 w-6" />;
  if (type === 'PDF' || type === 'FILE') {
    return <FileText className="h-6 w-6" />;
  }
  return <Link2 className="h-6 w-6" />;
}

type LibraryAssetGalleryCardProps = {
  asset: LibraryAssetCardAsset;
  className?: string;
  href?: string;
  opensInNewTab?: boolean;
  onOpen?: () => void;
  interactive?: boolean;
};

export function LibraryAssetGalleryCard({
  asset,
  className,
  href,
  opensInNewTab = false,
  onOpen,
  interactive = true
}: LibraryAssetGalleryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const preview = readLibraryAssetCardPreview(asset);
  const itemTags = (asset.tags ?? [])
    .filter(
      (tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())
    )
    .slice(0, 3);
  const title = asset.title?.trim() || 'Untitled item';
  const sharedClassName =
    `group relative block h-full w-full overflow-hidden   bg-white ${className ?? ''}`.trim();

  if (asset.type === 'VIDEO' && asset.url) {
    const videoCard = (
      <HoverPlayCard
        src={asset.url}
        poster={preview ?? undefined}
        title={asset.title}
        className={className ?? 'h-full w-full'}
        onOpen={interactive && onOpen ? onOpen : undefined}
        overlayInteractive={false}
        showCenterControl={false}
      />
    );

    if (!interactive) {
      return videoCard;
    }

    if (onOpen) {
      return videoCard;
    }

    if (href) {
      return (
        <Link
          href={href as any}
          target={opensInNewTab ? '_blank' : undefined}
          rel={opensInNewTab ? 'noreferrer noopener' : undefined}
          className="block h-full w-full"
        >
          {videoCard}
        </Link>
      );
    }

    return <div className="block h-full w-full">{videoCard}</div>;
  }

  const cardContent = (
    <>
      {preview ? (
        <motion.div
          initial={{ marginBottom: 0 }}
          animate={{ marginBottom: isHovered ? 48 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="absolute inset-0 bg-cover bg-center transition-transform rounded-[var(--tenant-node-radius)]"
          style={{
            backgroundImage: ` url(${preview})`,
            backgroundColor: 'var(--tenant-background)'
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.2),_transparent_42%),linear-gradient(180deg,_rgba(24,24,27,0.48),_rgba(9,9,11,0.96))]" />
      )}

      {/* <div className="absolute group-hover:opacity-20 opacity-0 transition-opacity duration-300 inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.2),_transparent_42%),linear-gradient(180deg,_rgba(24,24,27,0.48),_rgba(9,9,11,0.96))]" /> */}

      <div className="relative flex h-full flex-col justify-between p-3 bg-[var(--tenant-background)]">
        <div className="flex items-start justify-end">
          {/* <div className="rounded-full border border-white/10 bg-black/35 p-2 text-white/80 backdrop-blur">
            <AssetIcon type={asset.type} />
          </div> */}
        </div>
        {/* card content */}
        <motion.div
          className="flex w-full items-center justify-between gap-1"
          initial={{ opacity: 1, y: 10 }}
          animate={{
            opacity: !interactive || isHovered ? 1 : 1,
            y: !interactive || isHovered ? 0 : 40
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <div className="truncate text-xs font-medium text-[var(--tenant-bg-main)]">
            {title}
          </div>
          {itemTags.length ? (
            <motion.div className="flex-shrink-0 mt-1 items-center flex flex-wrap gap-1.5">
              {itemTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--tenant-text-main)] px-2 py-1 text-[10px] text-[var(--tenant-bg-main)] backdrop-blur"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          ) : null}
        </motion.div>
      </div>
    </>
  );

  const hoverHandlers = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false)
  };

  if (!interactive) {
    return <div className={sharedClassName}>{cardContent}</div>;
  }

  if (href) {
    return (
      <Link
        href={href as any}
        target={opensInNewTab ? '_blank' : undefined}
        rel={opensInNewTab ? 'noreferrer noopener' : undefined}
        className={sharedClassName}
        {...hoverHandlers}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${sharedClassName} text-left`}
      {...hoverHandlers}
    >
      {cardContent}
    </button>
  );
}
