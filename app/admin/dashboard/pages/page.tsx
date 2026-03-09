import { redirect } from "next/navigation";

import { PagesDashboard } from "~/app/admin/dashboard/pages/pages-dashboard";
import { getServerAuthSession } from "~/server/auth";

export default async function AdminPagesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/dashboard/pages");
  }

  return <PagesDashboard />;
}
