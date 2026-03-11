'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  ChevronDown,
  KeyRound,
  LogIn,
  LogOut,
  Shield,
  Sparkles
} from 'lucide-react';

import type { TenantTheme } from '~/app/_nodes/tenant-theme';
import { ACTIVE_TENANT_STORAGE_KEY, api } from '~/trpc/react';

type TenantRole = 'OWNER' | 'ADMIN' | 'INSTRUCTOR' | 'MEMBER' | null | undefined;

type UserMenuProps = {
  isLoggedIn: boolean;
  pathname?: string | null;
  userName: string;
  userImage?: string | null;
  userInitial: string;
  tenantTheme: TenantTheme;
  tenantName?: string | null;
  tenantSlug?: string | null;
  tenantRole?: TenantRole;
  isGlobalAdmin?: boolean;
};

type TenantOption = {
  id: string;
  slug: string;
  label: string;
};

function Avatar({
  userImage,
  userName,
  userInitial,
  tenantTheme
}: Pick<UserMenuProps, 'userImage' | 'userName' | 'userInitial' | 'tenantTheme'>) {
  if (userImage) {
    return (
      <img
        src={userImage}
        alt={userName}
        className="h-8 w-8 object-cover"
        style={{ borderRadius: 'var(--tenant-node-radius-pill)' }}
      />
    );
  }

  return (
    <span
      className="flex h-8 w-8 items-center justify-center text-xs font-bold"
      style={{
        borderRadius: 'var(--tenant-node-radius-pill)',
        background: `linear-gradient(135deg, ${tenantTheme.buttonPrimary}, ${tenantTheme.buttonPrimaryHover})`,
        color: 'var(--tenant-button-text)'
      }}
    >
      {userInitial}
    </span>
  );
}

export function UserMenu({
  isLoggedIn,
  pathname,
  userName,
  userImage,
  userInitial,
  tenantTheme,
  tenantName,
  tenantSlug,
  tenantRole,
  isGlobalAdmin
}: UserMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [storedTenantSlug] = useState(() => {
    if (typeof window === 'undefined') return tenantSlug ?? '';
    return window.localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY) ?? tenantSlug ?? '';
  });
  const [pendingTenantSlug, setPendingTenantSlug] = useState<string | null>(null);

  const mineTenantsQuery = api.tenants.listMine.useQuery(undefined, {
    enabled: isLoggedIn && !isGlobalAdmin
  });
  const allTenantsQuery = api.tenants.listAll.useQuery(undefined, {
    enabled: isLoggedIn && Boolean(isGlobalAdmin),
    retry: false
  });
  const setActiveMutation = api.tenants.setActive.useMutation();

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const tenantOptions = useMemo<TenantOption[]>(() => {
    if (isGlobalAdmin) {
      return (allTenantsQuery.data ?? []).map((tenant) => ({
        id: tenant.id,
        slug: tenant.slug,
        label: `${tenant.name} (${tenant.slug})`
      }));
    }

    return (mineTenantsQuery.data ?? []).map((membership) => ({
      id: membership.tenant.id,
      slug: membership.tenant.slug,
      label: `${membership.tenant.name} (${membership.role})`
    }));
  }, [allTenantsQuery.data, isGlobalAdmin, mineTenantsQuery.data]);

  const canAccessAdmin = Boolean(
    isGlobalAdmin || tenantRole === 'OWNER' || tenantRole === 'ADMIN'
  );
  const canAccessGlobalAdmin = Boolean(isGlobalAdmin);
  const selectedTenantSlug = pendingTenantSlug ?? tenantSlug ?? storedTenantSlug;

  async function handleTenantChange(nextSlug: string) {
    setPendingTenantSlug(nextSlug);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, nextSlug);
    }

    const selected = tenantOptions.find((option) => option.slug === nextSlug);
    if (!selected) return;

    await setActiveMutation.mutateAsync({ tenantId: selected.id });
    window.location.reload();
  }

  if (!isLoggedIn) {
    return (
      <button
        type="button"
        onClick={() =>
          window.location.assign(
            `/auth/signin?callbackUrl=${encodeURIComponent(pathname || '/')}`
          )
        }
        className="flex items-center gap-2 border px-3 py-1.5 text-xs font-semibold transition-colors"
        style={{
          borderRadius: 'var(--tenant-node-radius-pill)',
          borderColor: 'var(--tenant-border)',
          backgroundColor: 'var(--tenant-button-primary)',
          color: 'var(--tenant-button-text)'
        }}
      >
        <LogIn className="h-3.5 w-3.5" />
        Entrar
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-2 border px-1.5 py-1 pr-2 transition-all"
        style={{
          borderRadius: 'var(--tenant-node-radius-pill)',
          borderColor: isOpen ? tenantTheme.accent : 'var(--tenant-border)',
          background: isOpen
            ? `linear-gradient(180deg, ${tenantTheme.cardBg}, ${tenantTheme.bgSecondary})`
            : 'var(--tenant-card-bg)',
          color: 'var(--tenant-text-main)',
          boxShadow: isOpen ? `0 18px 40px -24px ${tenantTheme.accent}` : 'none'
        }}
      >
        <Avatar
          userImage={userImage}
          userName={userName}
          userInitial={userInitial}
          tenantTheme={tenantTheme}
        />
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--tenant-text-secondary)' }}
        />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-full z-40 mt-3 w-[18rem] overflow-hidden border backdrop-blur-xl"
          style={{
            borderRadius: 'calc(var(--tenant-node-radius) + 4px)',
            borderColor: 'var(--tenant-border)',
            background: `linear-gradient(180deg, ${tenantTheme.cardBg}f7, ${tenantTheme.bgSecondary}fa)`,
            boxShadow: `0 30px 80px -38px ${tenantTheme.bgMain}`
          }}
        >
          <div
            className="border-b p-4"
            style={{
              borderColor: 'var(--tenant-border)',
              background: `radial-gradient(circle at top right, ${tenantTheme.accent}30, transparent 42%)`
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar
                userImage={userImage}
                userName={userName}
                userInitial={userInitial}
                tenantTheme={tenantTheme}
              />
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold"
                  style={{ color: 'var(--tenant-text-main)' }}
                >
                  {userName}
                </p>
                <p
                  className="truncate text-xs"
                  style={{ color: 'var(--tenant-text-secondary)' }}
                >
                  {tenantName || 'Workspace'}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
              {isGlobalAdmin ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1"
                  style={{
                    backgroundColor: `${tenantTheme.accent}26`,
                    color: tenantTheme.accent
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  Global admin
                </span>
              ) : tenantRole ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1"
                  style={{
                    backgroundColor: `${tenantTheme.buttonPrimary}20`,
                    color: 'var(--tenant-text-main)'
                  }}
                >
                  <Building2 className="h-3 w-3" />
                  {tenantRole}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 p-3">
            {tenantOptions.length > 0 ? (
              <label className="block">
                <span
                  className="mb-1.5 block px-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--tenant-text-secondary)' }}
                >
                  Active tenant
                </span>
                <select
                  value={selectedTenantSlug}
                  onChange={(event) => void handleTenantChange(event.target.value)}
                  disabled={setActiveMutation.isPending}
                  className="w-full border px-3 py-2.5 text-sm outline-none transition-opacity disabled:cursor-wait disabled:opacity-70"
                  style={{
                    borderRadius: 'var(--tenant-node-radius-sm)',
                    borderColor: 'var(--tenant-border)',
                    backgroundColor: `${tenantTheme.bgMain}aa`,
                    color: 'var(--tenant-text-main)'
                  }}
                >
                  <option value="">Select tenant...</option>
                  {tenantOptions.map((option) => (
                    <option key={option.id} value={option.slug}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {canAccessAdmin || canAccessGlobalAdmin ? (
              <div className="space-y-2">
                {canAccessAdmin ? (
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between border px-3 py-2.5 text-sm font-semibold transition-colors"
                    style={{
                      borderRadius: 'var(--tenant-node-radius-sm)',
                      borderColor: `${tenantTheme.accent}44`,
                      backgroundColor: `${tenantTheme.accent}14`,
                      color: 'var(--tenant-text-main)'
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4" style={{ color: tenantTheme.accent }} />
                      Admin dashboard
                    </span>
                    <span style={{ color: 'var(--tenant-text-secondary)' }}>Open</span>
                  </Link>
                ) : null}

                {canAccessGlobalAdmin ? (
                  <Link
                    href="/admin/global/tenants"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between border px-3 py-2.5 text-sm font-semibold transition-colors"
                    style={{
                      borderRadius: 'var(--tenant-node-radius-sm)',
                      borderColor: `${tenantTheme.buttonPrimary}44`,
                      backgroundColor: `${tenantTheme.buttonPrimary}14`,
                      color: 'var(--tenant-text-main)'
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles
                        className="h-4 w-4"
                        style={{ color: tenantTheme.buttonPrimary }}
                      />
                      Global admin
                    </span>
                    <span style={{ color: 'var(--tenant-text-secondary)' }}>Open</span>
                  </Link>
                ) : null}
              </div>
            ) : null}

            <Link
              href="/auth/set-password"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between border px-3 py-2.5 text-sm font-semibold transition-colors"
              style={{
                borderRadius: 'var(--tenant-node-radius-sm)',
                borderColor: 'var(--tenant-border)',
                backgroundColor: `${tenantTheme.bgMain}66`,
                color: 'var(--tenant-text-main)'
              }}
            >
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Local password
              </span>
              <span style={{ color: 'var(--tenant-text-secondary)' }}>Open</span>
            </Link>

            <button
              type="button"
              onClick={() =>
                void signOut({
                  callbackUrl: '/auth/signin'
                })
              }
              className="flex w-full items-center justify-between border px-3 py-2.5 text-sm font-semibold transition-colors"
              style={{
                borderRadius: 'var(--tenant-node-radius-sm)',
                borderColor: 'var(--tenant-border)',
                backgroundColor: `${tenantTheme.bgMain}66`,
                color: 'var(--tenant-text-main)'
              }}
            >
              <span className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </span>
              <span style={{ color: 'var(--tenant-text-secondary)' }}>Exit</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
