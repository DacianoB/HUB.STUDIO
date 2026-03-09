import { DynamicGrid } from "~/app/_nodes/dynamic-grid";
import { pagesConfig } from "~/app/_nodes/pages";
import { getServerAuthSession } from "~/server/auth";
import { getTenantPagesConfig } from "~/server/tenant-pages";

export default async function HomePage() {
  const session = await getServerAuthSession();
  const tenantPagesConfig = await getTenantPagesConfig(session);

  return (
    <main className="min-h-screen bg-black text-white">
      <DynamicGrid
        isAuthenticated={Boolean(session?.user)}
        runtimePagesConfig={tenantPagesConfig ?? pagesConfig}
      />
    </main>
  );
}
