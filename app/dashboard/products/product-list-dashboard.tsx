"use client";

import Link from "next/link";
import { ArrowRight, Box, Plus, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
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

export function ProductListDashboard({ embedded = false }: { embedded?: boolean }) {
  const productsQuery = api.products.list.useQuery();

  const content = (
    <div className="space-y-6">
      {!embedded ? (
        <section className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-200">
                <Sparkles className="h-3.5 w-3.5" />
                Product builder
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Products
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400 md:text-base">
                  Start from a clean list, create a product on its own page, and edit each
                  product in a dedicated workspace.
                </p>
              </div>
            </div>

            <Link href="/admin/dashboard/products/new">
              <Button className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400">
                <Plus className="mr-2 h-4 w-4" />
                Create product
              </Button>
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl border-white/10 bg-black/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                Total products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">
                {productsQuery.data?.length ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/10 bg-black/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                Published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">
                {(productsQuery.data ?? []).filter((product) => product.status === "PUBLISHED")
                  .length}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/10 bg-black/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                Drafts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-white">
                {(productsQuery.data ?? []).filter((product) => product.status === "DRAFT").length}
              </p>
            </CardContent>
          </Card>
        </section>

      <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Product library
            </h2>
            {productsQuery.isLoading ? (
              <span className="text-xs text-zinc-500">Loading...</span>
            ) : null}
          </div>

          {!productsQuery.data?.length && !productsQuery.isLoading ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Box className="h-6 w-6 text-zinc-300" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">No products yet</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Create the first product and then configure its plugins on its own editor
                page.
              </p>
              <Link href="/admin/dashboard/products/new" className="mt-6 inline-flex">
                <Button className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400">
                  <Plus className="mr-2 h-4 w-4" />
                  Create first product
                </Button>
              </Link>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {(productsQuery.data ?? []).map((product) => {
              const enabledModules = (product.moduleConfigs ?? []).filter(
                (moduleConfig) => moduleConfig.isEnabled
              );

              return (
                <Link
                  key={product.id}
                  href={`/admin/dashboard/products/${product.id}`}
                  className="group rounded-3xl border border-white/10 bg-black/25 p-5 transition hover:border-sky-400/40 hover:bg-black/35"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        {PRODUCT_TYPE_LABELS[product.type]}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        {product.name}
                      </h3>
                      {product.subtitle ? (
                        <p className="mt-1 text-sm text-zinc-400">{product.subtitle}</p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        product.status === "PUBLISHED"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>

                  <p className="mt-4 line-clamp-2 text-sm text-zinc-400">
                    {product.description || "No product description yet."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {enabledModules.length ? (
                      enabledModules.map((moduleConfig) => (
                        <span
                          key={moduleConfig.id}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-300"
                        >
                          {
                            MODULE_LABELS[
                              moduleConfig.moduleType as keyof typeof MODULE_LABELS
                            ]
                          }
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-500">
                        No plugins enabled
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                    <div className="flex gap-4 text-xs text-zinc-500">
                      <span>{product._count.steps} steps</span>
                      <span>{product._count.assets} assets</span>
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-sky-200">
                      Open editor
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
      </section>
    </div>
  );

  if (embedded) return content;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_35%),linear-gradient(180deg,_#050816_0%,_#02040b_100%)] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">{content}</div>
    </main>
  );
}
