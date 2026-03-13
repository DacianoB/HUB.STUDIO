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

function AssetIcon({
  type,
  className = 'h-6 w-6'
}: {
  type?: string;
  className?: string;
}) {
  if (type === 'VIDEO') return <Film className={className} />;
  if (type === 'PDF' || type === 'FILE') {
    return <FileText className={className} />;
  }
  return <Link2 className={className} />;
}

function readAssetBadgeLabel(type?: string) {
  if (type === 'PDF') return 'PDF';
  if (type === 'FILE') return 'FILE';
  return null;
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
  const badgeLabel = readAssetBadgeLabel(asset.type);
  const showsDocumentBadge = asset.type === 'PDF' || asset.type === 'FILE';
  const sharedClassName =
    `group relative block h-full w-full overflow-hidden    ${className ?? ''}`.trim();

  const hoverHandlers = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false)
  };

  if (asset.type === 'VIDEO' && asset.url) {
    const videoCard = (
      <>
        <motion.div
          initial={{ marginBottom: 0 }}
          animate={{ marginBottom: isHovered ? 44 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="absolute inset-0 bg-center transition-transform overflow-hidden rounded-b-[var(--tenant-node-radius)]"
          style={{
            // backgroundImage: ` url(${preview})`,
            backgroundColor: 'var(--tenant-background)'
          }}
        >
          <HoverPlayCard
            parentIsHovering={isHovered}
            src={asset.url}
            poster={preview ?? undefined}
            title={asset.title}
            className={className ?? 'h-full w-full absolute inset-0 '}
            onOpen={interactive && onOpen ? onOpen : undefined}
            overlayInteractive={false}
            showCenterControl={false}
          />
        </motion.div>

        {/* <div className="absolute group-hover:opacity-20 opacity-0 transition-opacity duration-300 inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.2),_transparent_42%),linear-gradient(180deg,_rgba(24,24,27,0.48),_rgba(9,9,11,0.96))]" /> */}

        <div className="relative flex h-full flex-col justify-between p-3 px-4 bg-[var(--tenant-background)] ">
          <div className="flex items-start justify-end">
            {/* <div className="rounded-full border border-white/10 bg-black/35 p-2 text-white/80 backdrop-blur">
            <AssetIcon type={asset.type} />
          </div> */}
          </div>
          <motion.div
            className="z-[-1] absolute w-full h-16 left-0 bottom-0 bg-white flex  items-center justify-between gap-1 "
            initial={{ opacity: 1 }}
            animate={{
              opacity: !interactive || isHovered ? 1 : 1,
              y: !interactive || isHovered ? 0 : 64
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />

          {/* card content */}
          <motion.div
            className="flex w-full items-center justify-between gap-1 "
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

    if (!interactive) {
      return videoCard;
    }

    // if (onOpen) {
    //   return videoCard;
    // }

    if (href) {
      return (
        <Link
          href={href as any}
          target={opensInNewTab ? '_blank' : undefined}
          rel={opensInNewTab ? 'noreferrer noopener' : undefined}
          className={sharedClassName}
          {...hoverHandlers}
        >
          {videoCard}
        </Link>
      );
    }

    return (
      <div
        className={sharedClassName + ' cursor-pointer'}
        {...hoverHandlers}
        onClick={onOpen}
        style={{
                  backgroundColor: 'var(--tenant-background)'
                }}
              >
                {videoCard}
      </div>
    );
  }

  const cardContent = (
    <>
      {preview ? (
        <motion.div
          initial={{ marginBottom: 0 }}
          animate={{ marginBottom: isHovered ? 44 : 0 }}
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

      {badgeLabel ? (
        <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/85 backdrop-blur-xl">
          <AssetIcon type={asset.type} className="h-3.5 w-3.5" />
          <span>{badgeLabel}</span>
        </div>
      ) : null}

      {!preview && showsDocumentBadge ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="inline-flex flex-col items-center gap-3 rounded-[28px] border border-white/10 bg-black/35 px-6 py-5 text-white/80 backdrop-blur-md">
            <AssetIcon type={asset.type} className="h-12 w-12" />
            <span className="text-xs font-semibold uppercase tracking-[0.28em]">
              {badgeLabel}
            </span>
          </div>
        </div>
      ) : null}

      {/* <div className="absolute group-hover:opacity-20 opacity-0 transition-opacity duration-300 inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.2),_transparent_42%),linear-gradient(180deg,_rgba(24,24,27,0.48),_rgba(9,9,11,0.96))]" /> */}

      <div className="relative flex h-full flex-col justify-between p-3 px-4 bg-[var(--tenant-background)]">
        <div className="flex items-start justify-end">
          {/* <div className="rounded-full border border-white/10 bg-black/35 p-2 text-white/80 backdrop-blur">
            <AssetIcon type={asset.type} />
          </div> */}
        </div>
        {/* card content */}

        <motion.div
          className="z-[-1] absolute w-full h-16 left-0 bottom-0 bg-white flex  items-center justify-between gap-1 "
          initial={{ opacity: 1 }}
          animate={{
            opacity: !interactive || isHovered ? 1 : 1,
            y: !interactive || isHovered ? 0 : 64
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
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

  if (!interactive) {
    return (
      <div className={sharedClassName} {...hoverHandlers}>
        {cardContent}
      </div>
    );
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
