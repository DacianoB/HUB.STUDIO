import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";

import { createTRPCContext } from "~/server/api/trpc";
import {
  buildTenantBrandingStorageSegments,
  buildUploadPublicUrl,
  getMaxUploadSizeBytes,
  resolveUploadFilePath,
  resolveUploadType,
  sanitizeFileStem,
} from "~/server/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ctx = await createTRPCContext({ req: request });

  if (!ctx.session?.user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (!ctx.tenantAccess || !["OWNER", "ADMIN", "INSTRUCTOR"].includes(ctx.tenantAccess.role)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "A file is required." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ message: "The selected file is empty." }, { status: 400 });
  }

  const resolvedType = resolveUploadType({
    fileName: file.name,
    mimeType: file.type,
  });

  if (!resolvedType || resolvedType.assetType !== "IMAGE") {
    return NextResponse.json(
      {
        message: "Unsupported logo type. Allowed uploads are JPG, PNG, WEBP, and GIF images.",
      },
      { status: 400 },
    );
  }

  const maxUploadSizeBytes = getMaxUploadSizeBytes("IMAGE");
  if (file.size > maxUploadSizeBytes) {
    return NextResponse.json(
      {
        message: `File is too large. Maximum size for image uploads is ${Math.floor(
          maxUploadSizeBytes / (1024 * 1024),
        )}MB.`,
      },
      { status: 400 },
    );
  }

  const storageSegments = buildTenantBrandingStorageSegments({
    tenantSlug: ctx.tenantAccess.tenantSlug,
    assetType: resolvedType.assetType,
    fileStem: sanitizeFileStem(file.name),
    extension: resolvedType.extension,
    uniqueSuffix: randomUUID(),
  });
  const filePath = resolveUploadFilePath(storageSegments);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    assetType: resolvedType.assetType,
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: resolvedType.mimeType,
    publicUrl: buildUploadPublicUrl(storageSegments),
  });
}
