import path from "node:path";

export type UploadAssetType = "VIDEO" | "PDF" | "FILE" | "IMAGE";

const DEFAULT_UPLOAD_STORAGE_DIR = path.join("app", "public", "uploads");
const INTERNAL_UPLOAD_PREFIX = "/uploads/";

const mimeRules = [
  {
    assetType: "IMAGE" as const,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
    preferredExtensionByMime: {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
    } as Record<string, string>,
  },
  {
    assetType: "VIDEO" as const,
    mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
    extensions: [".mp4", ".webm", ".mov"],
    preferredExtensionByMime: {
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "video/quicktime": ".mov",
    } as Record<string, string>,
  },
  {
    assetType: "PDF" as const,
    mimeTypes: ["application/pdf"],
    extensions: [".pdf"],
    preferredExtensionByMime: {
      "application/pdf": ".pdf",
    } as Record<string, string>,
  },
  {
    assetType: "FILE" as const,
    mimeTypes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/json",
      "text/plain",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/octet-stream",
    ],
    extensions: [
      ".zip",
      ".json",
      ".txt",
      ".csv",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
    ],
    preferredExtensionByMime: {
      "application/zip": ".zip",
      "application/x-zip-compressed": ".zip",
      "application/json": ".json",
      "text/plain": ".txt",
      "text/csv": ".csv",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
      "application/vnd.ms-excel": ".xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
      "application/vnd.ms-powerpoint": ".ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
      "application/octet-stream": ".bin",
    } as Record<string, string>,
  },
] as const;

const contentTypeByExtension: Record<string, string> = {
  ".bin": "application/octet-stream",
  ".csv": "text/csv; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain; charset=utf-8",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

const DEFAULT_MAX_UPLOAD_SIZE_MB: Record<UploadAssetType, number> = {
  IMAGE: 25,
  VIDEO: 500,
  PDF: 100,
  FILE: 100,
};

function readUploadSizeMbEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  return parsed;
}

export function getMaxUploadSizeBytes(assetType: UploadAssetType) {
  const sizeMbByType: Record<UploadAssetType, number> = {
    IMAGE: readUploadSizeMbEnv("UPLOAD_MAX_IMAGE_SIZE_MB", DEFAULT_MAX_UPLOAD_SIZE_MB.IMAGE),
    VIDEO: readUploadSizeMbEnv("UPLOAD_MAX_VIDEO_SIZE_MB", DEFAULT_MAX_UPLOAD_SIZE_MB.VIDEO),
    PDF: readUploadSizeMbEnv("UPLOAD_MAX_PDF_SIZE_MB", DEFAULT_MAX_UPLOAD_SIZE_MB.PDF),
    FILE: readUploadSizeMbEnv("UPLOAD_MAX_FILE_SIZE_MB", DEFAULT_MAX_UPLOAD_SIZE_MB.FILE),
  };

  return sizeMbByType[assetType] * 1024 * 1024;
}

export function getUploadRootDir() {
  const configured = process.env.UPLOAD_STORAGE_DIR?.trim();
  const relativePath = configured || DEFAULT_UPLOAD_STORAGE_DIR;
  return path.resolve(process.cwd(), relativePath);
}

export function sanitizePathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "file";
}

function normalizeStorageSegment(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(normalized)) {
    throw new Error("Invalid upload path segment.");
  }
  return normalized;
}

export function sanitizeFileStem(value: string) {
  const stem = value
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return (stem || "file").slice(0, 80);
}

export function resolveUploadType(input: { fileName: string; mimeType?: string | null }) {
  const normalizedMime = input.mimeType?.toLowerCase().trim() || "";
  const extension = path.extname(input.fileName).toLowerCase();
  const normalizedMimeList = mimeRules.map((entry) => entry.mimeTypes as readonly string[]);
  const normalizedExtensionList = mimeRules.map((entry) => entry.extensions as readonly string[]);

  const rule =
    mimeRules.find(
      (entry, index) => normalizedMime && normalizedMimeList[index]?.includes(normalizedMime),
    ) ??
    mimeRules.find((entry, index) => normalizedExtensionList[index]?.includes(extension));

  if (!rule) {
    return null;
  }

  const normalizedExtension =
    (normalizedMime && rule.preferredExtensionByMime[normalizedMime]) ||
    ((rule.extensions as readonly string[]).includes(extension) ? extension : "") ||
    rule.preferredExtensionByMime[rule.mimeTypes[0]] ||
    ".bin";

  return {
    assetType: rule.assetType,
    extension: normalizedExtension,
    mimeType: normalizedMime || contentTypeByExtension[normalizedExtension] || null,
  };
}

export function buildUploadStorageSegments(input: {
  tenantSlug: string;
  productId: string;
  assetType: UploadAssetType;
  fileStem: string;
  extension: string;
  uniqueSuffix: string;
}) {
  return [
    sanitizePathSegment(input.tenantSlug),
    sanitizePathSegment(input.productId),
    input.assetType.toLowerCase(),
    `${input.uniqueSuffix}-${sanitizeFileStem(input.fileStem)}${input.extension}`,
  ];
}

export function buildTenantBrandingStorageSegments(input: {
  tenantSlug: string;
  assetType: UploadAssetType;
  fileStem: string;
  extension: string;
  uniqueSuffix: string;
}) {
  return [
    sanitizePathSegment(input.tenantSlug),
    "tenant-branding",
    input.assetType.toLowerCase(),
    `${input.uniqueSuffix}-${sanitizeFileStem(input.fileStem)}${input.extension}`,
  ];
}

export function buildUploadPublicUrl(segments: string[]) {
  const encoded = segments.map((segment) => encodeURIComponent(segment)).join("/");
  return `${INTERNAL_UPLOAD_PREFIX}${encoded}`;
}

export function resolveUploadFilePath(segments: string[]) {
  const root = getUploadRootDir();
  const normalizedSegments = segments.map(normalizeStorageSegment);
  const candidate = path.resolve(root, ...normalizedSegments);
  const relativePath = path.relative(root, candidate);

  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Unsafe upload path.");
  }

  return candidate;
}

export function readUploadContentType(filePath: string) {
  return contentTypeByExtension[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

export function isSupportedAssetUrl(value: string) {
  if (value.startsWith(INTERNAL_UPLOAD_PREFIX)) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
