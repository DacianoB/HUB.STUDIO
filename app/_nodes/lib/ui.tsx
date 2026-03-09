"use client";

import type { ReactNode } from "react";

export function DashboardPanel({
  title = "",
  subtitle = "",
  right = null,
  mainColor = "saga-orange",
  secondaryColor = "gray-300",
  backgroundColor = "bg-gradient-to-br from-card to-background",
  children,
  className = "",
}: {
  title?: string;
  color?: string;
  subtitle?: string;
  right?: ReactNode;
  mainColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`${className} group relative flex h-full w-full flex-col rounded-[inherit] border border-border bg-gradient-to-br from-card to-background p-4 text-white transition-all duration-300 ${mainColor ? `text-${mainColor}` : ""} ${secondaryColor ? `text-${secondaryColor}` : ""} ${backgroundColor ? backgroundColor : ""} `}
    >
      <div
        className={`drag-handle margin-auto absolute -top-1 left-0 z-20 h-1.5 w-[50%] translate-x-[50%] cursor-move rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-${mainColor}`}
      />
      <div className="from-${mainColor}/5 pointer-events-none absolute w-[50%] rounded-xl bg-gradient-to-br via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {title && (
        <header className="relative z-10 mb-2 flex items-start justify-between gap-2 border-b border-white/10 pb-2">
          <div>
            <h3
              className={`text-base font-bold tracking-tight text-white md:text-lg`}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground md:text-xs">
                {subtitle}
              </p>
            )}
          </div>
          {right}
        </header>
      )}

      <div className="relative z-10 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

export function DashboardTableContainer({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-auto shadow-inner shadow-black/50">
      {children}
    </div>
  );
}

export function DashboardPager({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-sm">
      <button
        className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-gray-100 transition-colors hover:border-saga-orange/70 hover:bg-saga-orange/20 disabled:opacity-40"
        onClick={onPrev}
        disabled={page <= 0}
      >
        Anterior
      </button>
      <span className="rounded bg-white/15 px-3 py-1 text-gray-100">
        {page + 1}/{totalPages}
      </span>
      <button
        className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-gray-100 transition-colors hover:border-saga-orange/70 hover:bg-saga-orange/20 disabled:opacity-40"
        onClick={onNext}
        disabled={page >= totalPages - 1}
      >
        Proximo
      </button>
    </div>
  );
}
