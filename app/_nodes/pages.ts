import rawPages from "~/app/pages.json";
import { pagesSchema, type PagesConfig } from "~/app/_nodes/schemas";

export const pagesConfig = pagesSchema.parse(rawPages) as PagesConfig;
