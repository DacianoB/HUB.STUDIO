"use client";

import Link from "next/link";
import { ArrowRight, Boxes, FileStack, Palette, Plus, Users } from "lucide-react";

import { AdminShell } from "~/app/admin/dashboard/admin-shell";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function OverviewDashboard() {
  const membersQuery = api.users.listMembers.useQuery();
  const productsQuery = api.products.list.useQuery();
  const pagesQuery = api.nodePages.list.useQuery();
  const joinRequestsQuery = api.users.listJoinRequests.useQuery();

  const pendingQueue =
    (joinRequestsQuery.data?.pendingInvites.length ?? 0) +
    (joinRequestsQuery.data?.pendingMemberships.length ?? 0);

  return (
    <AdminShell
      title="Admin dashboard"
      description="Manage the full tenant control center from one place: branding, users, pages, and products."
      actions={
        <Link href="/admin/dashboard/products/new">
          <Button className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400">
            <Plus className="mr-2 h-4 w-4" />
            New product
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Members",
              value: membersQuery.data?.length ?? 0,
            },
            {
              label: "Products",
              value: productsQuery.data?.length ?? 0,
            },
            {
              label: "Pages",
              value: pagesQuery.data?.length ?? 0,
            },
            {
              label: "Pending queue",
              value: pendingQueue,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-3xl border border-white/10 bg-black/25 p-5"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {[
            {
              href: "/admin/dashboard/branding",
              title: "Branding",
              description:
                "Edit company name, palette, logo, and default node rounding for the tenant experience.",
              icon: Palette,
              meta: "Theme and company settings",
            },
            {
              href: "/admin/dashboard/users",
              title: "Users",
              description:
                "Invite people, unlock access, review queue items, and grant product access.",
              icon: Users,
              meta: `${membersQuery.data?.length ?? 0} members`,
            },
            {
              href: "/admin/dashboard/pages",
              title: "Pages",
              description:
                "Create and structure tenant pages, manage page settings, and edit nodes.",
              icon: FileStack,
              meta: `${pagesQuery.data?.length ?? 0} pages`,
            },
            {
              href: "/admin/dashboard/products",
              title: "Products",
              description:
                "Create products, manage plugins, and edit gallery/course/download content.",
              icon: Boxes,
              meta: `${productsQuery.data?.length ?? 0} products`,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href as any}
                className="group rounded-3xl border border-white/10 bg-black/25 p-5 transition hover:border-sky-400/40 hover:bg-black/35"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Icon className="h-5 w-5 text-sky-200" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-white">{item.title}</h2>
                <p className="mt-2 text-sm text-zinc-400">{item.description}</p>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                  <span className="text-zinc-500">{item.meta}</span>
                  <span className="inline-flex items-center gap-2 text-sky-200">
                    Open
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </AdminShell>
  );
}
