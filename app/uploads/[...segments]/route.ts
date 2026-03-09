import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { readUploadContentType, resolveUploadFilePath } from "~/server/uploads";

export const runtime = "nodejs";

type UploadRouteContext = {
  params: Promise<{
    segments: string[];
  }>;
};

export async function GET(_request: Request, context: UploadRouteContext) {
  const { segments } = await context.params;

  if (!Array.isArray(segments) || segments.length === 0) {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }

  let filePath: string;

  try {
    filePath = resolveUploadFilePath(segments);
  } catch {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }

  try {
    const fileStats = await stat(filePath);
    const stream = createReadStream(filePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-length": String(fileStats.size),
        "content-type": readUploadContentType(filePath),
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }
}
