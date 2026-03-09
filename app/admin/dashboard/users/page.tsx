import { redirect } from "next/navigation";

import { UsersDashboard } from "~/app/admin/dashboard/users/users-dashboard";
import { getServerAuthSession } from "~/server/auth";

export default async function AdminUsersPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/dashboard/users");
  }

  return <UsersDashboard />;
}
