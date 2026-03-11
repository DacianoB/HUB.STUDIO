"use client";

import type { CSSProperties, ChangeEvent } from "react";
import Link from "next/link";
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

import { AdminShell } from "~/app/admin/dashboard/admin-shell";
import {
  LibraryAssetGalleryCard,
  type LibraryAssetCardAsset,
} from "~/app/library/library-asset-card";
import {
  LibraryAssetDetailPanel,
  type InitialAssetData,
} from "~/app/library/library-asset-detail";
import { Button } from "~/components/ui/button";
import {
  clampPassingScore,
  readStepQuestionnaire,
  type StepQuestionnaire,
  type StepQuestionnaireOption,
  type StepQuestionnaireQuestion,
} from "~/lib/step-questionnaire";
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
  questionnaire?: StepQuestionnaire;
};

type LibraryAssetMetadata = {
  showViews?: boolean;
  showDownloads?: boolean;
  showLikes?: boolean;
  sourceLibraryAssetId?: string;
  tags?: string[];
  weight?: number;
};

type ProductEditorProps = {
  mode: ProductEditorMode;
  productId?: string;
};

const LIBRARY_EDITOR_PREVIEW_THEME = {
  "--tenant-bg-main": "#151411",
  "--tenant-bg-secondary": "#1b1916",
  "--tenant-text-main": "#15130f",
  "--tenant-text-secondary": "#6c6252",
  "--tenant-border": "#d6cbbb",
  "--tenant-accent": "#c8a76b",
  "--tenant-button-primary": "#e9e3da",
  "--tenant-button-primary-hover": "#ddd5ca",
  "--tenant-button-text": "#15130f",
  "--tenant-card-bg": "#f4efe5",
  "--tenant-node-radius": "12px",
  "--tenant-node-radius-sm": "10px",
  "--tenant-node-radius-pill": "999px",
} as CSSProperties;

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
const ALL_PRODUCT_MODULES: ProductModuleType[] = ["LIBRARY", "COURSE"];

const DEFAULT_PRODUCT_CURRENCY = "USD";
const DEFAULT_STEP_QUESTION_OPTION_COUNT = 4;
type PricingMode = "FREE" | "PAID";

function readStepMetadata(step: { metadata?: unknown }): StepMetadata {
  if (!step.metadata || typeof step.metadata !== "object") return {};
  const metadata = step.metadata as Record<string, unknown>;
  return {
    coverImageUrl:
      typeof metadata.coverImageUrl === "string" ? metadata.coverImageUrl : undefined,
    content: typeof metadata.content === "string" ? metadata.content : undefined,
    questionnaire: readStepQuestionnaire(metadata.questionnaire),
  };
}

function createQuestionOption(index: number): StepQuestionnaireOption {
  return {
    id: `option-${index + 1}`,
    label: "",
  };
}

function createQuestion(index: number): StepQuestionnaireQuestion {
  return {
    id: `question-${index + 1}`,
    prompt: "",
    options: Array.from({ length: DEFAULT_STEP_QUESTION_OPTION_COUNT }, (_, optionIndex) =>
      createQuestionOption(optionIndex),
    ),
    correctOptionId: "option-1",
  };
}

function normalizeQuestionnaireQuestions(
  questions: StepQuestionnaireQuestion[] | undefined,
) {
  if (!questions?.length) {
    return [createQuestion(0)];
  }

  return questions.map((question, index) => {
    const options = question.options.length
      ? question.options.map((option, optionIndex) => ({
          id: option.id || `option-${optionIndex + 1}`,
          label: option.label ?? "",
        }))
      : Array.from({ length: DEFAULT_STEP_QUESTION_OPTION_COUNT }, (_, optionIndex) =>
          createQuestionOption(optionIndex),
        );
    const correctOptionId = options.some(
      (option) => option.id === question.correctOptionId,
    )
      ? question.correctOptionId
      : options[0]?.id;

    return {
      id: question.id || `question-${index + 1}`,
      prompt: question.prompt ?? "",
      options,
      correctOptionId,
    } satisfies StepQuestionnaireQuestion;
  });
}

function buildStepQuestionnaire(input: {
  enabled: boolean;
  questions: StepQuestionnaireQuestion[];
  passingScore: number;
  successMessage: string;
  failureMessage: string;
}) {
  if (!input.enabled) return undefined;

  const questions = input.questions.reduce<StepQuestionnaireQuestion[]>(
    (accumulator, question, questionIndex) => {
      const prompt = question.prompt.trim();
      const options = question.options
        .map((option, optionIndex) => ({
          id: option.id || `option-${optionIndex + 1}`,
          label: option.label.trim(),
        }))
        .filter((option) => option.label);

      if (!prompt || options.length < 2) {
        return accumulator;
      }

      const correctOptionId = options.some(
        (option) => option.id === question.correctOptionId,
      )
        ? question.correctOptionId
        : options[0]?.id;

      accumulator.push({
        id: question.id || `question-${questionIndex + 1}`,
        prompt,
        options,
        correctOptionId,
      });

      return accumulator;
    },
    [],
  );

  if (!questions.length) return undefined;

  return {
    questions,
    passingScore: clampPassingScore(input.passingScore, questions.length),
    successMessage: input.successMessage.trim() || undefined,
    failureMessage: input.failureMessage.trim() || undefined,
  } satisfies StepQuestionnaire;
}

function readLibraryAssetMetadata(asset: { metadata?: unknown }): LibraryAssetMetadata {
  if (!asset.metadata || typeof asset.metadata !== "object") return {};
  return asset.metadata as LibraryAssetMetadata;
}

function normalizeLibraryTag(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized ? `#${normalized}` : null;
}

function parseLibraryTagsInput(value: string) {
  const candidates = value.match(/#[^\s,;]+|[^\s,;]+/g) ?? [];
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeLibraryTag(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(normalized);
  }

  return tags;
}

function formatLibraryTags(tags: string[] | undefined) {
  return (tags ?? []).join(" ");
}

function readAvailableLibraryTags(assets: Array<{ metadata?: unknown }>) {
  const counts = new Map<string, number>();

  for (const asset of assets) {
    for (const tag of readLibraryAssetMetadata(asset).tags ?? []) {
      const normalized = normalizeLibraryTag(tag);
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => {
      const countDelta = right[1] - left[1];
      if (countDelta !== 0) return countDelta;
      return left[0].localeCompare(right[0]);
    })
    .map(([tag]) => tag);
}

function findLastLibraryTagSeparatorIndex(value: string) {
  return Math.max(
    value.lastIndexOf(" "),
    value.lastIndexOf(","),
    value.lastIndexOf(";"),
    value.lastIndexOf("\n"),
    value.lastIndexOf("\t")
  );
}

function readActiveLibraryTagQuery(value: string) {
  const separatorIndex = findLastLibraryTagSeparatorIndex(value);
  return value.slice(separatorIndex + 1).trim();
}

function applyLibraryTagSuggestion(value: string, suggestion: string) {
  const normalizedSuggestion = normalizeLibraryTag(suggestion);
  if (!normalizedSuggestion) return value;

  const separatorIndex = findLastLibraryTagSeparatorIndex(value);
  const prefix = separatorIndex >= 0 ? value.slice(0, separatorIndex + 1) : "";
  const needsSpace = Boolean(prefix) && !/[\s,;]$/.test(prefix);

  return `${prefix}${needsSpace ? " " : ""}${normalizedSuggestion} `;
}

function readLibraryItemWeight(asset: { metadata?: unknown }) {
  const raw =
    asset.metadata && typeof asset.metadata === "object"
      ? (asset.metadata as Record<string, unknown>).weight
      : undefined;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseLibraryWeightInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatLibraryWeight(value: number | undefined) {
  return Number.isFinite(value ?? NaN) ? String(value ?? 0) : "0";
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

function normalizeCurrencyCode(value: string | null | undefined) {
  const normalized = (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return normalized || DEFAULT_PRODUCT_CURRENCY;
}

function formatPriceInput(priceCents: number | null | undefined) {
  if (priceCents == null) return "";
  return (priceCents / 100).toFixed(2);
}

function parsePriceInputToCents(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "").trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
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

async function uploadProductFile(input: { file: File; productId: string }) {
  const tenantSlug =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
  const formData = new FormData();
  formData.set("file", input.file);
  formData.set("productId", input.productId);

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

  return {
    assetType: result.assetType,
    fileName: result.fileName,
    publicUrl: result.publicUrl,
  };
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

function inferSelectedModulesFromProduct(
  product: {
    galleryOnly?: boolean | null;
    lockSequentialSteps?: boolean | null;
    steps?: Array<unknown>;
    assets?: Array<{
      stepId?: string | null;
      moduleType?: string | null;
      placement?: string | null;
    }>;
    moduleConfigs?: Array<{
      moduleType: ProductModuleType;
      isEnabled: boolean;
    }>;
  },
  enabledTenantModules: Set<ProductModuleType>,
): Record<ProductModuleType, boolean> {
  const byType = new Map(
    (product.moduleConfigs ?? []).map((moduleConfig) => [
      moduleConfig.moduleType,
      moduleConfig,
    ]),
  );

  if (byType.size > 0) {
    return {
      LIBRARY: byType.get("LIBRARY")?.isEnabled ?? false,
      COURSE: byType.get("COURSE")?.isEnabled ?? false,
    };
  }

  const inferred = {
    LIBRARY:
      enabledTenantModules.has("LIBRARY") &&
      (!(product.galleryOnly ?? false) ||
        (product.assets ?? []).some((asset) => readAssetModule(asset) === "LIBRARY")),
    COURSE:
      enabledTenantModules.has("COURSE") &&
      (Boolean(product.lockSequentialSteps) ||
        (product.steps?.length ?? 0) > 0 ||
        (product.assets ?? []).some((asset) => readAssetModule(asset) === "COURSE")),
  };

  if (inferred.LIBRARY || inferred.COURSE) {
    return inferred;
  }

  return {
    LIBRARY: enabledTenantModules.has("LIBRARY"),
    COURSE: enabledTenantModules.has("COURSE"),
  };
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
  const currentTenantQuery = api.tenants.current.useQuery(undefined, {
    retry: false,
  });

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
      setStepQuestionnaireEnabled(false);
      setStepQuestionnaireQuestions([createQuestion(0)]);
      setStepQuestionPassingScore(1);
      setStepQuestionSuccessMessage("");
      setStepQuestionFailureMessage("");
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
      setGalleryAssetTagsInput("");
      setGalleryAssetWeightInput("0");
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
  const [pricingMode, setPricingMode] = useState<PricingMode>("FREE");
  const [priceInput, setPriceInput] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_PRODUCT_CURRENCY);
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
  const [stepQuestionnaireEnabled, setStepQuestionnaireEnabled] = useState(false);
  const [stepQuestionnaireQuestions, setStepQuestionnaireQuestions] = useState<
    StepQuestionnaireQuestion[]
  >(() => [createQuestion(0)]);
  const [stepQuestionPassingScore, setStepQuestionPassingScore] = useState(1);
  const [stepQuestionSuccessMessage, setStepQuestionSuccessMessage] = useState("");
  const [stepQuestionFailureMessage, setStepQuestionFailureMessage] = useState("");

  const [courseAssetTitle, setCourseAssetTitle] = useState("");
  const [courseAssetUrl, setCourseAssetUrl] = useState("");
  const [courseAssetType, setCourseAssetType] = useState<ProductAssetType>("VIDEO");
  const [courseAssetDownloadable, setCourseAssetDownloadable] = useState(false);
  const [courseUploadError, setCourseUploadError] = useState("");
  const [isCourseUploadPending, setIsCourseUploadPending] = useState(false);
  const courseFileInputRef = useRef<HTMLInputElement | null>(null);
  const [backgroundUploadError, setBackgroundUploadError] = useState("");
  const [isBackgroundUploadPending, setIsBackgroundUploadPending] = useState(false);
  const backgroundFileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedGalleryAssetId, setSelectedGalleryAssetId] = useState("");
  const [selectedLibraryAssetForStepId, setSelectedLibraryAssetForStepId] = useState("");
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
  const [galleryAssetTagsInput, setGalleryAssetTagsInput] = useState("");
  const [isGalleryTagsInputFocused, setIsGalleryTagsInputFocused] = useState(false);
  const [galleryAssetWeightInput, setGalleryAssetWeightInput] = useState("0");
  const [libraryUploadError, setLibraryUploadError] = useState("");
  const [isLibraryUploadPending, setIsLibraryUploadPending] = useState(false);
  const libraryFileInputRef = useRef<HTMLInputElement | null>(null);

  const product = productQuery.data;
  const enabledTenantModules = useMemo(
    () => {
      if (!tenantModuleCatalogQuery.data) {
        return new Set(ALL_PRODUCT_MODULES);
      }

      return new Set(
        tenantModuleCatalogQuery.data
          .filter((moduleEntry) => moduleEntry.isEnabled)
          .map((moduleEntry) => moduleEntry.moduleType as ProductModuleType)
      );
    },
    [tenantModuleCatalogQuery.data]
  );

  useEffect(() => {
    if (!product) return;

    setTitle(product.name);
    setSubtitle(product.subtitle ?? "");
    setDescription(product.description ?? "");
    setProductType(product.type as ProductType);
    setPricingMode(product.isFree ? "FREE" : "PAID");
    setPriceInput(formatPriceInput(product.priceCents));
    setCurrency(normalizeCurrencyCode(product.currency));

    const byType = new Map(
      (product.moduleConfigs ?? []).map((moduleConfig) => [
        moduleConfig.moduleType as ProductModuleType,
        moduleConfig,
      ])
    );

    setSelectedModules(inferSelectedModulesFromProduct(product, enabledTenantModules));
    setLibraryAllowDownloads(
      Boolean(
        (byType.get("LIBRARY")?.settings as { allowDownloads?: boolean } | null)
          ?.allowDownloads ?? true
      )
    );
    setCourseLockSequential(product.lockSequentialSteps);
  }, [enabledTenantModules, product]);
  const tenantPolicy = currentTenantQuery.data?.policy;
  const tenantUsage = currentTenantQuery.data?.usage;
  const allowedProductTypes = useMemo(
    () => new Set(tenantPolicy?.allowedProductTypes ?? PRODUCT_TYPES.map(([type]) => type)),
    [tenantPolicy?.allowedProductTypes],
  );
  const productLimitReached =
    !isEditMode &&
    (tenantPolicy?.maxProducts ?? null) !== null &&
    (tenantUsage?.products ?? 0) >= (tenantPolicy?.maxProducts ?? 0);
  const paidProductsAllowed = tenantPolicy?.allowPaidProducts ?? true;
  const downloadsAllowed = tenantPolicy?.allowDownloads ?? true;
  const sequentialCoursesAllowed = tenantPolicy?.allowSequentialCourses ?? true;
  const demoCourseAllowed = tenantPolicy?.allowDemoCourseContent ?? true;
  const productDraftBlocked =
    !allowedProductTypes.has(productType) ||
    (!paidProductsAllowed && pricingMode === "PAID") ||
    (!downloadsAllowed && libraryAllowDownloads) ||
    (!sequentialCoursesAllowed && courseLockSequential) ||
    (!demoCourseAllowed && createDemoCourseContent) ||
    productLimitReached;

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

  useEffect(() => {
    if (allowedProductTypes.has(productType)) return;
    const fallbackType = PRODUCT_TYPES.find(([type]) => allowedProductTypes.has(type))?.[0];
    if (fallbackType) {
      setProductType(fallbackType);
    }
  }, [allowedProductTypes, productType]);

  useEffect(() => {
    if (paidProductsAllowed || pricingMode !== "PAID") return;
    setPricingMode("FREE");
  }, [paidProductsAllowed, pricingMode]);

  useEffect(() => {
    if (downloadsAllowed || !libraryAllowDownloads) return;
    setLibraryAllowDownloads(false);
    setCourseAssetDownloadable(false);
    setGalleryAssetDownloadable(false);
  }, [downloadsAllowed, libraryAllowDownloads]);

  useEffect(() => {
    if (sequentialCoursesAllowed || !courseLockSequential) return;
    setCourseLockSequential(false);
    setStepLocked(false);
  }, [courseLockSequential, sequentialCoursesAllowed]);

  useEffect(() => {
    if (demoCourseAllowed || !createDemoCourseContent) return;
    setCreateDemoCourseContent(false);
  }, [createDemoCourseContent, demoCourseAllowed]);

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
    const questionnaire = metadata.questionnaire;
    setStepTitle(selectedCourseStep.title);
    setStepDescription(selectedCourseStep.description ?? "");
    setStepBody(metadata.content ?? "");
    setStepCoverImageUrl(metadata.coverImageUrl ?? "");
    setStepRequired(selectedCourseStep.isRequired);
    setStepLocked(selectedCourseStep.lockUntilComplete);
    setStepQuestionnaireEnabled(Boolean(questionnaire));
    setStepQuestionnaireQuestions(
      normalizeQuestionnaireQuestions(questionnaire?.questions),
    );
    setStepQuestionPassingScore(
      clampPassingScore(questionnaire?.passingScore, questionnaire?.questions.length ?? 1),
    );
    setStepQuestionSuccessMessage(questionnaire?.successMessage ?? "");
    setStepQuestionFailureMessage(questionnaire?.failureMessage ?? "");
  }, [selectedCourseStep]);

  useEffect(() => {
    setCourseUploadError("");
    setBackgroundUploadError("");
  }, [selectedStepId]);

  const allAssets = useMemo(() => product?.assets ?? [], [product?.assets]);
  const galleryAssets = useMemo(
    () =>
      allAssets
        .filter((asset) => readAssetModule(asset) === "LIBRARY")
        .sort((a, b) => {
          const weightDelta = readLibraryItemWeight(b) - readLibraryItemWeight(a);
          if (weightDelta !== 0) return weightDelta;
          return a.sortOrder - b.sortOrder;
        }),
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
  const selectedLibraryAssetForStep = useMemo(
    () => galleryAssets.find((asset) => asset.id === selectedLibraryAssetForStepId) ?? null,
    [galleryAssets, selectedLibraryAssetForStepId]
  );
  const isFreeProduct = pricingMode === "FREE";
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const parsedPriceCents = useMemo(() => parsePriceInputToCents(priceInput), [priceInput]);
  const isPriceValid =
    isFreeProduct || (parsedPriceCents !== null && parsedPriceCents > 0 && Boolean(normalizedCurrency));
  const parsedGalleryTags = useMemo(
    () => parseLibraryTagsInput(galleryAssetTagsInput),
    [galleryAssetTagsInput]
  );
  const availableGalleryTags = useMemo(
    () => readAvailableLibraryTags(galleryAssets),
    [galleryAssets]
  );
  const activeGalleryTagQuery = useMemo(
    () => readActiveLibraryTagQuery(galleryAssetTagsInput),
    [galleryAssetTagsInput]
  );
  const galleryTagSuggestions = useMemo(() => {
    const normalizedQuery = activeGalleryTagQuery
      ? normalizeLibraryTag(activeGalleryTagQuery)
      : null;
    const selectedTags = new Set(parsedGalleryTags);

    return availableGalleryTags
      .filter((tag) => {
        if (selectedTags.has(tag)) return false;
        if (!normalizedQuery) return true;
        return tag.startsWith(normalizedQuery);
      })
      .slice(0, 8);
  }, [activeGalleryTagQuery, availableGalleryTags, parsedGalleryTags]);
  const parsedGalleryWeight = useMemo(
    () => parseLibraryWeightInput(galleryAssetWeightInput),
    [galleryAssetWeightInput]
  );
  const galleryEditorPreviewAsset = useMemo<InitialAssetData & LibraryAssetCardAsset>(
    () => ({
      id: selectedGalleryAsset?.id ?? "library-editor-preview",
      productId: product?.id ?? productId ?? "library-editor-preview",
      title: galleryAssetTitle,
      description: galleryAssetDescription,
      url: galleryAssetUrl,
      type: galleryAssetType,
      targetUrl: galleryAssetTargetUrl,
      openInNewTab: galleryAssetOpenInNewTab,
      isDownloadable: galleryAssetDownloadable,
      showViews: galleryAssetShowViews,
      showDownloads: galleryAssetShowDownloads,
      showLikes: galleryAssetShowLikes,
      tags: parsedGalleryTags,
      previewUrl:
        selectedGalleryAsset &&
        typeof selectedGalleryAsset.previewUrl === "string" &&
        selectedGalleryAsset.previewUrl.trim()
          ? selectedGalleryAsset.previewUrl
          : null,
      thumbnailUrl:
        selectedGalleryAsset &&
        typeof selectedGalleryAsset.thumbnailUrl === "string" &&
        selectedGalleryAsset.thumbnailUrl.trim()
          ? selectedGalleryAsset.thumbnailUrl
          : null,
      metadata: {
        showViews: galleryAssetShowViews,
        showDownloads: galleryAssetShowDownloads,
        showLikes: galleryAssetShowLikes,
        tags: parsedGalleryTags,
      },
      stats: {
        likes: 0,
        views: 0,
        downloads: 0,
      },
      currentUserLiked: false,
    }),
    [
      product?.id,
      productId,
      galleryAssetDescription,
      galleryAssetDownloadable,
      galleryAssetOpenInNewTab,
      galleryAssetShowDownloads,
      galleryAssetShowLikes,
      galleryAssetShowViews,
      galleryAssetTargetUrl,
      galleryAssetTitle,
      galleryAssetType,
      galleryAssetUrl,
      parsedGalleryTags,
      selectedGalleryAsset,
    ]
  );
  const isStepQuestionnaireValid =
    !stepQuestionnaireEnabled ||
    (stepQuestionnaireQuestions.length > 0 &&
      stepQuestionnaireQuestions.every((question) => {
        const filledOptions = question.options
          .map((option) => option.label.trim())
          .filter(Boolean);

        return (
          Boolean(question.prompt.trim()) &&
          filledOptions.length >= 2 &&
          question.options.some((option) => option.id === question.correctOptionId)
        );
      }) &&
      stepQuestionPassingScore >= 1 &&
      stepQuestionPassingScore <= stepQuestionnaireQuestions.length);

  function updateQuestion(index: number, nextQuestion: StepQuestionnaireQuestion) {
    setStepQuestionnaireQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? nextQuestion : question,
      ),
    );
  }

  function addQuestion() {
    setStepQuestionnaireQuestions((current) => [...current, createQuestion(current.length)]);
    setStepQuestionPassingScore((current) => Math.max(1, current));
  }

  function removeQuestion(index: number) {
    setStepQuestionnaireQuestions((current) => {
      const nextQuestions = current.filter((_, questionIndex) => questionIndex !== index);
      return nextQuestions.length ? nextQuestions : [createQuestion(0)];
    });
  }

  function addQuestionOption(questionIndex: number) {
    const question = stepQuestionnaireQuestions[questionIndex];
    if (!question) return;

    updateQuestion(questionIndex, {
      ...question,
      options: [...question.options, createQuestionOption(question.options.length)],
    });
  }

  function removeQuestionOption(questionIndex: number, optionId: string) {
    const question = stepQuestionnaireQuestions[questionIndex];
    if (!question || question.options.length <= 2) return;

    const nextOptions = question.options.filter((option) => option.id !== optionId);
    updateQuestion(questionIndex, {
      ...question,
      options: nextOptions,
      correctOptionId: nextOptions.some((option) => option.id === question.correctOptionId)
        ? question.correctOptionId
        : nextOptions[0]?.id,
    });
  }

  useEffect(() => {
    setStepQuestionPassingScore((current) =>
      Math.min(
        Math.max(1, current),
        Math.max(1, stepQuestionnaireQuestions.length),
      ),
    );
  }, [stepQuestionnaireQuestions.length]);

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
      setGalleryAssetTagsInput(formatLibraryTags(metadata.tags));
      setGalleryAssetWeightInput(
        formatLibraryWeight(readLibraryItemWeight(selectedGalleryAsset))
      );
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
    setGalleryAssetTagsInput("");
    setGalleryAssetWeightInput("0");
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
      const uploadErrors: string[] = [];
      let createdCount = 0;

      for (const [index, file] of files.entries()) {
        try {
          const result = await uploadProductFile({ file, productId });

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
              tags: parsedGalleryTags,
              weight: 0,
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

  async function handleCourseFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) return;
    if (!productId || !selectedCourseStep) {
      setCourseUploadError("Save the product and select a step before uploading files.");
      return;
    }

    setCourseUploadError("");
    setIsCourseUploadPending(true);

    try {
      const uploadErrors: string[] = [];
      let createdCount = 0;

      for (const [index, file] of files.entries()) {
        try {
          const result = await uploadProductFile({ file, productId });
          const assetTitle = titleFromFileName(result.fileName ?? file.name);
          const isDownloadable =
            result.assetType === "PDF" || result.assetType === "FILE";

          await createAssetMutation.mutateAsync({
            productId,
            stepId: selectedCourseStep.id,
            moduleType: "COURSE",
            placement: "STEP",
            title: assetTitle,
            description: undefined,
            url: result.publicUrl,
            type: result.assetType,
            interactionMode: isDownloadable ? "DOWNLOAD" : "OPEN",
            isDownloadable,
            sortOrder: selectedStepAssets.length + index + 1,
          });

          createdCount += 1;
        } catch (error) {
          uploadErrors.push(
            `${file.name}: ${error instanceof Error ? error.message : "Upload failed."}`,
          );
        }
      }

      if (uploadErrors.length) {
        setCourseUploadError(
          createdCount > 0
            ? `Created ${createdCount} attachment${createdCount === 1 ? "" : "s"}, but some uploads failed. ${uploadErrors.join(" ")}`
            : uploadErrors.join(" "),
        );
      }
    } catch (error) {
      setCourseUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsCourseUploadPending(false);
    }
  }

  async function handleStepBackgroundUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;
    if (!productId || !selectedCourseStep) {
      setBackgroundUploadError("Save the product and select a step before uploading a background.");
      return;
    }

    setBackgroundUploadError("");
    setIsBackgroundUploadPending(true);

    try {
      const result = await uploadProductFile({ file, productId });

      if (result.assetType !== "IMAGE") {
        throw new Error("Step backgrounds must be uploaded as image files.");
      }

      setStepCoverImageUrl(result.publicUrl);
    } catch (error) {
      setBackgroundUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsBackgroundUploadPending(false);
    }
  }

  async function handleAttachLibraryAssetToStep() {
    if (!productId || !selectedCourseStep || !selectedLibraryAssetForStep) return;

    const sourceMetadata =
      selectedLibraryAssetForStep.metadata &&
      typeof selectedLibraryAssetForStep.metadata === "object"
        ? (selectedLibraryAssetForStep.metadata as Record<string, unknown>)
        : {};

    await createAssetMutation.mutateAsync({
      productId,
      stepId: selectedCourseStep.id,
      moduleType: "COURSE",
      placement: "STEP",
      title: selectedLibraryAssetForStep.title,
      description: selectedLibraryAssetForStep.description ?? undefined,
      type: selectedLibraryAssetForStep.type as ProductAssetType,
      url: selectedLibraryAssetForStep.url,
      previewUrl: selectedLibraryAssetForStep.previewUrl ?? undefined,
      thumbnailUrl: selectedLibraryAssetForStep.thumbnailUrl ?? undefined,
      targetUrl: selectedLibraryAssetForStep.targetUrl ?? undefined,
      openInNewTab: selectedLibraryAssetForStep.openInNewTab ?? true,
      mimeType: selectedLibraryAssetForStep.mimeType ?? undefined,
      isDownloadable: selectedLibraryAssetForStep.isDownloadable,
      durationSeconds: selectedLibraryAssetForStep.durationSeconds ?? undefined,
      interactionMode: selectedLibraryAssetForStep.interactionMode,
      metadata: {
        ...sourceMetadata,
        sourceLibraryAssetId: selectedLibraryAssetForStep.id,
      },
      sortOrder: selectedStepAssets.length + 1,
    });

    setSelectedLibraryAssetForStepId("");
  }

  async function handleSaveProduct() {
    if (!isPriceValid) return;

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
        isFree: isFreeProduct,
        priceCents: isFreeProduct ? null : parsedPriceCents,
        currency: normalizedCurrency,
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
      isFree: isFreeProduct,
      priceCents: isFreeProduct ? null : parsedPriceCents,
      isVisible: true,
      currency: normalizedCurrency,
      modules,
      galleryOnly: !selectedModules.LIBRARY,
      lockSequentialSteps: courseLockSequential,
      createDemoCourseContent,
    });
  }

  const productTypeLabel =
    PRODUCT_TYPES.find(([value]) => value === productType)?.[1] ?? productType;
  const activeModuleCount = Object.values(selectedModules).filter(Boolean).length;

  return (
    <AdminShell
      title={isEditMode ? product?.name ?? "Loading product..." : "New product"}
      description="Define pricing, enable modules, and manage the course or library experience in one workspace."
      actions={
        <Button
          className="h-10 rounded-[10px] border border-[#4b412f] bg-[#8d7a56] px-4 text-sm font-semibold text-[#15130f] hover:bg-[#9a8660] disabled:opacity-50"
          disabled={
            !title.trim() ||
            !isPriceValid ||
            productDraftBlocked ||
            createProductMutation.isPending ||
            updateProductMutation.isPending
          }
          onClick={() => void handleSaveProduct()}
        >
          {isEditMode ? "Save product" : "Create and continue"}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-[10px] border border-[#2e2b26] bg-[#1b1916] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/admin/dashboard/products"
              className="inline-flex items-center gap-2 text-[#9f9789] transition hover:text-[#f4efe5]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to products
            </Link>
            <span className="inline-flex items-center rounded-md border border-[#34312b] bg-[#1a1814] px-2.5 py-1 text-xs font-medium text-[#bdb5a7]">
              {isEditMode ? product?.status ?? "Draft" : "New draft"}
            </span>
            <span className="inline-flex items-center rounded-md border border-[#4b412f] bg-[#241f18] px-2.5 py-1 text-xs font-medium text-[#d7c29f]">
              {productTypeLabel}
            </span>
          </div>
          <p className="text-sm text-[#9f9789]">
            {activeModuleCount > 0
              ? `${activeModuleCount} active module${activeModuleCount === 1 ? "" : "s"}`
              : "Enable at least one module to start building"}
          </p>
        </div>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          {productDraftBlocked ? (
            <div className="rounded-[12px] border border-[#51422b] bg-[#2a2114] px-5 py-4 text-sm text-[#dfc28e] xl:col-span-2">
              {productLimitReached
                ? "This tenant is at its configured product limit. Archive an existing product or ask a global admin to raise the cap."
                : "Some product settings are blocked by the current tenant policy. Adjust the disabled options before saving."}
            </div>
          ) : null}
          <div className="rounded-[12px] border border-[#2e2b26] bg-[#1b1916] p-5">
            <div className="mb-4">
              <p className="text-xs font-medium text-[#9f9789]">
                Product basics
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#f4efe5]">
                Identity and structure
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="h-11 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Product title"
              />
              <input
                className="h-11 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                placeholder="Subtitle"
              />
              <textarea
                className="h-28 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56] md:col-span-2"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the promise of this product"
              />
              <div className="rounded-[10px] border border-[#302d28] bg-[#151411] p-4 md:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {([
                    ["FREE", "Free access", "Anyone with the page can open this product."],
                    ["PAID", "Paid product", "This product shows a listed price instead of open access."],
                  ] as Array<[PricingMode, string, string]>).map(([value, label, copy]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        if (value === "PAID" && !paidProductsAllowed) return;
                        setPricingMode(value);
                      }}
                      disabled={value === "PAID" && !paidProductsAllowed}
                      className={`flex-1 rounded-[10px] border px-4 py-3 text-left transition ${
                        pricingMode === value
                          ? "border-[#4b412f] bg-[#241f18] text-[#f4efe5]"
                          : "border-[#37332d] bg-[#11100d] text-[#c1b9ab] hover:bg-[#1d1b17]"
                      }`}
                    >
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="mt-1 text-xs text-[#9f9789]">{copy}</p>
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
                  <label className="grid gap-2 text-xs font-medium text-[#9f9789]">
                    Currency
                    <input
                      className="h-11 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm tracking-[0.24em] text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value.slice(0, 8))}
                      placeholder={DEFAULT_PRODUCT_CURRENCY}
                      maxLength={8}
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-medium text-[#9f9789]">
                    Price
                    <input
                      className={`h-11 rounded-[10px] border bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition ${
                        isFreeProduct
                          ? "border-[#37332d] opacity-50"
                          : parsedPriceCents !== null && parsedPriceCents > 0
                            ? "border-[#37332d] focus:border-[#8d7a56]"
                            : "border-rose-400/40 focus:border-rose-400/60"
                      }`}
                      value={priceInput}
                      onChange={(event) => setPriceInput(event.target.value)}
                      placeholder="99.00"
                      inputMode="decimal"
                      disabled={isFreeProduct}
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="text-[#9f9789]">
                    {isFreeProduct
                      ? "Free products stay open to access."
                      : "Paid products require a positive price."}
                  </p>
                  {!isFreeProduct && !isPriceValid ? (
                    <p className="text-rose-300">Enter a valid price greater than zero.</p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 md:col-span-2">
                {PRODUCT_TYPES.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      if (!allowedProductTypes.has(value)) return;
                      setProductType(value);
                    }}
                    disabled={!allowedProductTypes.has(value)}
                    className={`h-11 rounded-[10px] border px-3 text-sm font-medium transition ${
                      productType === value
                        ? "border-[#4b412f] bg-[#241f18] text-[#f4efe5]"
                        : "border-[#37332d] bg-[#11100d] text-[#c1b9ab] hover:bg-[#1d1b17]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border border-[#2e2b26] bg-[#1b1916] p-5">
            <div className="mb-4">
              <p className="text-xs font-medium text-[#9f9789]">Modules</p>
              <h2 className="mt-1 text-xl font-semibold text-[#f4efe5]">
                Enable what this product includes
              </h2>
            </div>

            <div className="space-y-3">
              {ALL_PRODUCT_MODULES.map(
                (moduleType) => {
                  const config = MODULE_COPY[moduleType];
                  const tenantEnabled = enabledTenantModules.has(moduleType);
                  const Icon = config.icon;
                  return (
                    <label
                      key={moduleType}
                      className={`flex items-start gap-3 rounded-[10px] border p-4 ${
                        tenantEnabled
                          ? "border-[#37332d] bg-[#11100d]"
                          : "border-[#2a2823] bg-[#141310] opacity-50"
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
                          <Icon className="h-4 w-4 text-[#d7c29f]" />
                          <span className="text-sm font-semibold text-[#f4efe5]">
                            {config.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#9f9789]">{config.description}</p>
                      </div>
                    </label>
                  );
                }
              )}
            </div>

            <div className="mt-4 space-y-2 border-t border-[#2a2823] pt-4">
              <label className="flex items-center gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                <input
                  type="checkbox"
                  checked={libraryAllowDownloads}
                  disabled={!downloadsAllowed}
                  onChange={(event) => setLibraryAllowDownloads(event.target.checked)}
                />
                Library items can be marked as downloadable
              </label>
              <label className="flex items-center gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                <input
                  type="checkbox"
                  checked={courseLockSequential}
                  disabled={!sequentialCoursesAllowed}
                  onChange={(event) => setCourseLockSequential(event.target.checked)}
                />
                Course steps unlock sequentially
              </label>
              {!isEditMode ? (
                <label className="flex items-center gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                  <input
                    type="checkbox"
                    checked={createDemoCourseContent}
                    disabled={!demoCourseAllowed}
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
                    className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition ${
                      selectedPlugin === pluginType
                        ? "border-[#4b412f] bg-[#241f18] text-[#f4efe5]"
                        : "border-[#37332d] bg-[#11100d] text-[#c1b9ab] hover:bg-[#1d1b17]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {config.label}
                  </button>
                );
              })}
            </div>

            {!activePlugins.length ? (
              <div className="rounded-[12px] border border-dashed border-[#302d28] bg-[#151411] p-10 text-center text-[#7f786b]">
                Enable at least one plugin to start building the product.
              </div>
            ) : null}

            {selectedPlugin === "COURSE" ? (
              <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                <div className="space-y-4">
                  <div className="rounded-[12px] border border-[#2e2b26] bg-[#1b1916] p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <PackagePlus className="h-4 w-4 text-[#d7c29f]" />
                      <h3 className="text-lg font-semibold text-[#f4efe5]">Add course step</h3>
                    </div>
                    <div className="space-y-3">
                      <input
                        className="h-11 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                        value={newStepTitle}
                        onChange={(event) => setNewStepTitle(event.target.value)}
                        placeholder="Step title"
                      />
                      <textarea
                        className="h-24 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                        value={newStepDescription}
                        onChange={(event) => setNewStepDescription(event.target.value)}
                        placeholder="Short step description"
                      />
                      <Button
                        className="h-11 w-full rounded-[10px] border border-[#4b412f] bg-[#8d7a56] text-sm font-semibold text-[#15130f] hover:bg-[#9a8660] disabled:opacity-50"
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
                              questionnaire: undefined,
                            },
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add step
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[12px] border border-[#2e2b26] bg-[#1b1916] p-5">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-[#f4efe5]">Course steps</h3>
                      <p className="mt-1 text-xs text-[#9f9789]">
                        Select a step to edit its content and assets.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {courseSteps.map((step, index) => (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => setSelectedStepId(step.id)}
                          className={`w-full rounded-[10px] border p-3 text-left transition ${
                            selectedStepId === step.id
                              ? "border-[#4b412f] bg-[#241f18]"
                              : "border-[#37332d] bg-[#11100d] hover:bg-[#1d1b17]"
                          }`}
                        >
                          <p className="text-xs font-medium text-[#9f9789]">
                            Step {index + 1}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#f4efe5]">{step.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-[#9f9789]">
                            {step.description || "No description yet."}
                          </p>
                        </button>
                      ))}
                      {!courseSteps.length ? (
                        <div className="rounded-[10px] border border-dashed border-[#302d28] bg-[#151411] p-4 text-sm text-[#7f786b]">
                          No course steps yet.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedCourseStep ? (
                    <>
                      <input
                        ref={backgroundFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handleStepBackgroundUpload(event)}
                      />
                      <input
                        ref={courseFileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => void handleCourseFileUpload(event)}
                      />
                      <div className="rounded-[12px] border border-[#2e2b26] bg-[#1b1916] p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <p className="text-xs font-medium text-[#9f9789]">
                              Step editor
                            </p>
                            <h3 className="mt-1 text-xl font-semibold text-[#f4efe5]">
                              {selectedCourseStep.title}
                            </h3>
                          </div>
                          <Button
                            className="h-10 rounded-[10px] border border-[#553531] bg-[#4a2b28] px-4 text-xs font-semibold text-[#15130f] hover:bg-[#5a3330] disabled:opacity-50"
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
                              className="h-11 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                              value={stepTitle}
                              onChange={(event) => setStepTitle(event.target.value)}
                              placeholder="Step title"
                            />
                            <textarea
                              className="h-24 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                              value={stepDescription}
                              onChange={(event) => setStepDescription(event.target.value)}
                              placeholder="Step description"
                            />
                            <div className="rounded-[10px] border border-[#302d28] bg-[#151411] p-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-medium text-[#f4efe5]">
                                    Upload step background
                                  </p>
                                  <p className="mt-1 text-xs text-[#9f9789]">
                                    Upload an image and we&apos;ll fill the background URL below.
                                    Save the step after uploading to persist it.
                                  </p>
                                </div>
                                <Button
                                  className="h-10 rounded-[10px] border border-[#37332d] bg-[#1b1916] px-4 text-xs font-semibold text-[#f4efe5] hover:bg-[#23201c] disabled:opacity-50"
                                  disabled={
                                    !productId ||
                                    !selectedCourseStep ||
                                    isBackgroundUploadPending
                                  }
                                  onClick={() => backgroundFileInputRef.current?.click()}
                                >
                                  {isBackgroundUploadPending ? "Uploading..." : "Choose image"}
                                </Button>
                              </div>
                              {backgroundUploadError ? (
                                <p className="mt-3 text-xs text-rose-300">
                                  {backgroundUploadError}
                                </p>
                              ) : null}
                            </div>
                            <input
                              className="h-11 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                              value={stepCoverImageUrl}
                              onChange={(event) => setStepCoverImageUrl(event.target.value)}
                              placeholder="Background image URL"
                            />
                            <textarea
                              className="h-56 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                              value={stepBody}
                              onChange={(event) => setStepBody(event.target.value)}
                              placeholder="Long form content for the step. Treat this like a rich article body for now."
                            />
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="flex items-center gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                                <input
                                  type="checkbox"
                                  checked={stepRequired}
                                  onChange={(event) => setStepRequired(event.target.checked)}
                                />
                                Required step
                              </label>
                              <label className="flex items-center gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                                <input
                                  type="checkbox"
                                  checked={stepLocked}
                                  onChange={(event) => setStepLocked(event.target.checked)}
                                />
                                Locked until complete
                              </label>
                            </div>
                            <div className="rounded-[12px] border border-[#302d28] bg-[#151411] p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-medium text-[#9f9789]">
                                    Completion questionnaire
                                  </p>
                                  <p className="mt-1 text-sm text-[#9f9789]">
                                    Add one quick multiple-choice question before this step can be
                                    marked complete.
                                  </p>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-[#c1b9ab]">
                                  <input
                                    type="checkbox"
                                    checked={stepQuestionnaireEnabled}
                                    onChange={(event) =>
                                      setStepQuestionnaireEnabled(event.target.checked)
                                    }
                                  />
                                  Enable
                                </label>
                              </div>

                              {stepQuestionnaireEnabled ? (
                                <div className="mt-4 space-y-4">
                                  <div className="space-y-3">
                                    {stepQuestionnaireQuestions.map((question, questionIndex) => (
                                      <div
                                        key={`${question.id}-${questionIndex}`}
                                        className="rounded-[10px] border border-[#2e2b26] bg-[#1b1916] p-4"
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <div>
                                            <p className="text-xs font-medium text-[#9f9789]">
                                              Question {questionIndex + 1}
                                            </p>
                                            <p className="mt-1 text-sm text-[#9f9789]">
                                              Add the question and its answer choices.
                                            </p>
                                          </div>
                                          {stepQuestionnaireQuestions.length > 1 ? (
                                            <button
                                              type="button"
                                              onClick={() => removeQuestion(questionIndex)}
                                              className="inline-flex h-9 items-center justify-center rounded-[10px] border border-red-500/30 px-3 text-xs font-semibold text-[#e2a8a1] transition hover:bg-red-500/10"
                                            >
                                              Remove
                                            </button>
                                          ) : null}
                                        </div>

                                        <textarea
                                          className="mt-4 h-24 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                                          value={question.prompt}
                                          onChange={(event) =>
                                            updateQuestion(questionIndex, {
                                              ...question,
                                              prompt: event.target.value,
                                            })
                                          }
                                          placeholder={`Write question ${questionIndex + 1}`}
                                        />

                                        <div className="mt-4 space-y-2">
                                          {question.options.map((option, optionIndex) => (
                                            <div
                                              key={option.id}
                                              className="flex items-center gap-2"
                                            >
                                              <input
                                                className="h-11 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                                                value={option.label}
                                                onChange={(event) =>
                                                  updateQuestion(questionIndex, {
                                                    ...question,
                                                    options: question.options.map((entry) =>
                                                      entry.id === option.id
                                                        ? {
                                                            ...entry,
                                                            label: event.target.value,
                                                          }
                                                        : entry,
                                                    ),
                                                  })
                                                }
                                                placeholder={`Answer ${optionIndex + 1}`}
                                              />
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeQuestionOption(
                                                    questionIndex,
                                                    option.id,
                                                  )
                                                }
                                                disabled={question.options.length <= 2}
                                                className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#37332d] px-3 text-xs font-semibold text-[#c1b9ab] transition hover:bg-[#1d1b17] disabled:cursor-not-allowed disabled:opacity-40"
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          ))}
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                                          <Button
                                            type="button"
                                            className="h-11 rounded-[10px] border border-[#37332d] bg-[#1b1916] px-4 text-sm font-semibold text-[#f4efe5] hover:bg-[#23201c]"
                                            onClick={() => addQuestionOption(questionIndex)}
                                          >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add answer
                                          </Button>
                                          <label className="grid gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                                            <span className="text-xs font-medium text-[#9f9789]">
                                              Correct answer
                                            </span>
                                            <select
                                              className="h-11 rounded-[10px] border border-[#37332d] bg-[#141310] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                                              value={
                                                question.correctOptionId ??
                                                question.options[0]?.id ??
                                                ""
                                              }
                                              onChange={(event) =>
                                                updateQuestion(questionIndex, {
                                                  ...question,
                                                  correctOptionId: event.target.value,
                                                })
                                              }
                                            >
                                              {question.options.map((option, optionIndex) => (
                                                <option key={option.id} value={option.id}>
                                                  Answer {optionIndex + 1}
                                                </option>
                                              ))}
                                            </select>
                                          </label>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <Button
                                    type="button"
                                    className="h-11 rounded-[10px] border border-[#37332d] bg-[#1b1916] px-4 text-sm font-semibold text-[#f4efe5] hover:bg-[#23201c]"
                                    onClick={addQuestion}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add question
                                  </Button>

                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <label className="grid gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                                      <span className="text-xs font-medium text-[#9f9789]">
                                        Pass when correct
                                      </span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={stepQuestionnaireQuestions.length}
                                        className="h-11 rounded-[10px] border border-[#37332d] bg-[#141310] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                                        value={stepQuestionPassingScore}
                                        onChange={(event) =>
                                          setStepQuestionPassingScore(
                                            Number(event.target.value) || 1,
                                          )
                                        }
                                      />
                                    </label>
                                    <input
                                      className="h-11 w-full self-end rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                                      value={stepQuestionSuccessMessage}
                                      onChange={(event) =>
                                        setStepQuestionSuccessMessage(event.target.value)
                                      }
                                      placeholder="Optional pass message"
                                    />
                                    <input
                                      className="h-11 w-full self-end rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                                      value={stepQuestionFailureMessage}
                                      onChange={(event) =>
                                        setStepQuestionFailureMessage(event.target.value)
                                      }
                                      placeholder="Optional fail message"
                                    />
                                  </div>
                                  {!isStepQuestionnaireValid ? (
                                    <p className="text-xs text-amber-300">
                                      Each question needs a prompt, at least two answers, and a
                                      valid correct answer before saving.
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            <Button
                              className="h-11 rounded-[10px] border border-[#4b412f] bg-[#8d7a56] px-4 text-sm font-semibold text-[#15130f] hover:bg-[#9a8660] disabled:opacity-50"
                              disabled={
                                !stepTitle.trim() ||
                                !isStepQuestionnaireValid ||
                                updateStepMutation.isPending
                              }
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
                                    questionnaire: buildStepQuestionnaire({
                                      enabled: stepQuestionnaireEnabled,
                                      questions: stepQuestionnaireQuestions,
                                      passingScore: stepQuestionPassingScore,
                                      successMessage: stepQuestionSuccessMessage,
                                      failureMessage: stepQuestionFailureMessage,
                                    }),
                                  },
                                })
                              }
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Save step
                            </Button>
                          </div>

                          <div className="space-y-3">
                            <p className="text-xs font-medium text-[#9f9789]">
                              Cover preview
                            </p>
                            <div
                              className="relative overflow-hidden rounded-[12px] border border-[#37332d] bg-[#171613] p-6"
                              style={{
                                backgroundImage: stepCoverImageUrl
                                  ? `linear-gradient(180deg, rgba(2,6,23,0.35), rgba(2,6,23,0.88)), url(${stepCoverImageUrl})`
                                  : "linear-gradient(180deg, rgba(16,185,129,0.18), rgba(2,6,23,0.92))",
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                minHeight: 240,
                              }}
                            >
                              <p className="text-xs font-medium text-[#d7c29f]">
                                Step preview
                              </p>
                              <h4 className="mt-3 text-2xl font-semibold text-[#f4efe5]">
                                {stepTitle || "Untitled step"}
                              </h4>
                              <p className="mt-2 max-w-md text-sm text-[#e5dccf]/85">
                                {stepDescription || "Step summary will appear here."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[12px] border border-[#2e2b26] bg-[#1b1916] p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-[#f4efe5]">
                              Step media and files
                            </h3>
                            <p className="mt-1 text-xs text-[#9f9789]">
                              Videos, PDFs, images, or files attached directly to this step.
                            </p>
                          </div>
                          <span className="rounded-md border border-[#37332d] px-3 py-1 text-[11px] text-[#9f9789]">
                            {selectedStepAssets.length} asset
                            {selectedStepAssets.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                          <div className="space-y-3">
                            <div className="rounded-[10px] border border-[#302d28] bg-[#151411] p-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-medium text-[#f4efe5]">
                                    Upload step attachments
                                  </p>
                                  <p className="mt-1 text-xs text-[#9f9789]">
                                    Upload images, videos, PDFs, and files directly into this
                                    step.
                                  </p>
                                </div>
                                <Button
                                  className="h-10 rounded-[10px] border border-[#37332d] bg-[#1b1916] px-4 text-xs font-semibold text-[#f4efe5] hover:bg-[#23201c] disabled:opacity-50"
                                  disabled={
                                    !productId ||
                                    !selectedCourseStep ||
                                    isCourseUploadPending ||
                                    createAssetMutation.isPending
                                  }
                                  onClick={() => courseFileInputRef.current?.click()}
                                >
                                  {isCourseUploadPending ? "Uploading..." : "Choose files"}
                                </Button>
                              </div>
                              {courseUploadError ? (
                                <p className="mt-3 text-xs text-rose-300">{courseUploadError}</p>
                              ) : null}
                            </div>
                            <div className="rounded-[10px] border border-dashed border-[#37332d] bg-[#141310] p-3 text-xs text-[#7f786b]">
                              Keep using the manual fields below for external URLs and links.
                            </div>
                            <div className="rounded-[10px] border border-[#302d28] bg-[#151411] p-3">
                              <p className="text-sm font-medium text-[#f4efe5]">
                                Attach from library
                              </p>
                              <p className="mt-1 text-xs text-[#9f9789]">
                                Reuse an existing library item inside this step without removing
                                it from the library.
                              </p>
                              <select
                                className="mt-3 h-11 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                                value={selectedLibraryAssetForStepId}
                                onChange={(event) =>
                                  setSelectedLibraryAssetForStepId(event.target.value)
                                }
                              >
                                <option value="">Select a library item</option>
                                {galleryAssets.map((asset) => (
                                  <option key={asset.id} value={asset.id}>
                                    {asset.title} ({asset.type})
                                  </option>
                                ))}
                              </select>
                              <Button
                                className="mt-3 h-10 w-full rounded-[10px] border border-[#37332d] bg-[#1b1916] px-4 text-xs font-semibold text-[#f4efe5] hover:bg-[#23201c] disabled:opacity-50"
                                disabled={
                                  !selectedLibraryAssetForStep ||
                                  createAssetMutation.isPending
                                }
                                onClick={() => void handleAttachLibraryAssetToStep()}
                              >
                                Add library item to step
                              </Button>
                            </div>
                            <input
                              className="h-11 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                              value={courseAssetTitle}
                              onChange={(event) => setCourseAssetTitle(event.target.value)}
                              placeholder="Asset title"
                            />
                            <input
                              className="h-11 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
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
                                    className={`h-10 rounded-[10px] border text-xs font-semibold transition ${
                                      courseAssetType === assetType
                                        ? "border-[#4b412f] bg-[#241f18] text-[#f4efe5]"
                                        : "border-[#37332d] bg-[#11100d] text-[#c1b9ab] hover:bg-[#1d1b17]"
                                    }`}
                                  >
                                    {assetType}
                                  </button>
                                )
                              )}
                            </div>
                            <label className="flex items-center gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                              <input
                                type="checkbox"
                                checked={courseAssetDownloadable}
                                disabled={!downloadsAllowed}
                                onChange={(event) =>
                                  setCourseAssetDownloadable(event.target.checked)
                                }
                              />
                              Members can download this asset
                            </label>
                            <Button
                              className="h-11 w-full rounded-[10px] border border-[#4b412f] bg-[#8d7a56] text-sm font-semibold text-[#15130f] hover:bg-[#9a8660] disabled:opacity-50"
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

                          <div className="grid gap-3 sm:grid-cols-2">
                            {selectedStepAssets.map((asset) => (
                              <div
                                key={asset.id}
                                className="overflow-hidden rounded-[10px] border border-[#37332d] bg-[#11100d]"
                              >
                                <div
                                  className="flex h-28 items-end border-b border-[#2a2823] p-3"
                                  style={{
                                    backgroundImage:
                                      asset.type === "IMAGE"
                                        ? `linear-gradient(180deg, rgba(2,6,23,0.06), rgba(2,6,23,0.78)), url(${asset.url})`
                                        : "linear-gradient(135deg, rgba(14,165,233,0.18), rgba(15,23,42,0.92))",
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                  }}
                                >
                                  <span className="rounded-md border border-[#37332d] bg-[#151411] px-2.5 py-1 text-[11px] font-medium tracking-[0.18em] text-[#e5dccf]">
                                    {asset.type}
                                  </span>
                                </div>
                                <div className="p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-[#f4efe5]">
                                        {asset.title}
                                      </p>
                                      <p className="mt-1 line-clamp-2 break-all text-xs text-[#9f9789]">
                                        {asset.url}
                                      </p>
                                    </div>
                                    <Button
                                      className="h-8 rounded-[8px] border border-[#553531] bg-[#4a2b28] px-2 text-[11px] font-semibold text-[#15130f] hover:bg-[#5a3330] disabled:opacity-50"
                                      disabled={removeAssetMutation.isPending}
                                      onClick={() =>
                                        removeAssetMutation.mutate({ assetId: asset.id })
                                      }
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {!selectedStepAssets.length ? (
                              <div className="rounded-[10px] border border-dashed border-[#302d28] bg-[#151411] p-4 text-sm text-[#7f786b]">
                                No assets attached to this step.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-[12px] border border-dashed border-[#302d28] bg-[#151411] p-10 text-center text-[#7f786b]">
                      Add the first course step to start editing.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {selectedPlugin === "LIBRARY" ? (
              <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                <div className="rounded-[12px] border border-[#2e2b26] bg-[#1b1916] p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <GalleryVertical className="h-4 w-4 text-[#d7c29f]" />
                    <h3 className="text-lg font-semibold text-[#f4efe5]">Library items</h3>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSelectedGalleryAssetId("")}
                      className={`w-full rounded-[10px] border p-3 text-left text-sm transition ${
                        selectedGalleryAssetId === ""
                          ? "border-[#4b412f] bg-[#241f18] text-[#f4efe5]"
                          : "border-[#37332d] bg-[#11100d] text-[#c1b9ab] hover:bg-[#1d1b17]"
                      }`}
                    >
                      New library item
                    </button>
                    {galleryAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedGalleryAssetId(asset.id)}
                        className={`w-full rounded-[10px] border p-3 text-left transition ${
                          selectedGalleryAssetId === asset.id
                            ? "border-[#4b412f] bg-[#241f18]"
                            : "border-[#37332d] bg-[#11100d] hover:bg-[#1d1b17]"
                        }`}
                      >
                        <p className="text-sm font-semibold text-[#f4efe5]">{asset.title}</p>
                        <p className="mt-1 text-xs text-[#9f9789]">{asset.type}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[12px] border border-[#2e2b26] bg-[#1b1916] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-[#9f9789]">
                        Library editor
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-[#f4efe5]">
                        {selectedGalleryAsset ? "Edit library item" : "Create library item"}
                      </h3>
                    </div>
                    {selectedGalleryAsset ? (
                      <Button
                        className="h-10 rounded-[10px] border border-[#553531] bg-[#4a2b28] px-4 text-xs font-semibold text-[#15130f] hover:bg-[#5a3330] disabled:opacity-50"
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
                    <div className="rounded-[10px] border border-[#302d28] bg-[#151411] p-4">
                      <div className="mb-3">
                        <p className="text-sm font-medium text-[#f4efe5]">Preview</p>
                        <p className="mt-1 text-xs text-[#9f9789]">
                          Closed card before selection and opened state inside the gallery modal.
                        </p>
                      </div>

                      <div
                        className="grid gap-4 2xl:grid-cols-[280px_minmax(0,1fr)]"
                        style={LIBRARY_EDITOR_PREVIEW_THEME}
                      >
                        <section className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-[#9f9789]">
                            <span>Closed</span>
                            <span>Gallery card</span>
                          </div>
                          <div className="aspect-[4/5]">
                            <LibraryAssetGalleryCard
                              asset={galleryEditorPreviewAsset}
                              className="h-full w-full"
                              interactive={false}
                            />
                          </div>
                        </section>

                        <section className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-[#9f9789]">
                            <span>Opened</span>
                            <span>Gallery modal</span>
                          </div>
                          <div className="min-h-[520px] rounded-[12px]">
                            <LibraryAssetDetailPanel
                              assetId={galleryEditorPreviewAsset.id}
                              backHref=""
                              pageName="Library"
                              inGrid
                              previewMode
                              onBack={() => undefined}
                              initialAsset={galleryEditorPreviewAsset}
                            />
                          </div>
                        </section>
                      </div>
                    </div>
                    <input
                      className="h-11 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                      value={galleryAssetTitle}
                      onChange={(event) => setGalleryAssetTitle(event.target.value)}
                      placeholder="Item title"
                    />
                    <textarea
                      className="h-24 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                      value={galleryAssetDescription}
                      onChange={(event) => setGalleryAssetDescription(event.target.value)}
                      placeholder="Description shown in the library item page"
                    />
                    <label className="grid gap-2 rounded-[10px] border border-[#302d28] bg-[#151411] px-3 py-3 text-sm text-[#c1b9ab]">
                      <span className="text-xs font-medium text-[#9f9789]">
                        Tags
                      </span>
                      <input
                        className="h-11 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                        value={galleryAssetTagsInput}
                        onChange={(event) => setGalleryAssetTagsInput(event.target.value)}
                        onFocus={() => setIsGalleryTagsInputFocused(true)}
                        onBlur={() => setIsGalleryTagsInputFocused(false)}
                        placeholder="#interior #exterior"
                      />
                      <p className="text-xs text-[#9f9789]">
                        Add one or more hashtags separated by spaces, commas, or line breaks.
                      </p>
                      {isGalleryTagsInputFocused && galleryTagSuggestions.length ? (
                        <div className="flex flex-wrap gap-2">
                          {galleryTagSuggestions.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className="rounded-[8px] border border-[#4b412f] bg-[#241f18] px-2 py-1 text-[11px] font-medium text-[#e5dccf] transition hover:bg-[#2c251c]"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() =>
                                setGalleryAssetTagsInput((current) =>
                                  applyLibraryTagSuggestion(current, tag)
                                )
                              }
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {parsedGalleryTags.length ? (
                        <div className="flex flex-wrap gap-2">
                          {parsedGalleryTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-[8px] border border-[#3b362f] bg-[#11100d] px-2 py-1 text-[11px] font-medium text-[#e5dccf]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </label>
                    <label className="grid gap-2 rounded-[10px] border border-[#302d28] bg-[#151411] px-3 py-3 text-sm text-[#c1b9ab]">
                      <span className="text-xs font-medium text-[#9f9789]">
                        Gallery weight
                      </span>
                      <input
                        className="h-11 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                        value={galleryAssetWeightInput}
                        onChange={(event) => setGalleryAssetWeightInput(event.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                      />
                      <p className="text-xs text-[#9f9789]">
                        Higher weight shows first in the gallery. Equal weights keep the saved order.
                      </p>
                    </label>
                    <input
                      className="h-11 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                      value={galleryAssetUrl}
                      onChange={(event) => setGalleryAssetUrl(event.target.value)}
                      placeholder="Item URL or uploaded file path"
                    />
                    {galleryAssetType === "LINK" ? (
                      <>
                        <input
                          className="h-11 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
                          value={galleryAssetTargetUrl}
                          onChange={(event) => setGalleryAssetTargetUrl(event.target.value)}
                          placeholder="Link destination URL"
                        />
                        <label className="grid gap-2 rounded-[10px] border border-[#302d28] bg-[#151411] px-3 py-3 text-sm text-[#c1b9ab]">
                          <span className="text-xs font-medium text-[#9f9789]">
                            _target
                          </span>
                          <select
                            className="h-11 rounded-[10px] border border-[#37332d] bg-[#141310] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56]"
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
                    <div className="rounded-[10px] border border-[#302d28] bg-[#151411] p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#f4efe5]">Upload library files</p>
                          <p className="mt-1 text-xs text-[#9f9789]">
                            Select one or more files to upload and create library items
                            automatically. Supported: images, MP4/WebM/MOV videos, PDFs, and
                            common office files. Save the product first before uploading.
                          </p>
                        </div>
                        <Button
                          className="h-10 rounded-[10px] border border-[#37332d] bg-[#1b1916] px-4 text-xs font-semibold text-[#f4efe5] hover:bg-[#23201c] disabled:opacity-50"
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
                            className={`h-10 rounded-[10px] border text-xs font-semibold transition ${
                              galleryAssetType === assetType
                                ? "border-[#4b412f] bg-[#241f18] text-[#f4efe5]"
                                : "border-[#37332d] bg-[#11100d] text-[#c1b9ab] hover:bg-[#1d1b17]"
                            }`}
                          >
                            {assetType}
                          </button>
                        )
                      )}
                    </div>
                    <label className="flex items-center gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                      <input
                        type="checkbox"
                        checked={galleryAssetDownloadable}
                        disabled={!downloadsAllowed}
                        onChange={(event) =>
                          setGalleryAssetDownloadable(event.target.checked)
                        }
                      />
                      Downloadable item
                    </label>
                    <label className="flex items-center gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                      <input
                        type="checkbox"
                        checked={galleryAssetShowViews}
                        onChange={(event) =>
                          setGalleryAssetShowViews(event.target.checked)
                        }
                      />
                      Show views on item page
                    </label>
                    <label className="flex items-center gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
                      <input
                        type="checkbox"
                        checked={galleryAssetShowDownloads}
                        onChange={(event) =>
                          setGalleryAssetShowDownloads(event.target.checked)
                        }
                      />
                      Show downloads on item page
                    </label>
                    <label className="flex items-center gap-2 rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#c1b9ab]">
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
                      className="h-11 rounded-[10px] border border-[#4b412f] bg-[#8d7a56] px-4 text-sm font-semibold text-[#15130f] hover:bg-[#9a8660] disabled:opacity-50"
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
                              tags: parsedGalleryTags,
                              weight: parsedGalleryWeight,
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
                            tags: parsedGalleryTags,
                            weight: parsedGalleryWeight,
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
    </AdminShell>
  );
}
