import { z } from "zod";

import { createTRPCRouter, tenantAdminProcedure } from "~/server/api/trpc";

const uploadTypeSchema = z.enum(["VIDEO", "PDF", "FILE", "IMAGE"]);

function safeFileName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");
}

export const uploadsRouter = createTRPCRouter({
  createDummyUpload: tenantAdminProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(180),
        uploadType: uploadTypeSchema,
        mimeType: z.string().max(120).optional(),
        fileSizeBytes: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = Date.now();
      const folder = input.uploadType.toLowerCase();
      const finalName = safeFileName(input.fileName);
      const baseUrl = `https://dummy-upload.hub.studio/${ctx.tenantId}/${folder}`;

      return {
        provider: "dummy-upload-service",
        uploadUrl: `${baseUrl}/upload/${now}-${finalName}`,
        publicUrl: `${baseUrl}/${now}-${finalName}`,
        mimeType: input.mimeType ?? null,
        fileSizeBytes: input.fileSizeBytes ?? null,
      };
    }),
});
