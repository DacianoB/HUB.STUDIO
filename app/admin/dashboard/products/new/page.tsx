import { redirect } from "next/navigation";

import { ProductEditor } from "~/app/dashboard/products/product-editor";
import { getServerAuthSession } from "~/server/auth";

export default async function AdminNewProductPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/dashboard/products/new");
  }

  return <ProductEditor mode="create" />;
}
