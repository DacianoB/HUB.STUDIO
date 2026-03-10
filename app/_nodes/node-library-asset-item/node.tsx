"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Film, Link2 } from "lucide-react";

import HoverPlayCard from "~/components/ui/hover-play-card";

type LibraryAssetSnapshot = {
  id?: string;
  title?: string;
  url?: string;
  type?: string;
  targetUrl?: string | null;
  openInNewTab?: boolean | null;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
};

type DashboardNodeLibraryAssetItemProps = {
  props?: Record<string, unknown>;
};

function normalizeSlug(slug: string) {
  return slug.replace(/^\/+|\/+$/g, "");
}

function readAsset(props?: Record<string, unknown>): LibraryAssetSnapshot | null {
  const candidate = props?.asset;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as LibraryAssetSnapshot;
}

function readPreview(asset: LibraryAssetSnapshot | null) {
  if (!asset) return null;
  if (asset.previewUrl) return asset.previewUrl;
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  if ((asset.type === "IMAGE" || asset.type === "LINK") && asset.url) return asset.url;
  return null;
}

function readSourcePageSlug(props?: Record<string, unknown>) {
  return typeof props?.sourcePageSlug === "string"
    ? normalizeSlug(props.sourcePageSlug)
    : "";
}

function AssetIcon({ type }: { type?: string }) {
  if (type === "VIDEO") return <Film className="h-6 w-6" />;
  if (type === "PDF" || type === "FILE") return <FileText className="h-6 w-6" />;
  return <Link2 className="h-6 w-6" />;
}

export function DashboardNodeLibraryAssetItem({
  props,
}: DashboardNodeLibraryAssetItemProps) {
  const router = useRouter();
  const asset = readAsset(props);
  const preview = readPreview(asset);
  const sourcePageSlug = readSourcePageSlug(props);
  const linkHref =
    asset?.type === "LINK"
      ? (asset.targetUrl?.trim() || asset.url?.trim() || "#")
      : asset?.id
        ? `/${[sourcePageSlug, "g", asset.id].filter(Boolean).join("/")}`
        : "#";
  const opensInNewTab = asset?.type === "LINK" ? (asset.openInNewTab ?? true) : false;

  if (!asset) {
    return <div className="h-full w-full rounded-xl bg-zinc-950/80" />;
  }

  if (asset.type === "VIDEO" && asset.url) {
    return (
      <HoverPlayCard
        src={asset.url}
        poster={preview ?? undefined}
        title={asset.title}
        className="h-full w-full"
        onOpen={() => {
          if (opensInNewTab) {
            window.open(linkHref, "_blank", "noopener,noreferrer");
            return;
          }

          void router.push(linkHref as any);
        }}
      />
    );
  }

  return (
    <Link
      href={linkHref as any}
      target={opensInNewTab ? "_blank" : undefined}
      rel={opensInNewTab ? "noreferrer noopener" : undefined}
      className="group relative block h-full w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950"
    >
      {preview ? (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(9,9,11,0.04), rgba(9,9,11,0.82)), url(${preview})`,
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
    </Link>
  );
}
