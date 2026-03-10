import { redirect } from "next/navigation";

import { BrandingDashboard } from "~/app/admin/dashboard/branding/branding-dashboard";
import { getServerAuthSession } from "~/server/auth";

export default async function AdminBrandingPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/dashboard/branding");
  }

  return <BrandingDashboard />;
}
