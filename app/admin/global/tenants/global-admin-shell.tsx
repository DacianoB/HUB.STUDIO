"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ShieldCheck } from "lucide-react";

type GlobalAdminShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

const NAV_ITEMS = [
  {
    href: "/admin/global/tenants",
    label: "Tenants",
    icon: Building2,
  },
] as const;

export function GlobalAdminShell({
  title,
  description,
  children,
  actions,
}: GlobalAdminShellProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.16),_transparent_24%),linear-gradient(180deg,_#0a0610_0%,_#040308_100%)] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-orange-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Global admin
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-zinc-400 md:text-base">
                  {description}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/dashboard"
                className="inline-flex h-11 items-center rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15"
              >
                Tenant admin
              </Link>
              {actions}
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-black/25 p-3">
            <p className="px-3 pb-3 text-xs uppercase tracking-[0.22em] text-zinc-500">
              Global controls
            </p>
            <nav className="space-y-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin/global/tenants" &&
                    pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                      isActive
                        ? "border-orange-400/40 bg-orange-400/12 text-white"
                        : "border-white/10 bg-black/20 text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <section>{children}</section>
        </div>
      </div>
    </main>
  );
}
