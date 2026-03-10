import { redirect } from "next/navigation";

import { TenantsListDashboard } from "~/app/admin/global/tenants/tenants-list-dashboard";
import { getServerAuthSession } from "~/server/auth";

export default async function GlobalAdminTenantsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/global/tenants");
  }

  if (!session.user.isGlobalAdmin) {
    redirect("/admin/dashboard");
  }

  return <TenantsListDashboard />;
}
