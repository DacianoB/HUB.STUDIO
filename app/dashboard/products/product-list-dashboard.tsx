"use client";

import Link from "next/link";
import { ArrowRight, Box, Plus } from "lucide-react";

import {
  ConsoleBadge,
  ConsoleEmpty,
  ConsoleSection,
  consoleInsetClassName,
  consoleMutedTextClassName,
} from "~/app/admin/_components/console-shell";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const PRODUCT_TYPE_LABELS = {
  COURSE: "Course",
  PHYSICAL_PRODUCT: "Physical product",
  DIGITAL_PRODUCT: "Digital product",
  SERVICE: "Service",
  CUSTOM: "Custom",
} as const;

const MODULE_LABELS = {
  LIBRARY: "Library",
  COURSE: "Course",
} as const;

function formatProductPrice(product: {
  isFree: boolean;
  priceCents: number | null;
  currency: string | null;
}) {
  if (product.isFree) return "Free";
  if (product.priceCents == null) return "Paid";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: product.currency ?? "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(product.priceCents / 100);
  } catch {
    return `${product.currency ?? "USD"} ${((product.priceCents ?? 0) / 100).toFixed(2)}`;
  }
}

export function ProductListDashboard({ embedded = false }: { embedded?: boolean }) {
  const productsQuery = api.products.list.useQuery();
  const currentTenantQuery = api.tenants.current.useQuery(undefined, {
    retry: false,
  });

  const products = productsQuery.data ?? [];
  const publishedCount = products.filter((product) => product.status === "PUBLISHED").length;
  const draftCount = products.filter((product) => product.status === "DRAFT").length;
  const productLimitReached =
    (currentTenantQuery.data?.policy?.maxProducts ?? null) !== null &&
    (currentTenantQuery.data?.usage.products ?? 0) >=
      (currentTenantQuery.data?.policy?.maxProducts ?? 0);

  const content = (
    <div className="space-y-5">
      <ConsoleSection
        title="Product library"
        description="Products are listed here in one place, while detailed configuration stays inside each editor."
        actions={
          <Link
            href={productLimitReached ? "#" : "/admin/dashboard/products/new"}
            aria-disabled={productLimitReached}
            onClick={(event) => {
              if (productLimitReached) event.preventDefault();
            }}
          >
            <Button className="h-10 rounded-[10px] border border-[#4b412f] bg-[#8d7a56] px-4 text-sm font-semibold text-[#15130f] hover:bg-[#9a8660]">
              <Plus className="mr-2 h-4 w-4" />
              {productLimitReached ? "Product limit reached" : "New product"}
            </Button>
          </Link>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={cn(consoleInsetClassName, "p-4")}>
            <p className="text-sm font-medium text-[#f4efe5]">Total products</p>
            <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">{products.length}</p>
          </div>
          <div className={cn(consoleInsetClassName, "p-4")}>
            <p className="text-sm font-medium text-[#f4efe5]">Published</p>
            <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">{publishedCount}</p>
          </div>
          <div className={cn(consoleInsetClassName, "p-4")}>
            <p className="text-sm font-medium text-[#f4efe5]">Drafts</p>
            <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">{draftCount}</p>
          </div>
        </div>

        {productLimitReached ? (
          <div className="mt-4 rounded-[10px] border border-[#51422b] bg-[#2a2114] px-4 py-3 text-sm text-[#dfc28e]">
            This tenant is at its configured product limit. Archive an existing product or ask a
            global admin to raise the cap.
          </div>
        ) : null}
      </ConsoleSection>

      {products.length ? (
        <ConsoleSection
          title="Products"
          description="Open a product editor to manage modules, steps, assets, and publishing."
        >
          <div className="overflow-hidden rounded-[10px] border border-[#2e2b26]">
            <div className="divide-y divide-[#2a2823]">
              {products.map((product) => {
                const enabledModules = (product.moduleConfigs ?? []).filter(
                  (moduleConfig) => moduleConfig.isEnabled,
                );

                return (
                  <Link
                    key={product.id}
                    href={`/admin/dashboard/products/${product.id}` as any}
                    className="flex flex-col gap-4 bg-[#171613] px-4 py-4 transition hover:bg-[#1d1a16] xl:flex-row xl:items-center xl:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[#f4efe5]">{product.name}</p>
                        <ConsoleBadge
                          tone={product.status === "PUBLISHED" ? "success" : "neutral"}
                        >
                          {product.status}
                        </ConsoleBadge>
                        <ConsoleBadge tone="accent">
                          {PRODUCT_TYPE_LABELS[product.type]}
                        </ConsoleBadge>
                      </div>

                      {product.subtitle ? (
                        <p className={`mt-2 text-sm ${consoleMutedTextClassName}`}>
                          {product.subtitle}
                        </p>
                      ) : null}

                      <div className={`mt-2 flex flex-wrap gap-3 text-sm ${consoleMutedTextClassName}`}>
                        <span>{formatProductPrice(product)}</span>
                        <span>{product._count.steps} steps</span>
                        <span>{product._count.assets} assets</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 xl:items-end">
                      <div className="flex flex-wrap gap-2">
                        {enabledModules.length ? (
                          enabledModules.map((moduleConfig) => (
                            <ConsoleBadge key={moduleConfig.id}>
                              {
                                MODULE_LABELS[
                                  moduleConfig.moduleType as keyof typeof MODULE_LABELS
                                ]
                              }
                            </ConsoleBadge>
                          ))
                        ) : (
                          <ConsoleBadge>No modules</ConsoleBadge>
                        )}
                      </div>

                      <span className="inline-flex items-center gap-2 text-sm font-medium text-[#d7c29f]">
                        Open editor
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </ConsoleSection>
      ) : (
        <ConsoleSection
          title="Products"
          description="Create the first product and then move into its dedicated editor."
        >
          <ConsoleEmpty
            title="No products yet"
            description="Create a product to start configuring modules, steps, assets, and publishing rules."
          />
          <Link
            href={productLimitReached ? "#" : "/admin/dashboard/products/new"}
            className="mt-4 inline-flex"
            aria-disabled={productLimitReached}
            onClick={(event) => {
              if (productLimitReached) event.preventDefault();
            }}
          >
            <Button className="h-10 rounded-[10px] border border-[#4b412f] bg-[#8d7a56] px-4 text-sm font-semibold text-[#15130f] hover:bg-[#9a8660]">
              <Box className="mr-2 h-4 w-4" />
              Create first product
            </Button>
          </Link>
        </ConsoleSection>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <main className="min-h-screen bg-[#121210] px-5 py-6 text-[#f4efe5] lg:px-8">
      <div className="mx-auto max-w-[1280px]">{content}</div>
    </main>
  );
}
