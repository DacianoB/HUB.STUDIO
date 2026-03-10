'use client';

import { type CSSProperties } from 'react';

import { api } from '~/trpc/react';

type DashboardNodeTextProps = {
  props?: Record<string, unknown>;
};

type TextVariableSource = 'none' | 'product_name' | 'company_name';
type TextVariableTarget = 'title' | 'subtitle' | 'both';
type TextAlign = 'left' | 'center' | 'right';

const DEFAULT_TITLE = 'Text';
const DEFAULT_SUBTITLE = '';
const DEFAULT_TITLE_FONT_SIZE = 32;
const DEFAULT_TITLE_FONT_WEIGHT = '700';
const DEFAULT_SUBTITLE_FONT_SIZE = 16;
const DEFAULT_SUBTITLE_FONT_WEIGHT = '400';
const DEFAULT_TEXT_ALIGN: TextAlign = 'left';
const DEFAULT_TITLE_COLOR = '#ffffff';
const DEFAULT_SUBTITLE_COLOR = '#d4d4d8';
const DEFAULT_VARIABLE_TARGET: TextVariableTarget = 'title';

function readTitle(props?: Record<string, unknown>) {
  if (typeof props?.title === 'string' && props.title.trim().length > 0) {
    return props.title;
  }
  return typeof props?.text === 'string' && props.text.trim().length > 0
    ? props.text
    : DEFAULT_TITLE;
}

function readSubtitle(props?: Record<string, unknown>) {
  return typeof props?.subtitle === 'string'
    ? props.subtitle
    : DEFAULT_SUBTITLE;
}

function readVariableSource(
  props?: Record<string, unknown>
): TextVariableSource {
  const value =
    typeof props?.variableSource === 'string' ? props.variableSource : 'none';
  if (
    value === 'product_name' ||
    value === 'company_name' ||
    value === 'none'
  ) {
    return value;
  }
  return 'none';
}

function readVariableTarget(
  props?: Record<string, unknown>
): TextVariableTarget {
  const value =
    typeof props?.variableTarget === 'string' ? props.variableTarget : 'title';
  if (value === 'title' || value === 'subtitle' || value === 'both') {
    return value;
  }
  return DEFAULT_VARIABLE_TARGET;
}

function readTitleFontSize(props?: Record<string, unknown>) {
  const value = Number(props?.titleFontSize ?? props?.fontSize);
  if (Number.isFinite(value)) {
    return Math.min(120, Math.max(12, value));
  }
  return DEFAULT_TITLE_FONT_SIZE;
}

function readTitleFontWeight(props?: Record<string, unknown>) {
  const value =
    typeof props?.titleFontWeight === 'string'
      ? props.titleFontWeight
      : typeof props?.fontWeight === 'string'
        ? props.fontWeight
        : '';
  return value || DEFAULT_TITLE_FONT_WEIGHT;
}

function readSubtitleFontSize(props?: Record<string, unknown>) {
  const value = Number(props?.subtitleFontSize);
  if (Number.isFinite(value)) {
    return Math.min(72, Math.max(12, value));
  }
  return DEFAULT_SUBTITLE_FONT_SIZE;
}

function readSubtitleFontWeight(props?: Record<string, unknown>) {
  const value =
    typeof props?.subtitleFontWeight === 'string'
      ? props.subtitleFontWeight
      : '';
  return value || DEFAULT_SUBTITLE_FONT_WEIGHT;
}

function readTextAlign(props?: Record<string, unknown>): TextAlign {
  const value = typeof props?.textAlign === 'string' ? props.textAlign : '';
  if (value === 'left' || value === 'center' || value === 'right') {
    return value;
  }
  return DEFAULT_TEXT_ALIGN;
}

function readTitleColor(props?: Record<string, unknown>) {
  const value =
    typeof props?.titleColor === 'string'
      ? props.titleColor.trim()
      : typeof props?.color === 'string'
        ? props.color.trim()
        : '';
  return value || DEFAULT_TITLE_COLOR;
}

function readSubtitleColor(props?: Record<string, unknown>) {
  const value =
    typeof props?.subtitleColor === 'string' ? props.subtitleColor.trim() : '';
  return value || DEFAULT_SUBTITLE_COLOR;
}

function resolveTemplate(text: string, variableValue?: string) {
  if (!variableValue) return text;
  if (text.includes('{{value}}')) {
    return text.split('{{value}}').join(variableValue);
  }
  return variableValue;
}

export function DashboardNodeText({ props }: DashboardNodeTextProps) {
  const title = readTitle(props);
  const subtitle = readSubtitle(props);
  const variableSource = readVariableSource(props);
  const variableTarget = readVariableTarget(props);
  const productId =
    typeof props?.productId === 'string' && props.productId
      ? props.productId
      : typeof props?.fallbackProductId === 'string'
        ? props.fallbackProductId
        : '';
  const titleFontSize = readTitleFontSize(props);
  const titleFontWeight = readTitleFontWeight(props);
  const subtitleFontSize = readSubtitleFontSize(props);
  const subtitleFontWeight = readSubtitleFontWeight(props);
  const textAlign = readTextAlign(props);
  const titleColor = readTitleColor(props);
  const subtitleColor = readSubtitleColor(props);

  const productQuery = api.products.byId.useQuery(
    { productId },
    {
      enabled: variableSource === 'product_name' && Boolean(productId)
    }
  );
  const tenantQuery = api.tenants.current.useQuery(undefined, {
    enabled: variableSource === 'company_name'
  });

  const variableValue =
    variableSource === 'product_name'
      ? productQuery.data?.name
      : variableSource === 'company_name'
        ? tenantQuery.data?.tenant?.name
        : undefined;
  const isLoading =
    (variableSource === 'product_name' && productQuery.isLoading) ||
    (variableSource === 'company_name' && tenantQuery.isLoading);
  const resolvedVariable = isLoading ? 'Loading...' : variableValue;
  const injectTitle =
    variableSource !== 'none' &&
    (variableTarget === 'title' || variableTarget === 'both');
  const injectSubtitle =
    variableSource !== 'none' &&
    (variableTarget === 'subtitle' || variableTarget === 'both');
  const renderedTitle = injectTitle
    ? resolveTemplate(title, resolvedVariable)
    : title;
  const renderedSubtitle = injectSubtitle
    ? resolveTemplate(subtitle, resolvedVariable)
    : subtitle;

  const titleStyle: CSSProperties = {
    color: titleColor,
    fontSize: `${titleFontSize}px`,
    fontWeight: titleFontWeight,
    lineHeight: 1.08,
    textAlign
  };
  const subtitleStyle: CSSProperties = {
    color: subtitleColor,
    fontSize: `${subtitleFontSize}px`,
    fontWeight: subtitleFontWeight,
    lineHeight: 1.45,
    textAlign
  };

  return (
    <article className="p-6">
      <div className="flex h-full w-full flex-col justify-center gap-2">
        <div className="break-words text-balance" style={titleStyle}>
          {renderedTitle}
        </div>
        {renderedSubtitle ? (
          <p
            className="break-words font-mono text-balance"
            style={subtitleStyle}
          >
            {renderedSubtitle}
          </p>
        ) : null}
      </div>
    </article>
  );
}
