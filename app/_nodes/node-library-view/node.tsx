"use client";

import { GalleryVerticalEnd, Grid3X3, Link2 } from "lucide-react";

import { api } from "~/trpc/react";

type DashboardNodeLibraryViewProps = {
  props?: Record<string, unknown>;
};

type LibraryItemLayout = {
  w: number[];
  h: number[];
};

function readProductId(props?: Record<string, unknown>) {
  return typeof props?.productId === "string" ? props.productId : "";
}

function readItemLayout(props?: Record<string, unknown>): LibraryItemLayout {
  const raw =
    props?.itemLayout && typeof props.itemLayout === "object"
      ? (props.itemLayout as Record<string, unknown>)
      : {};
  const widths = Array.isArray(raw.w)
    ? raw.w.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : [];
  const heights = Array.isArray(raw.h)
    ? raw.h.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : [];
  return {
    w: widths.length ? widths : [1],
    h: heights.length ? heights : [6, 8, 10],
  };
}

function readViewInGallery(props?: Record<string, unknown>) {
  return Boolean(props?.viewInGallery);
}

function readOpenInModal(props?: Record<string, unknown>) {
  return Boolean(props?.openInModal);
}

export function DashboardNodeLibraryView({ props }: DashboardNodeLibraryViewProps) {
  const productId = readProductId(props);
  const itemLayout = readItemLayout(props);
  const viewInGallery = readViewInGallery(props);
  const openInModal = readOpenInModal(props);
  const productQuery = api.products.byId.useQuery(
    { productId },
    { enabled: Boolean(productId) },
  );

  if (!productId) {
    return (
      <div className="flex h-full flex-col justify-between rounded-xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        <div>
          <p className="font-semibold">`library_view` requires a product.</p>
          <p className="mt-2 text-xs text-amber-50/80">
            Select a product in the page editor so this node can render library assets.
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-amber-50/70">
          Default grid size: 1 column wide, 6/8/10 rows tall.
        </div>
      </div>
    );
  }

  if (productQuery.isLoading) {
    return (
      <div className="h-full rounded-xl border border-white/10 bg-black/40 p-4">
        Loading library view...
      </div>
    );
  }

  if (!productQuery.data) {
    return (
      <div className="h-full rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm">
        Product not found.
      </div>
    );
  }

  const product = productQuery.data;
  const assetCount = product.assets.filter((asset) => {
    if (asset.stepId) return false;
    if (asset.moduleType === "COURSE") return false;
    if (asset.placement === "STEP") return false;
    return true;
  }).length;

  return (
    <article className="flex h-full flex-col justify-between rounded-xl border border-white/10 bg-zinc-950/80 p-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              Library View
            </p>
            <h3 className="truncate text-sm font-semibold text-white">{product.name}</h3>
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 p-2 text-zinc-300">
            <GalleryVerticalEnd className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-sm text-zinc-400">
          Source node that expands the product library into real page-grid items.
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid gap-2 text-[11px] text-zinc-300">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <span className="inline-flex items-center gap-2">
              <Grid3X3 className="h-3.5 w-3.5 text-sky-300" />
              Width options
            </span>
            <span className="font-mono">[{itemLayout.w.join(", ")}]</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <span className="inline-flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-violet-300" />
              Height options
            </span>
            <span className="font-mono">[{itemLayout.h.join(", ")}]</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <span>Assets linked</span>
            <span>{assetCount}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <span>Open inside gallery</span>
            <span>{viewInGallery ? "On" : "Off"}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <span>Open in modal</span>
            <span>{openInModal ? "On" : "Off"}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
