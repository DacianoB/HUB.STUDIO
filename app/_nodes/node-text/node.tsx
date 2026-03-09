"use client";

import { type CSSProperties } from "react";

import { api } from "~/trpc/react";

type DashboardNodeTextProps = {
  props?: Record<string, unknown>;
};

type TextVariableSource = "none" | "product_name" | "company_name";
type TextAlign = "left" | "center" | "right";

const DEFAULT_TEXT = "Text";
const DEFAULT_FONT_SIZE = 32;
const DEFAULT_FONT_WEIGHT = "700";
const DEFAULT_TEXT_ALIGN: TextAlign = "left";
const DEFAULT_TEXT_COLOR = "#ffffff";

function readText(props?: Record<string, unknown>) {
  return typeof props?.text === "string" && props.text.trim().length > 0
    ? props.text
    : DEFAULT_TEXT;
}

function readVariableSource(props?: Record<string, unknown>): TextVariableSource {
  const value = typeof props?.variableSource === "string" ? props.variableSource : "none";
  if (value === "product_name" || value === "company_name" || value === "none") {
    return value;
  }
  return "none";
}

function readFontSize(props?: Record<string, unknown>) {
  const value = Number(props?.fontSize);
  if (Number.isFinite(value)) {
    return Math.min(120, Math.max(12, value));
  }
  return DEFAULT_FONT_SIZE;
}

function readFontWeight(props?: Record<string, unknown>) {
  const value = typeof props?.fontWeight === "string" ? props.fontWeight : "";
  return value || DEFAULT_FONT_WEIGHT;
}

function readTextAlign(props?: Record<string, unknown>): TextAlign {
  const value = typeof props?.textAlign === "string" ? props.textAlign : "";
  if (value === "left" || value === "center" || value === "right") {
    return value;
  }
  return DEFAULT_TEXT_ALIGN;
}

function readTextColor(props?: Record<string, unknown>) {
  const value = typeof props?.color === "string" ? props.color.trim() : "";
  return value || DEFAULT_TEXT_COLOR;
}

function resolveTemplate(text: string, variableValue?: string) {
  if (!variableValue) return text;
  if (text.includes("{{value}}")) {
    return text.split("{{value}}").join(variableValue);
  }
  return variableValue;
}

export function DashboardNodeText({ props }: DashboardNodeTextProps) {
  const text = readText(props);
  const variableSource = readVariableSource(props);
  const productId =
    typeof props?.productId === "string" && props.productId
      ? props.productId
      : typeof props?.fallbackProductId === "string"
        ? props.fallbackProductId
        : "";
  const fontSize = readFontSize(props);
  const fontWeight = readFontWeight(props);
  const textAlign = readTextAlign(props);
  const color = readTextColor(props);

  const productQuery = api.products.byId.useQuery(
    { productId },
    {
      enabled: variableSource === "product_name" && Boolean(productId),
    }
  );
  const tenantQuery = api.tenants.current.useQuery(undefined, {
    enabled: variableSource === "company_name",
  });

  const variableValue =
    variableSource === "product_name"
      ? productQuery.data?.name
      : variableSource === "company_name"
        ? tenantQuery.data?.tenant?.name
        : undefined;
  const isLoading =
    (variableSource === "product_name" && productQuery.isLoading) ||
    (variableSource === "company_name" && tenantQuery.isLoading);
  const renderedText = resolveTemplate(
    text,
    isLoading ? "Loading..." : variableValue
  );

  const textStyle: CSSProperties = {
    color,
    fontSize: `${fontSize}px`,
    fontWeight,
    lineHeight: 1.08,
    textAlign,
  };

  return (
    <article className="flex h-full items-center rounded-xl border border-white/10 bg-zinc-950/80 p-4">
      <div className="w-full">
        <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          Text Node
        </p>
        <div className="mt-3 break-words text-balance" style={textStyle}>
          {renderedText}
        </div>
        {variableSource !== "none" ? (
          <p className="mt-3 text-xs text-zinc-500">
            Variable: {variableSource === "product_name" ? "product name" : "company name"}
          </p>
        ) : null}
      </div>
    </article>
  );
}
