import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";

import { createTRPCContext } from "~/server/api/trpc";
import {
  buildUploadPublicUrl,
  buildUploadStorageSegments,
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
  const productId = String(formData.get("productId") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "A file is required." }, { status: 400 });
  }

  if (!productId) {
    return NextResponse.json({ message: "A product id is required." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ message: "The selected file is empty." }, { status: 400 });
  }

  const product = await ctx.db.product.findFirst({
    where: {
      id: productId,
      tenantId: ctx.tenantAccess.tenantId,
    },
    select: {
      id: true,
    },
  });

  if (!product) {
    return NextResponse.json({ message: "Product not found." }, { status: 404 });
  }

  const resolvedType = resolveUploadType({
    fileName: file.name,
    mimeType: file.type,
  });

  if (!resolvedType) {
    return NextResponse.json(
      {
        message:
          "Unsupported file type. Allowed uploads are images, MP4/WebM/MOV videos, PDFs, and common document/archive files.",
      },
      { status: 400 },
    );
  }

  const maxUploadSizeBytes = getMaxUploadSizeBytes(resolvedType.assetType);

  if (file.size > maxUploadSizeBytes) {
    return NextResponse.json(
      {
        message: `File is too large. Maximum size for ${resolvedType.assetType.toLowerCase()} uploads is ${Math.floor(
          maxUploadSizeBytes / (1024 * 1024),
        )}MB.`,
      },
      { status: 400 },
    );
  }

  const uniqueSuffix = randomUUID();
  const storageSegments = buildUploadStorageSegments({
    tenantSlug: ctx.tenantAccess.tenantSlug,
    productId: product.id,
    assetType: resolvedType.assetType,
    fileStem: sanitizeFileStem(file.name),
    extension: resolvedType.extension,
    uniqueSuffix,
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
