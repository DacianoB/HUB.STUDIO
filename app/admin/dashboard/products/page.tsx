import { redirect } from "next/navigation";

import { AdminShell } from "~/app/admin/dashboard/admin-shell";
import { ProductListDashboard } from "~/app/dashboard/products/product-list-dashboard";
import { getServerAuthSession } from "~/server/auth";

export default async function AdminProductsDashboardPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/dashboard/products");
  }

  return (
    <AdminShell
      title="Products"
      description="Create products and manage the plugins that power each product experience."
    >
      <ProductListDashboard embedded />
    </AdminShell>
  );
}
