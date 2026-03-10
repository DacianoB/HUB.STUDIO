"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

import { GlobalAdminShell } from "~/app/admin/global/tenants/global-admin-shell";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

type JoinMode = "INVITE_ONLY" | "OPEN_AUTO_APPROVE" | "OPEN_REQUEST_APPROVAL";
type ProductType =
  | "COURSE"
  | "PHYSICAL_PRODUCT"
  | "DIGITAL_PRODUCT"
  | "SERVICE"
  | "CUSTOM";
type ModuleType = "LIBRARY" | "COURSE";

type PolicyDraft = {
  joinMode: JoinMode;
  maxOutstandingInvites: string;
  maxActiveMembers: string;
  maxProducts: string;
  maxPages: string;
  allowedProductTypes: ProductType[];
  allowPaidProducts: boolean;
  allowDownloads: boolean;
  allowSequentialCourses: boolean;
  allowDemoCourseContent: boolean;
  allowPublicPages: boolean;
  allowHiddenPages: boolean;
  allowIndexablePages: boolean;
  allowInternalRoutePages: boolean;
  allowUserEditablePages: boolean;
  allowBrandingEditor: boolean;
};

const JOIN_MODE_OPTIONS: Array<{ value: JoinMode; label: string }> = [
  { value: "INVITE_ONLY", label: "Invite only" },
  { value: "OPEN_AUTO_APPROVE", label: "Open auto-approve" },
  { value: "OPEN_REQUEST_APPROVAL", label: "Open request approval" },
];

const PRODUCT_TYPE_OPTIONS: ProductType[] = [
  "COURSE",
  "PHYSICAL_PRODUCT",
  "DIGITAL_PRODUCT",
  "SERVICE",
  "CUSTOM",
];

const MODULE_OPTIONS: ModuleType[] = ["LIBRARY", "COURSE"];

function formatLimitInput(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function parseLimitInput(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function buildDraft(
  policy:
    | {
        joinMode: JoinMode;
        maxOutstandingInvites: number | null;
        maxActiveMembers: number | null;
        maxProducts: number | null;
        maxPages: number | null;
        allowedProductTypes: ProductType[];
        allowPaidProducts: boolean;
        allowDownloads: boolean;
        allowSequentialCourses: boolean;
        allowDemoCourseContent: boolean;
        allowPublicPages: boolean;
        allowHiddenPages: boolean;
        allowIndexablePages: boolean;
        allowInternalRoutePages: boolean;
        allowUserEditablePages: boolean;
        allowBrandingEditor: boolean;
      }
    | null
    | undefined,
) {
  return policy
    ? {
        joinMode: policy.joinMode,
        maxOutstandingInvites: formatLimitInput(policy.maxOutstandingInvites),
        maxActiveMembers: formatLimitInput(policy.maxActiveMembers),
        maxProducts: formatLimitInput(policy.maxProducts),
        maxPages: formatLimitInput(policy.maxPages),
        allowedProductTypes: [...policy.allowedProductTypes] as ProductType[],
        allowPaidProducts: policy.allowPaidProducts,
        allowDownloads: policy.allowDownloads,
        allowSequentialCourses: policy.allowSequentialCourses,
        allowDemoCourseContent: policy.allowDemoCourseContent,
        allowPublicPages: policy.allowPublicPages,
        allowHiddenPages: policy.allowHiddenPages,
        allowIndexablePages: policy.allowIndexablePages,
        allowInternalRoutePages: policy.allowInternalRoutePages,
        allowUserEditablePages: policy.allowUserEditablePages,
        allowBrandingEditor: policy.allowBrandingEditor,
      }
    : null;
}

function usePolicyEditorData(tenantId: string) {
  const utils = api.useUtils();
  const policyEditorQuery = api.tenants.getPolicyEditor.useQuery({ tenantId });
  const updatePolicyMutation = api.tenants.updatePolicy.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.tenants.getPolicyEditor.invalidate({ tenantId }),
        utils.tenants.listAll.invalidate(),
      ]);
    },
  });
  const updateModuleCapabilityMutation = api.tenants.updateModuleCapability.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.tenants.getPolicyEditor.invalidate({ tenantId }),
        utils.tenants.listAll.invalidate(),
      ]);
    },
  });

  return {
    policyEditorQuery,
    updatePolicyMutation,
    updateModuleCapabilityMutation,
  };
}

export function TenantPolicyEditor({ tenantId }: { tenantId: string }) {
  const data = usePolicyEditorData(tenantId);
  const { policyEditorQuery, updatePolicyMutation, updateModuleCapabilityMutation } = data;
  const serverDraft = useMemo(
    () => buildDraft(policyEditorQuery.data?.policy),
    [policyEditorQuery.data?.policy],
  );
  const [draftOverride, setDraftOverride] = useState<PolicyDraft | null>(null);
  const draft = draftOverride ?? serverDraft;

  const tenant = policyEditorQuery.data?.tenant;
  const usage = policyEditorQuery.data?.usage;
  const moduleCapabilities = useMemo(() => {
    const current = new Map(
      (policyEditorQuery.data?.moduleCapabilities ?? []).map((entry) => [
        entry.moduleType as ModuleType,
        entry,
      ]),
    );

    return MODULE_OPTIONS.map((moduleType) => ({
      moduleType,
      isEnabled: current.get(moduleType)?.isEnabled ?? true,
    }));
  }, [policyEditorQuery.data?.moduleCapabilities]);

  const isDirty = useMemo(() => {
    if (!draft || !serverDraft) return false;
    return JSON.stringify(draft) !== JSON.stringify(serverDraft);
  }, [draft, serverDraft]);

  if (policyEditorQuery.isLoading || !draft || !serverDraft || !tenant || !usage) {
    return (
      <GlobalAdminShell
        title="Tenant Policy Editor"
        description="Loading tenant policy details."
      >
        <div className="rounded-3xl border border-white/10 bg-black/25 p-6 text-sm text-zinc-400">
          Loading tenant policy...
        </div>
      </GlobalAdminShell>
    );
  }

  return (
    <GlobalAdminShell
      title={tenant.name}
      description={`Global policy controls for ${tenant.slug}.`}
      actions={
        <Link
          href="/admin/global/tenants"
          className="inline-flex h-11 items-center rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to tenants
        </Link>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Active members", value: usage.activeMembers },
            { label: "Outstanding invites", value: usage.outstandingInvites },
            { label: "Products", value: usage.products },
            { label: "Pages", value: usage.pages },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Access & membership</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Who can join this tenant</h2>
            </div>
            <Button
              className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
              disabled={!isDirty || updatePolicyMutation.isPending}
              onClick={() =>
                updatePolicyMutation.mutate(
                  {
                    tenantId,
                    policy: {
                      ...draft,
                      maxOutstandingInvites: parseLimitInput(draft.maxOutstandingInvites),
                      maxActiveMembers: parseLimitInput(draft.maxActiveMembers),
                      maxProducts: parseLimitInput(draft.maxProducts),
                      maxPages: parseLimitInput(draft.maxPages),
                    },
                  },
                  {
                    onSuccess: () => setDraftOverride(null),
                  },
                )
              }
            >
              <Save className="mr-2 h-4 w-4" />
              Save policy
            </Button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              <label className="grid gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                Join mode
                <select
                  className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-orange-400/50"
                  value={draft.joinMode}
                  onChange={(event) =>
                    setDraftOverride({
                      ...draft,
                      joinMode: event.target.value as JoinMode,
                    })
                  }
                >
                  {JOIN_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["Outstanding invite cap", "maxOutstandingInvites"],
                  ["Active member cap", "maxActiveMembers"],
                  ["Product cap", "maxProducts"],
                  ["Page cap", "maxPages"],
                ].map(([label, key]) => (
                  <label
                    key={key}
                    className="grid gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500"
                  >
                    {label}
                    <input
                      className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-orange-400/50"
                      value={draft[key as keyof PolicyDraft] as string}
                      onChange={(event) =>
                        setDraftOverride({
                          ...draft,
                          [key]: event.target.value,
                        })
                      }
                      placeholder="Leave blank for unlimited"
                      inputMode="numeric"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Current usage</p>
              <div className="mt-4 space-y-2 text-sm text-zinc-300">
                <p>Active members: {usage.activeMembers}</p>
                <p>Outstanding invites: {usage.outstandingInvites}</p>
                <p>Products in quota: {usage.products}</p>
                <p>Pages in quota: {usage.pages}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Product capabilities</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {PRODUCT_TYPE_OPTIONS.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-200"
                  >
                    <input
                      type="checkbox"
                      checked={draft.allowedProductTypes.includes(type)}
                      onChange={(event) =>
                        setDraftOverride({
                          ...draft,
                          allowedProductTypes: event.target.checked
                            ? [...draft.allowedProductTypes, type]
                            : draft.allowedProductTypes.filter((entry) => entry !== type),
                        })
                      }
                    />
                    {type.replaceAll("_", " ")}
                  </label>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                {[
                  ["allowPaidProducts", "Allow paid products"],
                  ["allowDownloads", "Allow downloads"],
                  ["allowSequentialCourses", "Allow sequential courses"],
                  ["allowDemoCourseContent", "Allow demo course generation"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-200"
                  >
                    <input
                      type="checkbox"
                      checked={draft[key as keyof PolicyDraft] as boolean}
                      onChange={(event) =>
                        setDraftOverride({
                          ...draft,
                          [key]: event.target.checked,
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Page rules & admin permissions</p>
              <div className="mt-4 space-y-2">
                {[
                  ["allowPublicPages", "Allow public pages"],
                  ["allowHiddenPages", "Allow hidden pages"],
                  ["allowIndexablePages", "Allow indexable pages"],
                  ["allowInternalRoutePages", "Allow internal routes"],
                  ["allowUserEditablePages", "Allow user-editable pages"],
                  ["allowBrandingEditor", "Allow tenant branding editor"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-zinc-200"
                  >
                    <input
                      type="checkbox"
                      checked={draft[key as keyof PolicyDraft] as boolean}
                      onChange={(event) =>
                        setDraftOverride({
                          ...draft,
                          [key]: event.target.checked,
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Product modules</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Tenant-wide module availability</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {moduleCapabilities.map((moduleCapability) => (
              <div
                key={moduleCapability.moduleType}
                className="rounded-3xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{moduleCapability.moduleType}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Controls whether tenant admins can enable this module inside products.
                    </p>
                  </div>
                  <Button
                    className="h-10 rounded-xl border-orange-500/30 bg-orange-500 px-4 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                    disabled={updateModuleCapabilityMutation.isPending}
                    onClick={() =>
                      updateModuleCapabilityMutation.mutate({
                        tenantId,
                        moduleType: moduleCapability.moduleType,
                        isEnabled: !moduleCapability.isEnabled,
                      })
                    }
                  >
                    {moduleCapability.isEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {updatePolicyMutation.error ? (
          <p className="text-sm text-rose-300">{updatePolicyMutation.error.message}</p>
        ) : null}
        {updateModuleCapabilityMutation.error ? (
          <p className="text-sm text-rose-300">
            {updateModuleCapabilityMutation.error.message}
          </p>
        ) : null}
      </div>
    </GlobalAdminShell>
  );
}
