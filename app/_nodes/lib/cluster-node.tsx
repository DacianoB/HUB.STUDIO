"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClusterDirection =
  | "grow-right"
  | "grow-left"
  | "grow-down"
  | "grow-up"
  | "around";

export interface ClusterChild {
  key: string;
  type: string;
  props?: Record<string, any>;
  w?: number;
  h?: number;
}

export interface ClusterToggleDetail {
  open: boolean;
  sourceId: string;
  direction: ClusterDirection;
  children: ClusterChild[];
  color?: string;
}

// ---------------------------------------------------------------------------
// Hook – useCluster
// ---------------------------------------------------------------------------

export function useCluster(
  gridItemId: string | undefined,
  direction: ClusterDirection = "grow-right",
  color?: string,
) {
  const [isOpen, setIsOpen] = useState(false);
  const sourceId = gridItemId ?? "cluster";
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const dispatch = useCallback(
    (open: boolean, children: ClusterChild[]) => {
      document.dispatchEvent(
        new CustomEvent<ClusterToggleDetail>("cluster-toggle", {
          detail: {
            open,
            sourceId,
            direction,
            children: open ? children : [],
            color,
          },
        }),
      );
    },
    [sourceId, direction, color],
  );

  const toggle = useCallback(
    (children: ClusterChild[]) => {
      const next = !isOpen;
      setIsOpen(next);
      dispatch(next, children);
    },
    [isOpen, dispatch],
  );

  const refresh = useCallback(
    (children: ClusterChild[]) => {
      if (!isOpen) return;
      dispatch(true, children);
    },
    [isOpen, dispatch],
  );

  const close = useCallback(() => {
    if (!isOpen) return;
    setIsOpen(false);
    dispatch(false, []);
  }, [isOpen, dispatch]);

  // Close children when the anchor component unmounts (deleted, navigated away, etc.)
  useEffect(() => {
    return () => {
      if (isOpenRef.current) {
        document.dispatchEvent(
          new CustomEvent<ClusterToggleDetail>("cluster-toggle", {
            detail: {
              open: false,
              sourceId,
              direction,
              children: [],
              color,
            },
          }),
        );
      }
    };
  }, [sourceId, direction, color]);

  return { isOpen, toggle, refresh, close };
}

// ---------------------------------------------------------------------------
// Presentational wrapper – ClusterAnchor
// ---------------------------------------------------------------------------

interface ClusterAnchorProps {
  icon: string;
  iconOpen?: string;
  label: string;
  badge?: string | number;
  color?: string;
  isOpen: boolean;
  isFetching?: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; glow: string; hoverBorder: string; hoverBg: string }> = {
  emerald: {
    border: "border-emerald-500/60",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    hoverBorder: "hover:border-emerald-500/30",
    hoverBg: "hover:bg-emerald-500/5",
  },
  amber: {
    border: "border-amber-500/60",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    hoverBorder: "hover:border-amber-500/30",
    hoverBg: "hover:bg-amber-500/5",
  },
  violet: {
    border: "border-violet-500/60",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)]",
    hoverBorder: "hover:border-violet-500/30",
    hoverBg: "hover:bg-violet-500/5",
  },
  cyan: {
    border: "border-cyan-500/60",
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
    hoverBorder: "hover:border-cyan-500/30",
    hoverBg: "hover:bg-cyan-500/5",
  },
  rose: {
    border: "border-rose-500/60",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)]",
    hoverBorder: "hover:border-rose-500/30",
    hoverBg: "hover:bg-rose-500/5",
  },
};

export function ClusterAnchor({
  icon,
  iconOpen,
  label,
  badge,
  color = "emerald",
  isOpen,
  isFetching,
  onToggle,
}: ClusterAnchorProps) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.emerald!;

  return (
    <div className="flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2">
      <button
        onClick={onToggle}
        className={`group relative flex w-full flex-1 items-center justify-center rounded-xl border-2 transition-all duration-300 ${
          isOpen
            ? `${c.border} ${c.bg} ${c.glow}`
            : `border-[hsl(var(--border))] bg-[hsl(var(--background))] ${c.hoverBorder} ${c.hoverBg}`
        }`}
      >
        {isFetching ? (
          <Icon
            icon="gg:spinner"
            className={`h-8 w-8 animate-spin ${c.text} duration-1000`}
          />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Icon
              icon={isOpen ? (iconOpen ?? icon) : icon}
              className={`h-10 w-10 transition-all duration-300 ${
                isOpen
                  ? c.text
                  : `text-muted-foreground group-hover:${c.text}`
              }`}
            />
            <span className="font-mono text-[0.65rem] font-bold text-muted-foreground">
              {label}
              {badge !== undefined && badge !== "" ? ` ${badge}` : ""}
            </span>
          </div>
        )}
      </button>

      <div
        className={`mt-1 flex w-full items-center justify-center rounded-lg px-2 py-1 text-center font-mono text-[0.6rem] font-bold uppercase tracking-wider transition-colors ${
          isOpen ? c.text : "text-muted-foreground"
        }`}
      >
        {isOpen ? "Fechar" : "Abrir"}
      </div>
    </div>
  );
}
