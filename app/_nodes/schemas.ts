import { z } from "zod";

export interface NodePosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PresetItem {
  i: string;
  type: string;
  props?: Record<string, unknown>;
  position: {
    xs: NodePosition;
    sm: NodePosition;
    lg: NodePosition;
  };
}

export interface Preset {
  name: string;
  description?: string;
  slug: string;
  requiresAuth?: boolean;
  editableByUser?: boolean;
  internalRoute?: boolean;
  indexable?: boolean;
  hidden?: boolean;
  items: PresetItem[];
  children?: Record<string, Preset>;
}

export interface PagesConfig {
  presets: Record<string, Preset>;
}

export const pagesSchema = z.object({
  presets: z.record(z.string(), z.any()),
});

export const DynamicComponentsConfigSchema = z.record(z.string(), z.any());

export function parseWithFallback<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallback: T,
  sourceLabel: string,
): { value: T; warnings: string[] } {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { value: parsed.data, warnings: [] };
  }
  return {
    value: fallback,
    warnings: [
      `[dynamic-grid] Invalid payload from ${sourceLabel}; fallback applied.`,
    ],
  };
}
