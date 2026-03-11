import { redirect } from "next/navigation";

import { StatsDashboard } from "~/app/admin/dashboard/stats/stats-dashboard";
import { getServerAuthSession } from "~/server/auth";

export default async function AdminStatsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/dashboard/stats");
  }

  return <StatsDashboard />;
}
