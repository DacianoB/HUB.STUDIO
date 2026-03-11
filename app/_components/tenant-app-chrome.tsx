'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Search } from 'lucide-react';

import { TenantSidebarNav } from '~/app/_components/tenant-sidebar-nav';
import { UserMenu } from '~/app/_components/user-menu';
import type { TenantTheme } from '~/app/_nodes/tenant-theme';

type TenantRole = 'OWNER' | 'ADMIN' | 'INSTRUCTOR' | 'MEMBER' | null | undefined;

type TenantAppChromeProps = {
  tenantName: string;
  tenantLogoUrl?: string | null;
  tenantTheme: TenantTheme;
  nodeRadius: number;
  isLoggedIn: boolean;
  pathname?: string | null;
  userName: string;
  userImage?: string | null;
  userInitial: string;
  tenantSlug?: string | null;
  tenantRole?: TenantRole;
  isGlobalAdmin?: boolean;
  searchValue: string;
  searchPlaceholder?: string;
  searchPrefix?: string;
  onSearchChange?: (value: string) => void;
  searchDisabled?: boolean;
  searchReadOnly?: boolean;
  shellHeightClassName?: string;
  sidebarItemVariant?: 'ghost' | 'card';
  children: ReactNode;
};

export function TenantAppChrome({
  tenantName,
  tenantLogoUrl,
  tenantTheme,
  nodeRadius,
  isLoggedIn,
  pathname,
  userName,
  userImage,
  userInitial,
  tenantSlug,
  tenantRole,
  isGlobalAdmin,
  searchValue,
  searchPlaceholder = 'Buscar nodes...',
  searchPrefix,
  onSearchChange,
  searchDisabled = false,
  searchReadOnly = false,
  shellHeightClassName = 'h-screen',
  sidebarItemVariant = 'ghost',
  children
}: TenantAppChromeProps) {
  const tenantInitials = tenantName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'HB';

  return (
    <div
      className={`relative flex overflow-hidden font-sans ${shellHeightClassName}`}
      data-tenant-grid
      style={{
        '--tenant-bg-main': tenantTheme.bgMain,
        '--tenant-bg-secondary': tenantTheme.bgSecondary,
        '--tenant-text-main': tenantTheme.textMain,
        '--tenant-text-secondary': tenantTheme.textSecondary,
        '--tenant-border': tenantTheme.borderColor,
        '--tenant-accent': tenantTheme.accent,
        '--tenant-button-primary': tenantTheme.buttonPrimary,
        '--tenant-button-primary-hover': tenantTheme.buttonPrimaryHover,
        '--tenant-button-text': tenantTheme.buttonText,
        '--tenant-card-bg': tenantTheme.cardBg,
        '--tenant-node-radius': `${nodeRadius}px`,
        '--tenant-node-radius-sm': `${Math.max(10, nodeRadius - 8)}px`,
        '--tenant-node-radius-pill': `${Math.max(999, nodeRadius * 2)}px`,
        backgroundColor: 'var(--tenant-bg-main)',
        color: 'var(--tenant-text-main)'
      } as CSSProperties}
    >
      <TenantSidebarNav
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
        itemVariant={sidebarItemVariant}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-24 md:pb-0">
        <div
          className="sticky top-3 z-20 mx-3 flex items-center gap-3 rounded-[var(--tenant-node-radius)] px-3 py-3 backdrop-blur-xl md:top-4 md:mx-5 md:px-4 md:py-4"
          style={{
            backgroundColor: `${tenantTheme.bgSecondary}f2`,
            border: '1px solid var(--tenant-border)'
          }}
        >
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border text-xs font-bold md:hidden"
            style={{
              borderRadius: 'var(--tenant-node-radius-sm)',
              borderColor: 'var(--tenant-accent)',
              backgroundColor: 'var(--tenant-accent)',
              color: 'var(--tenant-button-text)'
            }}
            title={tenantName}
          >
            {tenantLogoUrl ? (
              <img
                src={tenantLogoUrl}
                alt={tenantName}
                className="h-8 w-8 object-contain"
              />
            ) : (
              <span>{tenantInitials}</span>
            )}
          </button>

          <div className="group relative min-w-0 flex-1">
            <Search
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors"
              style={{ color: 'var(--tenant-text-secondary)' }}
            />
            {searchPrefix ? (
              <span
                className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-sm font-medium"
                style={{ color: 'var(--tenant-text-secondary)' }}
              >
                {searchPrefix}
              </span>
            ) : null}
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              readOnly={searchReadOnly}
              onChange={(event) => onSearchChange?.(event.target.value)}
              disabled={searchDisabled}
              className={`w-full border py-2.5 pr-4 text-sm outline-none transition-all ${
                searchPrefix ? 'pl-32' : 'pl-10'
              }`}
              style={{
                borderRadius: 'var(--tenant-node-radius-pill)',
                borderColor: 'var(--tenant-border)',
                backgroundColor: 'var(--tenant-card-bg)',
                color: 'var(--tenant-text-main)'
              }}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <UserMenu
              isLoggedIn={isLoggedIn}
              pathname={pathname}
              userName={userName}
              userImage={userImage}
              userInitial={userInitial}
              tenantTheme={tenantTheme}
              tenantName={tenantName}
              tenantSlug={tenantSlug}
              tenantRole={tenantRole}
              isGlobalAdmin={isGlobalAdmin}
            />
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
