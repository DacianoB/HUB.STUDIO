'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { TenantAppChrome } from '~/app/_components/tenant-app-chrome';
import { readTenantBranding } from '~/app/_nodes/tenant-theme';
import type { PagesConfig } from '~/app/_nodes/schemas';
import { LibraryAssetDetailPanel } from '~/app/library/library-asset-detail';
import { api } from '~/trpc/react';

type LibraryAssetPageProps = {
  assetId: string;
  backHref: string;
  pageName: string;
  runtimePagesConfig: PagesConfig;
  initialAsset?: Record<string, unknown>;
};

export function LibraryAssetPage({
  assetId,
  backHref,
  pageName,
  initialAsset
}: LibraryAssetPageProps) {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const isLoggedIn = sessionStatus === 'authenticated';
  const userName = session?.user?.name ?? session?.user?.email ?? 'Conta';
  const userImage = session?.user?.image;
  const userInitial = userName.trim().charAt(0).toUpperCase() || 'U';
  const currentTenantQuery = api.tenants.current.useQuery(undefined, {
    enabled: isLoggedIn,
    retry: false
  });

  const tenantBranding = useMemo(
    () => readTenantBranding(currentTenantQuery.data?.tenant?.settings),
    [currentTenantQuery.data?.tenant?.settings]
  );
  const tenantTheme = tenantBranding.theme;
  const tenantLogoUrl = tenantBranding.logoUrl;
  const tenantName = currentTenantQuery.data?.tenant?.name?.trim() || 'HUB';

  return (
    <TenantAppChrome
      tenantName={tenantName}
      tenantLogoUrl={tenantLogoUrl}
      tenantTheme={tenantTheme}
      nodeRadius={tenantBranding.nodeRadius}
      isLoggedIn={isLoggedIn}
      pathname={pathname}
      userName={userName}
      userImage={userImage}
      userInitial={userInitial}
      tenantSlug={currentTenantQuery.data?.tenant?.slug}
      tenantRole={currentTenantQuery.data?.role ?? session?.user?.tenantRole}
      isGlobalAdmin={session?.user?.isGlobalAdmin}
      searchValue={assetId}
      searchReadOnly
    >
      <LibraryAssetDetailPanel
        assetId={assetId}
        backHref={backHref}
        pageName={pageName}
        initialAsset={initialAsset as any}
      />
    </TenantAppChrome>
  );
}
