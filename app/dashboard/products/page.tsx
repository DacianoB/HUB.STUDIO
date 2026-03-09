import { redirect } from "next/navigation";

export default async function ProductsDashboardPage() {
  redirect("/admin/dashboard/products");
}
