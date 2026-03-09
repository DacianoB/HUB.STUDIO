"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, FileStack, LayoutDashboard, Users } from "lucide-react";

type AdminShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/dashboard/users", label: "Users", icon: Users },
  { href: "/admin/dashboard/pages", label: "Pages", icon: FileStack },
  { href: "/admin/dashboard/products", label: "Products", icon: Boxes },
] as const;

export function AdminShell({
  title,
  description,
  children,
  actions,
}: AdminShellProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_24%),linear-gradient(180deg,_#060913_0%,_#02040b_100%)] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Tenant admin
              </p>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-zinc-400 md:text-base">
                  {description}
                </p>
              </div>
            </div>
            {actions ? <div>{actions}</div> : null}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-black/25 p-3">
            <p className="px-3 pb-3 text-xs uppercase tracking-[0.22em] text-zinc-500">
              Control center
            </p>
            <nav className="space-y-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin/dashboard" &&
                    pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                      isActive
                        ? "border-sky-400/40 bg-sky-400/12 text-white"
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
