import { redirect } from "next/navigation";

export default async function NewProductPage() {
  redirect("/admin/dashboard/products/new");
}
