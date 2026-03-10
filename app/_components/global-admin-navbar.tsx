"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { ACTIVE_TENANT_STORAGE_KEY, api } from "~/trpc/react";

export function GlobalAdminNavbar() {
  const { data: session } = useSession();
  const [tenantSlug, setTenantSlug] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY) ?? "";
  });

  const mineTenantsQuery = api.tenants.listMine.useQuery(undefined, {
    enabled: Boolean(session?.user),
  });
  const allTenantsQuery = api.tenants.listAll.useQuery(undefined, {
    enabled: Boolean(session?.user?.isGlobalAdmin),
    retry: false,
  });
  const setActiveMutation = api.tenants.setActive.useMutation();

  const options = useMemo(() => {
    if (session?.user?.isGlobalAdmin) {
      return (allTenantsQuery.data ?? []).map((tenant) => ({
        id: tenant.id,
        slug: tenant.slug,
        label: `${tenant.name} (${tenant.slug})`,
      }));
    }
    return (mineTenantsQuery.data ?? []).map((membership) => ({
      id: membership.tenant.id,
      slug: membership.tenant.slug,
      label: `${membership.tenant.name} (${membership.role})`,
    }));
  }, [allTenantsQuery.data, mineTenantsQuery.data, session?.user?.isGlobalAdmin]);

  if (!session?.user) return null;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-3 text-xs text-zinc-200 md:px-6">
          <span className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold tracking-wide">
            {session.user.isGlobalAdmin ? "GLOBAL ADMIN" : "TENANT USER"}
          </span>
          <span className="truncate text-zinc-400">{session.user.email ?? "unknown user"}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-zinc-500 md:inline">Active tenant</span>
            <select
              value={tenantSlug}
              onChange={async (event) => {
                const nextSlug = event.target.value;
                setTenantSlug(nextSlug);
                window.localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, nextSlug);
                const selected = options.find((option) => option.slug === nextSlug);
                if (!selected) return;
                await setActiveMutation.mutateAsync({ tenantId: selected.id });
                window.location.reload();
              }}
              className="h-8 min-w-[220px] rounded border border-white/20 bg-black px-2 text-xs text-zinc-100"
            >
              <option value="">Select tenant...</option>
              {options.map((option) => (
                <option key={option.id} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
            <Link
              href="/admin/dashboard"
              className="rounded bg-orange-500 px-3 py-1 font-semibold text-black"
            >
              Admin
            </Link>
            {session.user.isGlobalAdmin ? (
              <Link
                href="/admin/global/tenants"
                className="rounded bg-white px-3 py-1 font-semibold text-black"
              >
                Global
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      <div className="h-12" />
    </>
  );
}
