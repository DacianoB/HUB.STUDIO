import { redirect } from "next/navigation";

import { TenantPolicyEditor } from "~/app/admin/global/tenants/[tenantId]/tenant-policy-editor";
import { getServerAuthSession } from "~/server/auth";

export default async function GlobalAdminTenantPolicyPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/global/tenants");
  }

  if (!session.user.isGlobalAdmin) {
    redirect("/admin/dashboard");
  }

  const { tenantId } = await params;

  return <TenantPolicyEditor tenantId={tenantId} />;
}
