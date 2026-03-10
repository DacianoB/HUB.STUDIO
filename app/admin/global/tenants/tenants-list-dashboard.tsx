"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Building2, Search } from "lucide-react";

import { GlobalAdminShell } from "~/app/admin/global/tenants/global-admin-shell";
import { api } from "~/trpc/react";

function formatLimit(limit: number | null | undefined) {
  return limit == null ? "Unlimited" : String(limit);
}

export function TenantsListDashboard() {
  const [search, setSearch] = useState("");
  const tenantsQuery = api.tenants.listAll.useQuery();

  const tenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    const entries = tenantsQuery.data ?? [];
    if (!query) return entries;

    return entries.filter((tenant) => {
      return (
        tenant.name.toLowerCase().includes(query) ||
        tenant.slug.toLowerCase().includes(query)
      );
    });
  }, [search, tenantsQuery.data]);

  return (
    <GlobalAdminShell
      title="Tenant Policies"
      description="Search tenants, inspect usage, and open the global policy editor for each white-label company."
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by tenant name or slug"
            />
          </label>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {tenantsQuery.isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`loading-${index}`}
                  className="h-[268px] animate-pulse rounded-3xl border border-white/10 bg-black/20"
                />
              ))
            : tenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`/admin/global/tenants/${tenant.id}`}
                className="group rounded-3xl border border-white/10 bg-black/25 p-5 transition hover:border-orange-400/40 hover:bg-black/35"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <Building2 className="h-5 w-5 text-orange-200" />
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-white">{tenant.name}</h2>
                    <p className="mt-1 text-sm text-zinc-400">{tenant.slug}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                    {tenant.policy.joinMode.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Usage</p>
                    <div className="mt-3 space-y-1 text-sm text-zinc-300">
                      <p>{tenant.usage.activeMembers} active members</p>
                      <p>{tenant.usage.outstandingInvites} outstanding invites</p>
                      <p>{tenant.usage.products} active products</p>
                      <p>{tenant.usage.pages} custom pages</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Limits</p>
                    <div className="mt-3 space-y-1 text-sm text-zinc-300">
                      <p>Members: {formatLimit(tenant.policy.maxActiveMembers)}</p>
                      <p>Invites: {formatLimit(tenant.policy.maxOutstandingInvites)}</p>
                      <p>Products: {formatLimit(tenant.policy.maxProducts)}</p>
                      <p>Pages: {formatLimit(tenant.policy.maxPages)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                  <span className="text-zinc-500">
                    {tenant.policy.allowBrandingEditor ? "Branding enabled" : "Branding locked"}
                  </span>
                  <span className="inline-flex items-center gap-2 text-orange-200">
                    Open editor
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
        </section>

        {!tenantsQuery.isLoading && !tenants.length ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-12 text-center text-sm text-zinc-500">
            No tenants matched this search.
          </div>
        ) : null}
      </div>
    </GlobalAdminShell>
  );
}
