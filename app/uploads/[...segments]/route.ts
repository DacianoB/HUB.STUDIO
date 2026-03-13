import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";

import { readUploadContentType, resolveUploadFilePath } from "~/server/uploads";

export const runtime = "nodejs";

type UploadRouteContext = {
  params: Promise<{
    segments: string[];
  }>;
};

function parseRangeHeader(
  rangeHeader: string | null,
  fileSize: number,
): { start: number; end: number } | null {
  if (!rangeHeader) return null;

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    throw new Error("Invalid range.");
  }

  const [, startText, endText] = match;
  if (!startText && !endText) {
    throw new Error("Invalid range.");
  }

  if (!startText) {
    const suffixLength = Number.parseInt(endText ?? "", 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      throw new Error("Invalid range.");
    }

    return {
      start: Math.max(fileSize - suffixLength, 0),
      end: fileSize - 1,
    };
  }

  const start = Number.parseInt(startText, 10);
  const requestedEnd = endText ? Number.parseInt(endText, 10) : fileSize - 1;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(requestedEnd) ||
    start < 0 ||
    start >= fileSize ||
    requestedEnd < start
  ) {
    throw new Error("Invalid range.");
  }

  return {
    start,
    end: Math.min(requestedEnd, fileSize - 1),
  };
}

function toWebReadableStream(
  filePath: string,
  start: number,
  end: number,
): ReadableStream<Uint8Array> {
  const stream = createReadStream(filePath, { start, end });

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const cleanup = () => {
        stream.removeAllListeners("data");
        stream.removeAllListeners("end");
        stream.removeAllListeners("error");
        stream.removeAllListeners("close");
      };

      const closeController = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // The response may already be closed if the client disconnected.
        }
      };

      stream.on("data", (chunk: Buffer) => {
        if (closed) return;
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          closed = true;
          cleanup();
          stream.destroy();
        }
      });

      stream.on("end", closeController);
      stream.on("close", closeController);
      stream.on("error", (error) => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.error(error);
        } catch {
          stream.destroy();
        }
      });
    },
    cancel() {
      stream.destroy();
    },
  });
}

export async function GET(request: Request, context: UploadRouteContext) {
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
    const totalSize = fileStats.size;
    const range = parseRangeHeader(request.headers.get("range"), totalSize);
    const start = range?.start ?? 0;
    const end = range?.end ?? Math.max(totalSize - 1, 0);
    const contentLength = Math.max(end - start + 1, 0);
    const stream = toWebReadableStream(filePath, start, end);

    return new NextResponse(stream, {
      status: range ? 206 : 200,
      headers: {
        "accept-ranges": "bytes",
        "cache-control": "public, max-age=31536000, immutable",
        "content-length": String(contentLength),
        "content-type": readUploadContentType(filePath),
        ...(range
          ? {
              "content-range": `bytes ${start}-${end}/${totalSize}`,
            }
          : {}),
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid range.") {
      try {
        const fileStats = await stat(filePath);
        return new NextResponse(null, {
          status: 416,
          headers: {
            "content-range": `bytes */${fileStats.size}`,
          },
        });
      } catch {
        return NextResponse.json({ message: "File not found." }, { status: 404 });
      }
    }

    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }
}
