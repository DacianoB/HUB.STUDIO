import { redirect } from "next/navigation";

import { ProductEditor } from "~/app/dashboard/products/product-editor";
import { getServerAuthSession } from "~/server/auth";

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/dashboard/products");
  }

  const { productId } = await params;
  return <ProductEditor mode="edit" productId={productId} />;
}
