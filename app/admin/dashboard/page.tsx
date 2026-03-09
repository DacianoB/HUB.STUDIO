import { redirect } from "next/navigation";

import { OverviewDashboard } from "~/app/admin/dashboard/overview-dashboard";
import { getServerAuthSession } from "~/server/auth";

export default async function AdminDashboardPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/dashboard");
  }

  return <OverviewDashboard />;
}
