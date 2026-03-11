"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Building2, Search } from "lucide-react";

import {
  ConsoleBadge,
  ConsoleEmpty,
  ConsoleSection,
  consoleInputClassName,
  consoleMutedTextClassName,
} from "~/app/admin/_components/console-shell";
import { GlobalAdminShell } from "~/app/admin/global/tenants/global-admin-shell";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

function formatLimit(limit: number | null | undefined) {
  return limit == null ? "Unlimited" : String(limit);
}

export function TenantsListDashboard() {
  const [search, setSearch] = useState("");
  const tenantsQuery = api.tenants.listAll.useQuery();

  const tenants = (tenantsQuery.data ?? []).filter((tenant) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      tenant.name.toLowerCase().includes(query) ||
      tenant.slug.toLowerCase().includes(query)
    );
  });

  return (
    <GlobalAdminShell
      title="Tenants"
      description="Review tenant health, quotas, and policy posture before opening a detailed policy editor."
    >
      <div className="space-y-5">
        <ConsoleSection
          title="Tenant directory"
          description="Search by company name or slug, then open the tenant policy workspace."
        >
          <label className="relative block max-w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7f7769]" />
            <input
              className={cn(consoleInputClassName, "pl-9")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tenant name or slug"
            />
          </label>
        </ConsoleSection>

        {tenants.length ? (
          <ConsoleSection
            title="Tenant list"
            description="Usage and limits are shown together here so you can spot pressure before opening a policy."
          >
            <div className="overflow-hidden rounded-[10px] border border-[#2e2b26]">
              <div className="divide-y divide-[#2a2823]">
                {tenants.map((tenant) => (
                  <Link
                    key={tenant.id}
                    href={`/admin/global/tenants/${tenant.id}` as any}
                    className="grid gap-4 bg-[#171613] px-4 py-4 transition hover:bg-[#1d1a16] xl:grid-cols-[minmax(0,1.1fr)_repeat(4,minmax(0,0.65fr))_170px]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#312d27] bg-[#11100d] text-[#c9b089]">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-medium text-[#f4efe5]">{tenant.name}</p>
                        <ConsoleBadge tone="accent">
                          {tenant.policy.joinMode.replaceAll("_", " ")}
                        </ConsoleBadge>
                      </div>
                      <p className={`mt-2 text-sm ${consoleMutedTextClassName}`}>{tenant.slug}</p>
                    </div>

                    <div>
                      <p className={`text-sm ${consoleMutedTextClassName}`}>Members</p>
                      <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                        {tenant.usage.activeMembers} / {formatLimit(tenant.policy.maxActiveMembers)}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${consoleMutedTextClassName}`}>Invites</p>
                      <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                        {tenant.usage.outstandingInvites} /{" "}
                        {formatLimit(tenant.policy.maxOutstandingInvites)}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${consoleMutedTextClassName}`}>Products</p>
                      <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                        {tenant.usage.products} / {formatLimit(tenant.policy.maxProducts)}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${consoleMutedTextClassName}`}>Pages</p>
                      <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                        {tenant.usage.pages} / {formatLimit(tenant.policy.maxPages)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 xl:justify-end">
                      <ConsoleBadge
                        tone={tenant.policy.allowBrandingEditor ? "success" : "warning"}
                      >
                        {tenant.policy.allowBrandingEditor ? "Branding on" : "Branding off"}
                      </ConsoleBadge>
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-[#d7c29f]">
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </ConsoleSection>
        ) : (
          <ConsoleEmpty
            title="No tenants matched this search"
            description="Try a different company name or tenant slug."
          />
        )}
      </div>
    </GlobalAdminShell>
  );
}
