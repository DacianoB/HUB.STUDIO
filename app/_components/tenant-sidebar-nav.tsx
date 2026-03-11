'use client';

import type { ReactNode } from 'react';
import { Bell, Compass, MessageCircle, Settings } from 'lucide-react';

type TenantSidebarNavProps = {
  tenantName: string;
  tenantLogoUrl?: string | null;
  itemVariant?: 'ghost' | 'card';
};

const NAV_ITEMS = [
  { label: 'Explorar', icon: Compass },
  { label: 'Notificacoes', icon: Bell },
  { label: 'Mensagens', icon: MessageCircle }
] as const;

function initialsFromLabel(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'HB';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function NavIconButton({
  title,
  isGhost,
  children
}: {
  title: string;
  isGhost: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className={
        isGhost
          ? 'group relative flex aspect-square w-full items-center justify-center p-3 transition-colors hover:!text-[var(--tenant-button-primary-hover)] max-md:h-11 max-md:w-11 max-md:p-0'
          : 'group relative flex aspect-square w-full items-center justify-center border p-3 transition-colors hover:bg-[var(--tenant-button-primary-hover)] hover:text-[var(--tenant-button-text)] max-md:h-11 max-md:w-11 max-md:p-0'
      }
      title={title}
      type="button"
      style={
        isGhost
          ? {
              color: 'var(--tenant-text-secondary)'
            }
          : {
              borderRadius: 'var(--tenant-node-radius-pill)',
              borderColor: 'var(--tenant-border)',
              backgroundColor: 'var(--tenant-card-bg)',
              color: 'var(--tenant-text-secondary)'
            }
      }
    >
      {children}
    </button>
  );
}

export function TenantSidebarNav({
  tenantName,
  tenantLogoUrl,
  itemVariant = 'ghost'
}: TenantSidebarNavProps) {
  const tenantInitials = initialsFromLabel(tenantName);

  return (
    <>
      <nav
        className="z-20 hidden h-full w-20 shrink-0 flex-col items-center gap-2 border-r px-3 py-3 md:flex"
        style={{
          borderColor: 'var(--tenant-border)',
          backgroundColor: 'var(--tenant-bg-secondary)'
        }}
      >
        <button
          type="button"
          className="group relative flex aspect-square w-full items-center justify-center overflow-hidden border text-xs font-bold"
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
              className="h-10 w-10 object-contain"
            />
          ) : (
            <span>{tenantInitials}</span>
          )}
        </button>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isGhost = itemVariant === 'ghost';

          return (
            <NavIconButton
              key={item.label}
              title={item.label}
              isGhost={isGhost}
            >
              <Icon className="h-5 w-5" />
            </NavIconButton>
          );
        })}

        <div className="my-1 h-px w-6 bg-[var(--tenant-border)]" />

        <div className="mt-auto flex flex-col items-center gap-1">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center border text-[var(--tenant-text-secondary)] transition-colors hover:bg-[var(--tenant-button-primary-hover)] hover:text-[var(--tenant-button-text)]"
            title="Configuracoes"
            style={{
              borderRadius: 'var(--tenant-node-radius-pill)',
              borderColor: 'var(--tenant-border)',
              backgroundColor: 'var(--tenant-card-bg)'
            }}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </nav>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t px-3 py-2 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.65)] md:hidden"
        style={{
          // borderRadius: 'calc(var(--tenant-node-radius) + 8px)',
          borderColor: 'var(--tenant-border)',
          backgroundColor: 'var(--tenant-bg-secondary)',
          backdropFilter: 'blur(18px)'
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isGhost = itemVariant === 'ghost';

          return (
            <NavIconButton
              key={item.label}
              title={item.label}
              isGhost={isGhost}
            >
              <Icon className="h-5 w-5" />
            </NavIconButton>
          );
        })}

        <NavIconButton title="Configuracoes" isGhost={false}>
          <Settings className="h-5 w-5" />
        </NavIconButton>
      </nav>
    </>
  );
}
