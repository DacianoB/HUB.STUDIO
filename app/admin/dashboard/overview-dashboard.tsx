"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  FileStack,
  Palette,
  Plus,
  Users,
} from "lucide-react";

import {
  ConsoleBadge,
  ConsoleSection,
  consoleInsetClassName,
  consoleMutedTextClassName,
} from "~/app/admin/_components/console-shell";
import { AdminShell } from "~/app/admin/dashboard/admin-shell";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

function formatLimit(limit: number | null | undefined) {
  return limit == null ? "Unlimited" : String(limit);
}

export function OverviewDashboard() {
  const membersQuery = api.users.listMembers.useQuery();
  const productsQuery = api.products.list.useQuery();
  const pagesQuery = api.nodePages.list.useQuery();
  const joinRequestsQuery = api.users.listJoinRequests.useQuery();
  const currentTenantQuery = api.tenants.current.useQuery(undefined, {
    retry: false,
  });

  const pendingQueue =
    (joinRequestsQuery.data?.pendingInvites.length ?? 0) +
    (joinRequestsQuery.data?.pendingMemberships.length ?? 0);
  const productLimitReached =
    (currentTenantQuery.data?.policy?.maxProducts ?? null) !== null &&
    (currentTenantQuery.data?.usage.products ?? 0) >=
      (currentTenantQuery.data?.policy?.maxProducts ?? 0);

  const workspaces = [
    {
      href: "/admin/dashboard/users",
      label: "Users",
      description: "Manage members, pending requests, invitations, and product access.",
      detail: `${membersQuery.data?.length ?? 0} members`,
      icon: Users,
    },
    {
      href: "/admin/dashboard/products",
      label: "Products",
      description: "Review published work, drafts, and the modules active in each product.",
      detail: `${productsQuery.data?.length ?? 0} products`,
      icon: Boxes,
    },
    {
      href: "/admin/dashboard/pages",
      label: "Pages",
      description: "Maintain route structure and page content without mixing it into product setup.",
      detail: `${pagesQuery.data?.length ?? 0} pages`,
      icon: FileStack,
    },
    {
      href: "/admin/dashboard/stats",
      label: "Stats",
      description: "Follow product engagement, user activity, and recent interaction trends.",
      detail: "Engagement view",
      icon: BarChart3,
    },
    {
      href: "/admin/dashboard/branding",
      label: "Branding",
      description: "Adjust company identity, palette, logo, and tenant-side presentation rules.",
      detail: "Theme settings",
      icon: Palette,
    },
  ];

  return (
    <AdminShell
      title="Overview"
      description="A cleaner operating view for the tenant. Review capacity, resolve people issues, and jump into the right workspace without stacking every setting on one page."
      actions={
        <Link
          href={productLimitReached ? "#" : "/admin/dashboard/products/new"}
          aria-disabled={productLimitReached}
          onClick={(event) => {
            if (productLimitReached) event.preventDefault();
          }}
        >
          <Button className="h-10 rounded-[10px] border border-[#4b412f] bg-[#8d7a56] px-4 text-sm font-semibold text-[#15130f] hover:bg-[#9a8660]">
            <Plus className="mr-2 h-4 w-4" />
            {productLimitReached ? "Product limit reached" : "New product"}
          </Button>
        </Link>
      }
    >
      <div className="space-y-5">
        {productLimitReached ? (
          <div className="rounded-[10px] border border-[#51422b] bg-[#2a2114] px-4 py-3 text-sm text-[#dfc28e]">
            This tenant is already at its product limit. Archive an existing product or ask a
            global admin to raise the cap before creating a new one.
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <ConsoleSection
            title="Operations"
            description="Keep the important counts together, then move into the specific area that needs work."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={consoleInsetClassName}>
                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-[#f4efe5]">People</p>
                    <p className="mt-1 text-3xl font-semibold text-[#f4efe5]">
                      {membersQuery.data?.length ?? 0}
                    </p>
                    <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>Active directory size</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#f4efe5]">Queue</p>
                    <p className="mt-1 text-3xl font-semibold text-[#f4efe5]">{pendingQueue}</p>
                    <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                      Requests and invites waiting on action
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#f4efe5]">Products</p>
                    <p className="mt-1 text-3xl font-semibold text-[#f4efe5]">
                      {productsQuery.data?.length ?? 0}
                    </p>
                    <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>Drafts and published items</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#f4efe5]">Pages</p>
                    <p className="mt-1 text-3xl font-semibold text-[#f4efe5]">
                      {pagesQuery.data?.length ?? 0}
                    </p>
                    <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>Custom tenant routes</p>
                  </div>
                </div>
              </div>

              <div className={consoleInsetClassName}>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#f4efe5]">Access state</p>
                      <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                        Current tenant policy and your operating role.
                      </p>
                    </div>
                    <ConsoleBadge tone="accent">
                      {currentTenantQuery.data?.role ?? "No role"}
                    </ConsoleBadge>
                  </div>

                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                      <dt className={consoleMutedTextClassName}>Join mode</dt>
                      <dd className="text-[#f4efe5]">
                        {currentTenantQuery.data?.policy?.joinMode.replaceAll("_", " ") ?? "Loading"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                      <dt className={consoleMutedTextClassName}>Product cap</dt>
                      <dd className="text-[#f4efe5]">
                        {formatLimit(currentTenantQuery.data?.policy?.maxProducts)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                      <dt className={consoleMutedTextClassName}>Member cap</dt>
                      <dd className="text-[#f4efe5]">
                        {formatLimit(currentTenantQuery.data?.policy?.maxActiveMembers)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                      <dt className={consoleMutedTextClassName}>Branding editor</dt>
                      <dd>
                        <ConsoleBadge
                          tone={
                            currentTenantQuery.data?.policy?.allowBrandingEditor
                              ? "success"
                              : "warning"
                          }
                        >
                          {currentTenantQuery.data?.policy?.allowBrandingEditor
                            ? "Available"
                            : "Locked"}
                        </ConsoleBadge>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </ConsoleSection>

          <ConsoleSection
            title="Attention"
            description="The items most likely to block admin work."
          >
            <div className="space-y-3">
              <div className={consoleInsetClassName}>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium text-[#f4efe5]">Pending access queue</p>
                    <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                      Requests and invites that still need a response.
                    </p>
                  </div>
                  <ConsoleBadge tone={pendingQueue > 0 ? "warning" : "success"}>
                    {pendingQueue > 0 ? `${pendingQueue} waiting` : "Clear"}
                  </ConsoleBadge>
                </div>
              </div>

              <div className={consoleInsetClassName}>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium text-[#f4efe5]">Product capacity</p>
                    <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                      {currentTenantQuery.data?.usage.products ?? 0} in use of{" "}
                      {formatLimit(currentTenantQuery.data?.policy?.maxProducts)}
                    </p>
                  </div>
                  <ConsoleBadge tone={productLimitReached ? "warning" : "neutral"}>
                    {productLimitReached ? "At limit" : "Healthy"}
                  </ConsoleBadge>
                </div>
              </div>
            </div>
          </ConsoleSection>
        </div>

        <ConsoleSection
          title="Workspaces"
          description="Each area has a narrower job now, so people, products, pages, and reporting are easier to manage separately."
        >
          <div className="divide-y divide-[#2a2823]">
            {workspaces.map((workspace) => {
              const Icon = workspace.icon;

              return (
                <Link
                  key={workspace.href}
                  href={workspace.href as any}
                  className="flex flex-col gap-3 py-4 transition first:pt-0 last:pb-0 hover:bg-[#1f1d19] sm:px-2 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#312d27] bg-[#141310] text-[#c9b089]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#f4efe5]">{workspace.label}</p>
                      <p className={`mt-1 text-sm leading-6 ${consoleMutedTextClassName}`}>
                        {workspace.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 lg:justify-end">
                    <span className={`text-sm ${consoleMutedTextClassName}`}>{workspace.detail}</span>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[#d7c29f]">
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </ConsoleSection>
      </div>
    </AdminShell>
  );
}
