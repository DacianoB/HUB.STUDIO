"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface ClusterLink {
  sourceId: string;
  childIds: string[];
  color?: string;
}

interface Point {
  x: number;
  y: number;
}

interface ConnectorLine {
  key: string;
  from: Point;
  to: Point;
  color: string;
}

function areLinesEqual(a: ConnectorLine[], b: ConnectorLine[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (left.key !== right.key) return false;
    if (left.color !== right.color) return false;
    if (left.from.x !== right.from.x || left.from.y !== right.from.y) return false;
    if (left.to.x !== right.to.x || left.to.y !== right.to.y) return false;
  }
  return true;
}

function getCenter(el: HTMLElement, container: HTMLElement): Point | null {
  const elRect = el.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();
  if (elRect.width === 0 && elRect.height === 0) return null;
  return {
    x: elRect.left - cRect.left + elRect.width / 2,
    y: elRect.top - cRect.top + elRect.height / 2,
  };
}

const DEFAULT_COLOR = "rgba(16,185,129,0.35)";

const COLOR_CSS: Record<string, string> = {
  emerald: "rgba(16,185,129,0.35)",
  amber: "rgba(245,158,11,0.35)",
  violet: "rgba(139,92,246,0.35)",
  cyan: "rgba(6,182,212,0.35)",
  rose: "rgba(244,63,94,0.35)",
};

export function ClusterConnectors({
  links,
  containerRef,
}: {
  links: ClusterLink[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [lines, setLines] = useState<ConnectorLine[]>([]);
  const rafRef = useRef(0);

  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container || links.length === 0) {
      setLines((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const next: ConnectorLine[] = [];

    for (const link of links) {
      const sourceEl = container.querySelector(
        `[data-grid-id="${link.sourceId}"]`,
      ) as HTMLElement | null;
      if (!sourceEl) continue;
      const from = getCenter(sourceEl, container);
      if (!from) continue;

      const cssColor = COLOR_CSS[link.color ?? ""] ?? DEFAULT_COLOR;

      for (const childId of link.childIds) {
        const childEl = container.querySelector(
          `[data-grid-id="${childId}"]`,
        ) as HTMLElement | null;
        if (!childEl) continue;
        const to = getCenter(childEl, container);
        if (!to) continue;

        next.push({
          key: `${link.sourceId}→${childId}`,
          from,
          to,
          color: cssColor,
        });
      }
    }

    setLines((prev) => (areLinesEqual(prev, next) ? prev : next));
  }, [links, containerRef]);

  useEffect(() => {
    recalc();

    const container = containerRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recalc);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    const resizeObs = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recalc);
    });
    resizeObs.observe(container);

    return () => {
      observer.disconnect();
      resizeObs.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [recalc, containerRef]);

  if (lines.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible"
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <defs>
        <filter id="cluster-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* {lines.map((line) => (
        <line
          key={line.key}
          x1={line.from.x}
          y1={line.from.y}
          x2={line.to.x}
          y2={line.to.y}
          stroke={line.color}
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinecap="round"
          filter="url(#cluster-glow)"
          className="animate-pulse"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="20"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </line>
      ))} */}
    </svg>
  );
}
