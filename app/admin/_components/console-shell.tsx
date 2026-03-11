"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

import { cn } from "~/lib/utils";

export type ConsoleNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type ConsoleBreadcrumb = {
  label: string;
  href?: string;
};

type ConsoleShellProps = {
  areaLabel: string;
  homeHref: string;
  title: string;
  description?: string;
  navItems: ConsoleNavItem[];
  children: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: ConsoleBreadcrumb[];
};

export const consoleSurfaceClassName =
  "rounded-[10px] border border-[#2e2b26] bg-[#1b1916]";
export const consoleInsetClassName =
  "rounded-[10px] border border-[#302d28] bg-[#151411]";
export const consoleMutedTextClassName = "text-[#9f9789]";
export const consoleInputClassName =
  "h-10 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56] focus:ring-2 focus:ring-[#8d7a56]/20";
export const consoleSelectClassName = consoleInputClassName;
export const consoleTextareaClassName =
  "min-h-[120px] w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3 py-3 text-sm text-[#f4efe5] outline-none transition focus:border-[#8d7a56] focus:ring-2 focus:ring-[#8d7a56]/20";

export function ConsoleShell({
  areaLabel,
  homeHref,
  title,
  description,
  navItems,
  children,
  actions,
  breadcrumbs,
}: ConsoleShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#121210] text-[#f4efe5]">
      <div className="mx-auto min-h-screen max-w-[1520px] lg:flex">
        <aside className="border-b border-[#2a2823] bg-[#171613] lg:min-h-screen lg:w-[252px] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#24221e] px-5 py-5">
            <Link href={homeHref as any} className="text-base font-semibold text-[#f4efe5]">
              HUB.STUDIO
            </Link>
            <p className="mt-1 text-sm text-[#9f9789]">{areaLabel}</p>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== homeHref && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={cn(
                    "flex min-w-fit items-center gap-3 rounded-[10px] border px-3 py-2.5 text-sm transition lg:min-w-0",
                    isActive
                      ? "border-[#4b412f] bg-[#241f18] text-[#f4efe5]"
                      : "border-transparent text-[#b7b0a4] hover:border-[#2f2b25] hover:bg-[#1d1b17] hover:text-[#f4efe5]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-[#2a2823]">
            <div className="px-5 py-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  {breadcrumbs?.length ? (
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[#9f9789]">
                      {breadcrumbs.map((crumb, index) => (
                        <div key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
                          {crumb.href ? (
                            <Link href={crumb.href as any} className="hover:text-[#f4efe5]">
                              {crumb.label}
                            </Link>
                          ) : (
                            <span>{crumb.label}</span>
                          )}
                          {index < breadcrumbs.length - 1 ? (
                            <ChevronRight className="h-4 w-4 text-[#655f55]" />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <h1 className="text-[30px] font-semibold leading-none tracking-[-0.02em] text-[#f4efe5]">
                    {title}
                  </h1>
                  {description ? (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9f9789]">
                      {description}
                    </p>
                  ) : null}
                </div>

                {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
              </div>
            </div>
          </header>

          <div className="px-5 py-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ConsoleSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(consoleSurfaceClassName, "p-5", className)}>
      <div className="flex flex-col gap-3 border-b border-[#2a2823] pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#f4efe5]">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-[#9f9789]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>

      <div className="pt-5">{children}</div>
    </section>
  );
}

export function ConsoleBadge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const toneClassName =
    tone === "accent"
      ? "border-[#4b412f] bg-[#241f18] text-[#d7c29f]"
      : tone === "success"
        ? "border-[#2d4338] bg-[#18231d] text-[#9ec2ac]"
        : tone === "warning"
          ? "border-[#51422b] bg-[#2a2114] text-[#dfc28e]"
          : tone === "danger"
            ? "border-[#553531] bg-[#2a1816] text-[#e2a8a1]"
            : "border-[#34312b] bg-[#1a1814] text-[#bdb5a7]";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
        toneClassName,
      )}
    >
      {children}
    </span>
  );
}

export function ConsoleEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[10px] border border-dashed border-[#38342d] bg-[#141310] px-4 py-8 text-center">
      <p className="text-sm font-medium text-[#f4efe5]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#9f9789]">{description}</p>
    </div>
  );
}
