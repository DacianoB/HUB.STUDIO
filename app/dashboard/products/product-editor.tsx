"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  FileStack,
  GalleryVertical,
  PackagePlus,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { ACTIVE_TENANT_STORAGE_KEY, api } from "~/trpc/react";

type ProductEditorMode = "create" | "edit";
type ProductType =
  | "COURSE"
  | "PHYSICAL_PRODUCT"
  | "DIGITAL_PRODUCT"
  | "SERVICE"
  | "CUSTOM";
type ProductModuleType = "LIBRARY" | "COURSE";
type ProductAssetType = "VIDEO" | "PDF" | "FILE" | "IMAGE" | "LINK";

type StepMetadata = {
  coverImageUrl?: string;
  content?: string;
};

type LibraryAssetMetadata = {
  showViews?: boolean;
  showDownloads?: boolean;
  showLikes?: boolean;
};

type ProductEditorProps = {
  mode: ProductEditorMode;
  productId?: string;
};

const PRODUCT_TYPES: Array<[ProductType, string]> = [
  ["COURSE", "Course"],
  ["PHYSICAL_PRODUCT", "Physical"],
  ["DIGITAL_PRODUCT", "Digital"],
  ["SERVICE", "Service"],
  ["CUSTOM", "Custom"],
];

const MODULE_COPY: Record<
  ProductModuleType,
  { label: string; description: string; icon: typeof GalleryVertical }
> = {
  LIBRARY: {
    label: "Library",
    description:
      "Create reusable image, video, PDF, file, and link items for the product hub.",
    icon: FileStack,
  },
  COURSE: {
    label: "Course",
    description:
      "Create step-based content with title, description, background image, long-form body, and step-specific assets.",
    icon: BookOpen,
  },
};

function readStepMetadata(step: { metadata?: unknown }): StepMetadata {
  if (!step.metadata || typeof step.metadata !== "object") return {};
  return step.metadata as StepMetadata;
}

function readLibraryAssetMetadata(asset: { metadata?: unknown }): LibraryAssetMetadata {
  if (!asset.metadata || typeof asset.metadata !== "object") return {};
  return asset.metadata as LibraryAssetMetadata;
}

function readAssetModule(asset: {
  stepId?: string | null;
  moduleType?: string | null;
  placement?: string | null;
}): ProductModuleType {
  if (asset.stepId || asset.moduleType === "COURSE" || asset.placement === "STEP") {
    return "COURSE";
  }
  return "LIBRARY";
}

function titleFromFileName(fileName: string) {
  const trimmed = fileName.trim();
  const withoutExtension = trimmed.replace(/\.[^.]+$/, "").trim();
  return withoutExtension || trimmed || "Untitled file";
}

function messageFromUploadResponse(response: Response, text: string) {
  if (text.trim()) {
    try {
      const parsed = JSON.parse(text) as { message?: string } | undefined;
      if (parsed?.message?.trim()) return parsed.message.trim();
    } catch {
      // Ignore parse errors and fall back to status-based messaging.
    }
  }

  if (response.status === 413) {
    return "File is too large for the upload endpoint.";
  }

  if (response.statusText.trim()) {
    return `${response.status} ${response.statusText}`.trim();
  }

  return response.ok ? "Upload failed." : `Upload failed with status ${response.status}.`;
}

function parseUploadResponse(text: string) {
  if (!text.trim()) return undefined;

  try {
    return JSON.parse(text) as
      | {
          assetType?: ProductAssetType;
          fileName?: string;
          message?: string;
          publicUrl?: string;
        }
      | undefined;
  } catch {
    return undefined;
  }
}

function buildModulePayload({
  selectedModules,
  libraryAllowDownloads,
  courseLockSequential,
}: {
  selectedModules: Record<ProductModuleType, boolean>;
  libraryAllowDownloads: boolean;
  courseLockSequential: boolean;
}) {
  return [
    {
      moduleType: "LIBRARY" as const,
      isEnabled: selectedModules.LIBRARY,
      sortOrder: 1,
      settings: {
        allowDownloads: libraryAllowDownloads,
        allowedAssetTypes: ["VIDEO", "PDF", "IMAGE", "LINK", "FILE"],
      },
    },
    {
      moduleType: "COURSE" as const,
      isEnabled: selectedModules.COURSE,
      sortOrder: 2,
      settings: {
        lockSequentialSteps: courseLockSequential,
        includeTextContent: true,
        allowCoverImage: true,
      },
    },
  ];
}

export function ProductEditor({ mode, productId }: ProductEditorProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const isEditMode = mode === "edit";
  const productQuery = api.products.byId.useQuery(
    { productId: productId ?? "" },
    { enabled: Boolean(isEditMode && productId) }
  );
  const tenantModuleCatalogQuery = api.products.tenantModuleCatalog.useQuery();

  const createProductMutation = api.products.create.useMutation({
    onSuccess: async (product) => {
      await utils.products.list.invalidate();
      router.push(`/admin/dashboard/products/${product.id}`);
    },
  });
  const updateProductMutation = api.products.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.products.list.invalidate(),
        productId ? utils.products.byId.invalidate({ productId }) : Promise.resolve(),
      ]);
    },
  });
  const createStepMutation = api.productSteps.create.useMutation({
    onSuccess: async (createdStep) => {
      setNewStepTitle("");
      setNewStepDescription("");
      setSelectedStepId(createdStep.id);
      if (!productId) return;
      await utils.products.byId.invalidate({ productId });
    },
  });
  const updateStepMutation = api.productSteps.update.useMutation({
    onSuccess: async () => {
      if (!productId) return;
      await utils.products.byId.invalidate({ productId });
    },
  });
  const removeStepMutation = api.productSteps.removeStep.useMutation({
    onSuccess: async () => {
      if (!productId) return;
      await utils.products.byId.invalidate({ productId });
    },
  });
  const createAssetMutation = api.productSteps.createAsset.useMutation({
    onSuccess: async () => {
      setCourseAssetTitle("");
      setCourseAssetUrl("");
      setCourseAssetType("VIDEO");
      setCourseAssetDownloadable(false);
      setSelectedGalleryAssetId("");
      setGalleryAssetTitle("");
      setGalleryAssetDescription("");
      setGalleryAssetUrl("");
      setGalleryAssetTargetUrl("");
      setGalleryAssetOpenInNewTab(true);
      setGalleryAssetType("IMAGE");
      setGalleryAssetDownloadable(false);
      setGalleryAssetShowViews(true);
      setGalleryAssetShowDownloads(true);
      setGalleryAssetShowLikes(true);
      if (!productId) return;
      await utils.products.byId.invalidate({ productId });
    },
  });
  const updateAssetMutation = api.productSteps.updateAsset.useMutation({
    onSuccess: async () => {
      if (!productId) return;
      await utils.products.byId.invalidate({ productId });
    },
  });
  const removeAssetMutation = api.productSteps.removeAsset.useMutation({
    onSuccess: async () => {
      if (!productId) return;
      await utils.products.byId.invalidate({ productId });
    },
  });

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState<ProductType>("COURSE");
  const [createDemoCourseContent, setCreateDemoCourseContent] = useState(false);
  const [selectedModules, setSelectedModules] = useState<Record<ProductModuleType, boolean>>({
    LIBRARY: true,
    COURSE: true,
  });
  const [libraryAllowDownloads, setLibraryAllowDownloads] = useState(true);
  const [courseLockSequential, setCourseLockSequential] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<ProductModuleType>("COURSE");

  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepDescription, setNewStepDescription] = useState("");
  const [selectedStepId, setSelectedStepId] = useState("");
  const [stepTitle, setStepTitle] = useState("");
  const [stepDescription, setStepDescription] = useState("");
  const [stepBody, setStepBody] = useState("");
  const [stepCoverImageUrl, setStepCoverImageUrl] = useState("");
  const [stepRequired, setStepRequired] = useState(true);
  const [stepLocked, setStepLocked] = useState(false);

  const [courseAssetTitle, setCourseAssetTitle] = useState("");
  const [courseAssetUrl, setCourseAssetUrl] = useState("");
  const [courseAssetType, setCourseAssetType] = useState<ProductAssetType>("VIDEO");
  const [courseAssetDownloadable, setCourseAssetDownloadable] = useState(false);

  const [selectedGalleryAssetId, setSelectedGalleryAssetId] = useState("");
  const [galleryAssetTitle, setGalleryAssetTitle] = useState("");
  const [galleryAssetDescription, setGalleryAssetDescription] = useState("");
  const [galleryAssetUrl, setGalleryAssetUrl] = useState("");
  const [galleryAssetTargetUrl, setGalleryAssetTargetUrl] = useState("");
  const [galleryAssetOpenInNewTab, setGalleryAssetOpenInNewTab] = useState(true);
  const [galleryAssetType, setGalleryAssetType] = useState<ProductAssetType>("IMAGE");
  const [galleryAssetDownloadable, setGalleryAssetDownloadable] = useState(false);
  const [galleryAssetShowViews, setGalleryAssetShowViews] = useState(true);
  const [galleryAssetShowDownloads, setGalleryAssetShowDownloads] = useState(true);
  const [galleryAssetShowLikes, setGalleryAssetShowLikes] = useState(true);
  const [libraryUploadError, setLibraryUploadError] = useState("");
  const [isLibraryUploadPending, setIsLibraryUploadPending] = useState(false);
  const libraryFileInputRef = useRef<HTMLInputElement | null>(null);

  const product = productQuery.data;

  useEffect(() => {
    if (!product) return;

    setTitle(product.name);
    setSubtitle(product.subtitle ?? "");
    setDescription(product.description ?? "");
    setProductType(product.type as ProductType);

    const byType = new Map(
      (product.moduleConfigs ?? []).map((moduleConfig) => [
        moduleConfig.moduleType as ProductModuleType,
        moduleConfig,
      ])
    );

    setSelectedModules({
      LIBRARY: byType.get("LIBRARY")?.isEnabled ?? false,
      COURSE: byType.get("COURSE")?.isEnabled ?? false,
    });
    setLibraryAllowDownloads(
      Boolean(
        (byType.get("LIBRARY")?.settings as { allowDownloads?: boolean } | null)
          ?.allowDownloads ?? true
      )
    );
    setCourseLockSequential(product.lockSequentialSteps);
  }, [product]);

  const enabledTenantModules = useMemo(
    () =>
      new Set(
        (tenantModuleCatalogQuery.data ?? [])
          .filter((moduleEntry) => moduleEntry.isEnabled)
          .map((moduleEntry) => moduleEntry.moduleType as ProductModuleType)
      ),
    [tenantModuleCatalogQuery.data]
  );

  const activePlugins = useMemo(
    () =>
      (["LIBRARY", "COURSE"] as ProductModuleType[]).filter(
        (plugin) => selectedModules[plugin] && enabledTenantModules.has(plugin)
      ),
    [enabledTenantModules, selectedModules]
  );

  useEffect(() => {
    if (!activePlugins.length) return;
    if (!activePlugins.includes(selectedPlugin)) {
      setSelectedPlugin(activePlugins[0] ?? "COURSE");
    }
  }, [activePlugins, selectedPlugin]);

  const courseSteps = useMemo(
    () => (product?.steps ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    [product?.steps]
  );
  const selectedCourseStep = useMemo(
    () => courseSteps.find((step) => step.id === selectedStepId) ?? null,
    [courseSteps, selectedStepId]
  );

  useEffect(() => {
    if (!courseSteps.length) {
      setSelectedStepId("");
      return;
    }
    if (!courseSteps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(courseSteps[0]?.id ?? "");
    }
  }, [courseSteps, selectedStepId]);

  useEffect(() => {
    if (!selectedCourseStep) return;
    const metadata = readStepMetadata(selectedCourseStep);
    setStepTitle(selectedCourseStep.title);
    setStepDescription(selectedCourseStep.description ?? "");
    setStepBody(metadata.content ?? "");
    setStepCoverImageUrl(metadata.coverImageUrl ?? "");
    setStepRequired(selectedCourseStep.isRequired);
    setStepLocked(selectedCourseStep.lockUntilComplete);
  }, [selectedCourseStep]);

  const allAssets = useMemo(() => product?.assets ?? [], [product?.assets]);
  const galleryAssets = useMemo(
    () =>
      allAssets
        .filter((asset) => readAssetModule(asset) === "LIBRARY")
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [allAssets]
  );
  const courseAssets = useMemo(
    () =>
      allAssets
        .filter((asset) => readAssetModule(asset) === "COURSE")
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [allAssets]
  );
  const selectedStepAssets = useMemo(
    () => courseAssets.filter((asset) => asset.stepId === selectedStepId),
    [courseAssets, selectedStepId]
  );

  const selectedGalleryAsset = useMemo(
    () => galleryAssets.find((asset) => asset.id === selectedGalleryAssetId) ?? null,
    [galleryAssets, selectedGalleryAssetId]
  );

  useEffect(() => {
    setLibraryUploadError("");
    if (selectedGalleryAsset) {
      const metadata = readLibraryAssetMetadata(selectedGalleryAsset);
      setGalleryAssetTitle(selectedGalleryAsset.title);
      setGalleryAssetDescription(selectedGalleryAsset.description ?? "");
      setGalleryAssetUrl(selectedGalleryAsset.url);
      setGalleryAssetTargetUrl(
        selectedGalleryAsset.targetUrl ??
          (selectedGalleryAsset.type === "LINK" ? selectedGalleryAsset.url : "")
      );
      setGalleryAssetOpenInNewTab(selectedGalleryAsset.openInNewTab ?? true);
      setGalleryAssetType(selectedGalleryAsset.type as ProductAssetType);
      setGalleryAssetDownloadable(selectedGalleryAsset.isDownloadable);
      setGalleryAssetShowViews(metadata.showViews ?? true);
      setGalleryAssetShowDownloads(metadata.showDownloads ?? true);
      setGalleryAssetShowLikes(metadata.showLikes ?? true);
      return;
    }
    setGalleryAssetTitle("");
    setGalleryAssetDescription("");
    setGalleryAssetUrl("");
    setGalleryAssetTargetUrl("");
    setGalleryAssetOpenInNewTab(true);
    setGalleryAssetType("IMAGE");
    setGalleryAssetDownloadable(false);
    setGalleryAssetShowViews(true);
    setGalleryAssetShowDownloads(true);
    setGalleryAssetShowLikes(true);
  }, [selectedGalleryAsset]);

  async function handleLibraryFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) return;
    if (!productId) {
      setLibraryUploadError("Save the product before uploading library files.");
      return;
    }

    setLibraryUploadError("");
    setIsLibraryUploadPending(true);

    try {
      const tenantSlug =
        typeof window === "undefined"
          ? null
          : window.localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
      const uploadErrors: string[] = [];
      let createdCount = 0;

      for (const [index, file] of files.entries()) {
        try {
          const formData = new FormData();
          formData.set("file", file);
          formData.set("productId", productId);

          const response = await fetch("/api/uploads", {
            method: "POST",
            body: formData,
            headers: tenantSlug ? { "x-tenant-slug": tenantSlug } : undefined,
          });

          const responseText = await response.text();
          const result = parseUploadResponse(responseText);

          if (!response.ok) {
            throw new Error(messageFromUploadResponse(response, responseText));
          }

          if (!result?.publicUrl || !result.assetType) {
            throw new Error("Upload completed without a valid asset payload.");
          }

          const assetTitle = titleFromFileName(result.fileName ?? file.name);
          const isDownloadable =
            result.assetType === "PDF" || result.assetType === "FILE";

          await createAssetMutation.mutateAsync({
            productId,
            moduleType: "LIBRARY",
            placement: "LIBRARY",
            title: assetTitle,
            description: undefined,
            url: result.publicUrl,
            type: result.assetType,
            interactionMode: isDownloadable ? "DOWNLOAD" : "OPEN",
            isDownloadable,
            metadata: {
              showViews: galleryAssetShowViews,
              showDownloads: galleryAssetShowDownloads,
              showLikes: galleryAssetShowLikes,
            },
            sortOrder: galleryAssets.length + index + 1,
          });

          createdCount += 1;
        } catch (error) {
          uploadErrors.push(
            `${file.name}: ${error instanceof Error ? error.message : "Upload failed."}`
          );
        }
      }

      if (uploadErrors.length) {
        setLibraryUploadError(
          createdCount > 0
            ? `Created ${createdCount} item${createdCount === 1 ? "" : "s"}, but some uploads failed. ${uploadErrors.join(" ")}`
            : uploadErrors.join(" ")
        );
      }
    } catch (error) {
      setLibraryUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsLibraryUploadPending(false);
    }
  }

  async function handleSaveProduct() {
    const modules = buildModulePayload({
      selectedModules,
      libraryAllowDownloads,
      courseLockSequential,
    });

    if (isEditMode && productId) {
      await updateProductMutation.mutateAsync({
        productId,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        type: productType,
        modules,
        galleryOnly: !selectedModules.LIBRARY,
        lockSequentialSteps: courseLockSequential,
      });
      return;
    }

    await createProductMutation.mutateAsync({
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      description: description.trim() || undefined,
      type: productType,
      isFree: true,
      isVisible: true,
      currency: "USD",
      modules,
      galleryOnly: !selectedModules.LIBRARY,
      lockSequentialSteps: courseLockSequential,
      createDemoCourseContent,
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#060913_0%,_#02040b_100%)] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Link
                href="/admin/dashboard/products"
                className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to products
              </Link>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                  {isEditMode ? "Product editor" : "Create product"}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {isEditMode ? product?.name ?? "Loading product..." : "New product"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400 md:text-base">
                  Plugins are the actual building blocks of the product. Enable them first,
                  then edit each one in its own workspace.
                </p>
              </div>
            </div>

            <Button
              className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
              disabled={
                !title.trim() ||
                createProductMutation.isPending ||
                updateProductMutation.isPending
              }
              onClick={() => void handleSaveProduct()}
            >
              {isEditMode ? "Save product" : "Create and continue"}
            </Button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                Product basics
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                Identity and structure
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Product title"
              />
              <input
                className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                placeholder="Subtitle"
              />
              <textarea
                className="h-28 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-sky-400/50 md:col-span-2"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the promise of this product"
              />
              <div className="grid grid-cols-2 gap-2 md:col-span-2">
                {PRODUCT_TYPES.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setProductType(value)}
                    className={`h-11 rounded-xl border px-3 text-sm font-medium transition ${
                      productType === value
                        ? "border-sky-400/50 bg-sky-400/15 text-white"
                        : "border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                Product plugins
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                Enable what this product can use
              </h2>
            </div>

            <div className="space-y-3">
              {(["LIBRARY", "COURSE"] as ProductModuleType[]).map(
                (moduleType) => {
                  const config = MODULE_COPY[moduleType];
                  const tenantEnabled = enabledTenantModules.has(moduleType);
                  const Icon = config.icon;
                  return (
                    <label
                      key={moduleType}
                      className={`flex items-start gap-3 rounded-2xl border p-4 ${
                        tenantEnabled
                          ? "border-white/10 bg-black/30"
                          : "border-white/5 bg-black/15 opacity-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={tenantEnabled && selectedModules[moduleType]}
                        disabled={!tenantEnabled}
                        onChange={(event) =>
                          setSelectedModules((prev) => ({
                            ...prev,
                            [moduleType]: event.target.checked,
                          }))
                        }
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-sky-300" />
                          <span className="text-sm font-semibold text-white">
                            {config.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">{config.description}</p>
                      </div>
                    </label>
                  );
                }
              )}
            </div>

            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={libraryAllowDownloads}
                  onChange={(event) => setLibraryAllowDownloads(event.target.checked)}
                />
                Library items can be marked as downloadable
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={courseLockSequential}
                  onChange={(event) => setCourseLockSequential(event.target.checked)}
                />
                Course steps unlock sequentially
              </label>
              {!isEditMode ? (
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={createDemoCourseContent}
                    onChange={(event) => setCreateDemoCourseContent(event.target.checked)}
                  />
                  Create demo course steps automatically
                </label>
              ) : null}
            </div>
          </div>
        </section>

        {isEditMode && product ? (
          <section className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {activePlugins.map((pluginType) => {
                const config = MODULE_COPY[pluginType];
                const Icon = config.icon;
                return (
                  <button
                    key={pluginType}
                    type="button"
                    onClick={() => setSelectedPlugin(pluginType)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                      selectedPlugin === pluginType
                        ? "border-sky-400/50 bg-sky-400/15 text-white"
                        : "border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {config.label}
                  </button>
                );
              })}
            </div>

            {!activePlugins.length ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-10 text-center text-zinc-500">
                Enable at least one plugin to start building the product.
              </div>
            ) : null}

            {selectedPlugin === "COURSE" ? (
              <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <PackagePlus className="h-4 w-4 text-fuchsia-300" />
                      <h3 className="text-lg font-semibold text-white">Add course step</h3>
                    </div>
                    <div className="space-y-3">
                      <input
                        className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50"
                        value={newStepTitle}
                        onChange={(event) => setNewStepTitle(event.target.value)}
                        placeholder="Step title"
                      />
                      <textarea
                        className="h-24 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/50"
                        value={newStepDescription}
                        onChange={(event) => setNewStepDescription(event.target.value)}
                        placeholder="Short step description"
                      />
                      <Button
                        className="h-11 w-full rounded-xl border-fuchsia-500/30 bg-fuchsia-500 text-sm font-semibold text-black hover:bg-fuchsia-400 disabled:opacity-50"
                        disabled={!newStepTitle.trim() || createStepMutation.isPending}
                        onClick={() =>
                          createStepMutation.mutate({
                            productId: product.id,
                            title: newStepTitle.trim(),
                            description: newStepDescription.trim() || undefined,
                            sortOrder: courseSteps.length + 1,
                            lockUntilComplete: courseLockSequential,
                            isRequired: true,
                            metadata: {
                              coverImageUrl: "",
                              content: "",
                            },
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add step
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-white">Course steps</h3>
                      <p className="mt-1 text-xs text-zinc-400">
                        Select a step to edit its post-style content and assets.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {courseSteps.map((step, index) => (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => setSelectedStepId(step.id)}
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            selectedStepId === step.id
                              ? "border-emerald-400/50 bg-emerald-400/10"
                              : "border-white/10 bg-black/30 hover:bg-white/5"
                          }`}
                        >
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Step {index + 1}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">{step.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                            {step.description || "No description yet."}
                          </p>
                        </button>
                      ))}
                      {!courseSteps.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
                          No course steps yet.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedCourseStep ? (
                    <>
                      <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                              Step editor
                            </p>
                            <h3 className="mt-1 text-xl font-semibold text-white">
                              {selectedCourseStep.title}
                            </h3>
                          </div>
                          <Button
                            className="h-10 rounded-xl border-red-500/30 bg-red-500/80 px-4 text-xs font-semibold text-black hover:bg-red-400 disabled:opacity-50"
                            disabled={removeStepMutation.isPending}
                            onClick={() =>
                              removeStepMutation.mutate({ stepId: selectedCourseStep.id })
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove step
                          </Button>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                          <div className="space-y-3">
                            <input
                              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-emerald-400/50"
                              value={stepTitle}
                              onChange={(event) => setStepTitle(event.target.value)}
                              placeholder="Step title"
                            />
                            <textarea
                              className="h-24 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-400/50"
                              value={stepDescription}
                              onChange={(event) => setStepDescription(event.target.value)}
                              placeholder="Step description"
                            />
                            <input
                              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-emerald-400/50"
                              value={stepCoverImageUrl}
                              onChange={(event) => setStepCoverImageUrl(event.target.value)}
                              placeholder="Background image URL"
                            />
                            <textarea
                              className="h-56 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-400/50"
                              value={stepBody}
                              onChange={(event) => setStepBody(event.target.value)}
                              placeholder="Long form content for the step. Treat this like a rich article body for now."
                            />
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                                <input
                                  type="checkbox"
                                  checked={stepRequired}
                                  onChange={(event) => setStepRequired(event.target.checked)}
                                />
                                Required step
                              </label>
                              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                                <input
                                  type="checkbox"
                                  checked={stepLocked}
                                  onChange={(event) => setStepLocked(event.target.checked)}
                                />
                                Locked until complete
                              </label>
                            </div>
                            <Button
                              className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                              disabled={!stepTitle.trim() || updateStepMutation.isPending}
                              onClick={() =>
                                updateStepMutation.mutate({
                                  stepId: selectedCourseStep.id,
                                  title: stepTitle.trim(),
                                  description: stepDescription.trim() || null,
                                  isRequired: stepRequired,
                                  lockUntilComplete: stepLocked,
                                  metadata: {
                                    coverImageUrl: stepCoverImageUrl.trim(),
                                    content: stepBody,
                                  },
                                })
                              }
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Save step
                            </Button>
                          </div>

                          <div className="space-y-3">
                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                              Cover preview
                            </p>
                            <div
                              className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-6"
                              style={{
                                backgroundImage: stepCoverImageUrl
                                  ? `linear-gradient(180deg, rgba(2,6,23,0.35), rgba(2,6,23,0.88)), url(${stepCoverImageUrl})`
                                  : "linear-gradient(180deg, rgba(16,185,129,0.18), rgba(2,6,23,0.92))",
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                minHeight: 240,
                              }}
                            >
                              <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">
                                Step hero
                              </p>
                              <h4 className="mt-3 text-2xl font-semibold text-white">
                                {stepTitle || "Untitled step"}
                              </h4>
                              <p className="mt-2 max-w-md text-sm text-zinc-200/85">
                                {stepDescription || "Step summary will appear here."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              Step media and files
                            </h3>
                            <p className="mt-1 text-xs text-zinc-400">
                              Videos, PDFs, images, or files attached directly to this step.
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-400">
                            {selectedStepAssets.length} asset
                            {selectedStepAssets.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                          <div className="space-y-3">
                            <input
                              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                              value={courseAssetTitle}
                              onChange={(event) => setCourseAssetTitle(event.target.value)}
                              placeholder="Asset title"
                            />
                            <input
                              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                              value={courseAssetUrl}
                              onChange={(event) => setCourseAssetUrl(event.target.value)}
                              placeholder="File or video URL"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              {(["VIDEO", "PDF", "FILE", "IMAGE", "LINK"] as ProductAssetType[]).map(
                                (assetType) => (
                                  <button
                                    key={assetType}
                                    type="button"
                                    onClick={() => setCourseAssetType(assetType)}
                                    className={`h-10 rounded-xl border text-xs font-semibold transition ${
                                      courseAssetType === assetType
                                        ? "border-sky-400/50 bg-sky-400/15 text-white"
                                        : "border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
                                    }`}
                                  >
                                    {assetType}
                                  </button>
                                )
                              )}
                            </div>
                            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                              <input
                                type="checkbox"
                                checked={courseAssetDownloadable}
                                onChange={(event) =>
                                  setCourseAssetDownloadable(event.target.checked)
                                }
                              />
                              Members can download this asset
                            </label>
                            <Button
                              className="h-11 w-full rounded-xl border-emerald-500/30 bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                              disabled={
                                !courseAssetTitle.trim() ||
                                !courseAssetUrl.trim() ||
                                createAssetMutation.isPending
                              }
                              onClick={() =>
                                createAssetMutation.mutate({
                                  productId: product.id,
                                  stepId: selectedCourseStep.id,
                                  moduleType: "COURSE",
                                  placement: "STEP",
                                  title: courseAssetTitle.trim(),
                                  url: courseAssetUrl.trim(),
                                  type: courseAssetType,
                                  interactionMode:
                                    courseAssetType === "LINK"
                                      ? "LINK"
                                      : courseAssetDownloadable
                                        ? "DOWNLOAD"
                                        : "OPEN",
                                  isDownloadable: courseAssetDownloadable,
                                  sortOrder: selectedStepAssets.length + 1,
                                })
                              }
                            >
                              Add asset to step
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {selectedStepAssets.map((asset) => (
                              <div
                                key={asset.id}
                                className="rounded-2xl border border-white/10 bg-black/30 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">
                                      [{asset.type}] {asset.title}
                                    </p>
                                    <p className="mt-1 truncate text-xs text-zinc-400">
                                      {asset.url}
                                    </p>
                                  </div>
                                  <Button
                                    className="h-8 rounded-lg border-red-500/30 bg-red-500/80 px-2 text-[11px] font-semibold text-black hover:bg-red-400 disabled:opacity-50"
                                    disabled={removeAssetMutation.isPending}
                                    onClick={() =>
                                      removeAssetMutation.mutate({ assetId: asset.id })
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {!selectedStepAssets.length ? (
                              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
                                No assets attached to this step.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-10 text-center text-zinc-500">
                      Add the first course step to start editing.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {selectedPlugin === "LIBRARY" ? (
              <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <GalleryVertical className="h-4 w-4 text-sky-300" />
                    <h3 className="text-lg font-semibold text-white">Library items</h3>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSelectedGalleryAssetId("")}
                      className={`w-full rounded-2xl border p-3 text-left text-sm transition ${
                        selectedGalleryAssetId === ""
                          ? "border-sky-400/50 bg-sky-400/10 text-white"
                          : "border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
                      }`}
                    >
                      New library item
                    </button>
                    {galleryAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedGalleryAssetId(asset.id)}
                        className={`w-full rounded-2xl border p-3 text-left transition ${
                          selectedGalleryAssetId === asset.id
                            ? "border-sky-400/50 bg-sky-400/10"
                            : "border-white/10 bg-black/30 hover:bg-white/5"
                        }`}
                      >
                        <p className="text-sm font-semibold text-white">{asset.title}</p>
                        <p className="mt-1 text-xs text-zinc-400">{asset.type}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Library editor
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-white">
                        {selectedGalleryAsset ? "Edit library item" : "Create library item"}
                      </h3>
                    </div>
                    {selectedGalleryAsset ? (
                      <Button
                        className="h-10 rounded-xl border-red-500/30 bg-red-500/80 px-4 text-xs font-semibold text-black hover:bg-red-400 disabled:opacity-50"
                        disabled={removeAssetMutation.isPending}
                        onClick={() =>
                          removeAssetMutation.mutate({ assetId: selectedGalleryAsset.id })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    <input
                      className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                      value={galleryAssetTitle}
                      onChange={(event) => setGalleryAssetTitle(event.target.value)}
                      placeholder="Item title"
                    />
                    <textarea
                      className="h-24 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                      value={galleryAssetDescription}
                      onChange={(event) => setGalleryAssetDescription(event.target.value)}
                      placeholder="Description shown in the library item page"
                    />
                    <input
                      className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                      value={galleryAssetUrl}
                      onChange={(event) => setGalleryAssetUrl(event.target.value)}
                      placeholder="Item URL or uploaded file path"
                    />
                    {galleryAssetType === "LINK" ? (
                      <>
                        <input
                          className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                          value={galleryAssetTargetUrl}
                          onChange={(event) => setGalleryAssetTargetUrl(event.target.value)}
                          placeholder="Link destination URL"
                        />
                        <label className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-300">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            _target
                          </span>
                          <select
                            className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                            value={galleryAssetOpenInNewTab ? "_blank" : "_self"}
                            onChange={(event) =>
                              setGalleryAssetOpenInNewTab(event.target.value === "_blank")
                            }
                          >
                            <option value="_self">_self</option>
                            <option value="_blank">_blank</option>
                          </select>
                        </label>
                      </>
                    ) : null}
                    <input
                      ref={libraryFileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,.zip,.json,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      onChange={(event) => void handleLibraryFileUpload(event)}
                    />
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">Upload library files</p>
                          <p className="mt-1 text-xs text-zinc-400">
                            Select one or more files to upload and create library items
                            automatically. Supported: images, MP4/WebM/MOV videos, PDFs, and
                            common office files. Save the product first before uploading.
                          </p>
                        </div>
                        <Button
                          className="h-10 rounded-xl border-white/10 bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                          disabled={!productId || isLibraryUploadPending}
                          onClick={() => libraryFileInputRef.current?.click()}
                        >
                          {isLibraryUploadPending ? "Uploading..." : "Choose files"}
                        </Button>
                      </div>
                      {libraryUploadError ? (
                        <p className="mt-3 text-xs text-rose-300">{libraryUploadError}</p>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["IMAGE", "VIDEO", "PDF", "LINK", "FILE"] as ProductAssetType[]).map(
                        (assetType) => (
                          <button
                            key={assetType}
                            type="button"
                            onClick={() => setGalleryAssetType(assetType)}
                            className={`h-10 rounded-xl border text-xs font-semibold transition ${
                              galleryAssetType === assetType
                                ? "border-sky-400/50 bg-sky-400/15 text-white"
                                : "border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
                            }`}
                          >
                            {assetType}
                          </button>
                        )
                      )}
                    </div>
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={galleryAssetDownloadable}
                        onChange={(event) =>
                          setGalleryAssetDownloadable(event.target.checked)
                        }
                      />
                      Downloadable item
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={galleryAssetShowViews}
                        onChange={(event) =>
                          setGalleryAssetShowViews(event.target.checked)
                        }
                      />
                      Show views on item page
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={galleryAssetShowDownloads}
                        onChange={(event) =>
                          setGalleryAssetShowDownloads(event.target.checked)
                        }
                      />
                      Show downloads on item page
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={galleryAssetShowLikes}
                        onChange={(event) =>
                          setGalleryAssetShowLikes(event.target.checked)
                        }
                      />
                      Show likes on item page
                    </label>
                    <Button
                      className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                      disabled={
                        !galleryAssetTitle.trim() ||
                        !galleryAssetUrl.trim() ||
                        (galleryAssetType === "LINK" && !galleryAssetTargetUrl.trim()) ||
                        isLibraryUploadPending ||
                        createAssetMutation.isPending ||
                        updateAssetMutation.isPending
                      }
                      onClick={() => {
                        if (selectedGalleryAsset) {
                          updateAssetMutation.mutate({
                            assetId: selectedGalleryAsset.id,
                            moduleType: "LIBRARY",
                            placement: "LIBRARY",
                            title: galleryAssetTitle.trim(),
                            description: galleryAssetDescription.trim() || null,
                            url: galleryAssetUrl.trim(),
                            type: galleryAssetType,
                            targetUrl:
                              galleryAssetType === "LINK"
                                ? galleryAssetTargetUrl.trim()
                                : null,
                            openInNewTab:
                              galleryAssetType === "LINK" ? galleryAssetOpenInNewTab : false,
                            interactionMode:
                              galleryAssetType === "LINK"
                                ? "LINK"
                                : galleryAssetDownloadable
                                  ? "DOWNLOAD"
                                  : "OPEN",
                            isDownloadable: galleryAssetDownloadable,
                            metadata: {
                              showViews: galleryAssetShowViews,
                              showDownloads: galleryAssetShowDownloads,
                              showLikes: galleryAssetShowLikes,
                            },
                          });
                          return;
                        }
                        createAssetMutation.mutate({
                          productId: product.id,
                          moduleType: "LIBRARY",
                          placement: "LIBRARY",
                          title: galleryAssetTitle.trim(),
                          description: galleryAssetDescription.trim() || undefined,
                          url: galleryAssetUrl.trim(),
                          type: galleryAssetType,
                          targetUrl:
                            galleryAssetType === "LINK"
                              ? galleryAssetTargetUrl.trim()
                              : undefined,
                          openInNewTab:
                            galleryAssetType === "LINK" ? galleryAssetOpenInNewTab : undefined,
                          interactionMode:
                            galleryAssetType === "LINK"
                              ? "LINK"
                              : galleryAssetDownloadable
                                ? "DOWNLOAD"
                                : "OPEN",
                          isDownloadable: galleryAssetDownloadable,
                          metadata: {
                            showViews: galleryAssetShowViews,
                            showDownloads: galleryAssetShowDownloads,
                            showLikes: galleryAssetShowLikes,
                          },
                          sortOrder: galleryAssets.length + 1,
                        });
                      }}
                    >
                      {selectedGalleryAsset ? "Save library item" : "Create library item"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
