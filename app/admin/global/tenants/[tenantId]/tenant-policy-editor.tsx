"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

import {
  ConsoleBadge,
  ConsoleEmpty,
  ConsoleSection,
  consoleInputClassName,
  consoleInsetClassName,
  consoleMutedTextClassName,
  consoleSelectClassName,
} from "~/app/admin/_components/console-shell";
import { GlobalAdminShell } from "~/app/admin/global/tenants/global-admin-shell";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
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
  { value: "OPEN_AUTO_APPROVE", label: "Open auto approve" },
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

function ToggleRow({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={cn(consoleInsetClassName, "flex items-start gap-3 p-4")}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      <div>
        <p className="text-sm font-medium text-[#f4efe5]">{label}</p>
        <p className={`mt-1 text-sm leading-6 ${consoleMutedTextClassName}`}>{description}</p>
      </div>
    </label>
  );
}

export function TenantPolicyEditor({ tenantId }: { tenantId: string }) {
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
        title="Tenant policy"
        description="Loading tenant policy details."
      >
        <ConsoleEmpty
          title="Loading tenant policy"
          description="The tenant policy workspace is still loading."
        />
      </GlobalAdminShell>
    );
  }

  return (
    <GlobalAdminShell
      title={tenant.name}
      description={`Global policy controls for ${tenant.slug}.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/global/tenants">
            <Button className="h-10 rounded-[10px] border border-[#34312b] bg-[#1a1814] px-4 text-sm font-semibold text-[#f4efe5] hover:bg-[#221f1a]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <Button
            className="h-10 rounded-[10px] border border-[#4b412f] bg-[#8d7a56] px-4 text-sm font-semibold text-[#15130f] hover:bg-[#9a8660] disabled:opacity-50"
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
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className={cn(consoleInsetClassName, "p-4")}>
            <p className="text-sm font-medium text-[#f4efe5]">Active members</p>
            <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">{usage.activeMembers}</p>
          </div>
          <div className={cn(consoleInsetClassName, "p-4")}>
            <p className="text-sm font-medium text-[#f4efe5]">Outstanding invites</p>
            <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
              {usage.outstandingInvites}
            </p>
          </div>
          <div className={cn(consoleInsetClassName, "p-4")}>
            <p className="text-sm font-medium text-[#f4efe5]">Products</p>
            <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">{usage.products}</p>
          </div>
          <div className={cn(consoleInsetClassName, "p-4")}>
            <p className="text-sm font-medium text-[#f4efe5]">Pages</p>
            <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">{usage.pages}</p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <ConsoleSection
            title="Access and capacity"
            description="Who can join, and how much room the tenant has before policy limits are hit."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className={`text-sm ${consoleMutedTextClassName}`}>Join mode</span>
                  <select
                    className={consoleSelectClassName}
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
                    <label key={key} className="grid gap-2">
                      <span className={`text-sm ${consoleMutedTextClassName}`}>{label}</span>
                      <input
                        className={consoleInputClassName}
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

              <div className={cn(consoleInsetClassName, "p-4")}>
                <p className="text-sm font-medium text-[#f4efe5]">Current usage</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                    <dt className={consoleMutedTextClassName}>Members</dt>
                    <dd className="text-[#f4efe5]">{usage.activeMembers}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                    <dt className={consoleMutedTextClassName}>Invites</dt>
                    <dd className="text-[#f4efe5]">{usage.outstandingInvites}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                    <dt className={consoleMutedTextClassName}>Products</dt>
                    <dd className="text-[#f4efe5]">{usage.products}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                    <dt className={consoleMutedTextClassName}>Pages</dt>
                    <dd className="text-[#f4efe5]">{usage.pages}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </ConsoleSection>

          <ConsoleSection
            title="Commercial and product rules"
            description="Which product types and commerce rules the tenant is allowed to use."
          >
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                {PRODUCT_TYPE_OPTIONS.map((type) => (
                  <label key={type} className={cn(consoleInsetClassName, "flex items-center gap-3 p-4")}>
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
                    <span className="text-sm font-medium text-[#f4efe5]">
                      {type.replaceAll("_", " ")}
                    </span>
                  </label>
                ))}
              </div>

              <div className="grid gap-3">
                <ToggleRow
                  checked={draft.allowPaidProducts}
                  label="Allow paid products"
                  description="Tenant admins can create paid offers with a price."
                  onChange={(checked) =>
                    setDraftOverride({ ...draft, allowPaidProducts: checked })
                  }
                />
                <ToggleRow
                  checked={draft.allowDownloads}
                  label="Allow downloads"
                  description="Files and assets can be offered as downloadable content."
                  onChange={(checked) =>
                    setDraftOverride({ ...draft, allowDownloads: checked })
                  }
                />
                <ToggleRow
                  checked={draft.allowSequentialCourses}
                  label="Allow sequential courses"
                  description="Course products can lock steps until earlier steps are completed."
                  onChange={(checked) =>
                    setDraftOverride({ ...draft, allowSequentialCourses: checked })
                  }
                />
                <ToggleRow
                  checked={draft.allowDemoCourseContent}
                  label="Allow demo course generation"
                  description="Tenant admins can create starter course content automatically."
                  onChange={(checked) =>
                    setDraftOverride({ ...draft, allowDemoCourseContent: checked })
                  }
                />
              </div>
            </div>
          </ConsoleSection>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <ConsoleSection
            title="Page and admin rules"
            description="Controls for route visibility, editing, and tenant-side admin tools."
          >
            <div className="grid gap-3">
              <ToggleRow
                checked={draft.allowPublicPages}
                label="Allow public pages"
                description="Tenant pages can be exposed without authentication."
                onChange={(checked) => setDraftOverride({ ...draft, allowPublicPages: checked })}
              />
              <ToggleRow
                checked={draft.allowHiddenPages}
                label="Allow hidden pages"
                description="Tenant pages can be created without showing in primary navigation."
                onChange={(checked) => setDraftOverride({ ...draft, allowHiddenPages: checked })}
              />
              <ToggleRow
                checked={draft.allowIndexablePages}
                label="Allow indexable pages"
                description="Tenant pages may be configured for search engine indexing."
                onChange={(checked) => setDraftOverride({ ...draft, allowIndexablePages: checked })}
              />
              <ToggleRow
                checked={draft.allowInternalRoutePages}
                label="Allow internal route pages"
                description="Tenant admins can create internal route-only pages."
                onChange={(checked) =>
                  setDraftOverride({ ...draft, allowInternalRoutePages: checked })
                }
              />
              <ToggleRow
                checked={draft.allowUserEditablePages}
                label="Allow user editable pages"
                description="Tenant pages can expose user-editable surface areas."
                onChange={(checked) =>
                  setDraftOverride({ ...draft, allowUserEditablePages: checked })
                }
              />
              <ToggleRow
                checked={draft.allowBrandingEditor}
                label="Allow branding editor"
                description="Tenant admins can update company identity, palette, and logo."
                onChange={(checked) =>
                  setDraftOverride({ ...draft, allowBrandingEditor: checked })
                }
              />
            </div>
          </ConsoleSection>

          <ConsoleSection
            title="Modules"
            description="Enable or disable tenant-wide module availability for product editors."
          >
            <div className="space-y-3">
              {moduleCapabilities.map((moduleCapability) => (
                <div
                  key={moduleCapability.moduleType}
                  className={cn(consoleInsetClassName, "flex items-center justify-between gap-3 p-4")}
                >
                  <div>
                    <p className="text-sm font-medium text-[#f4efe5]">
                      {moduleCapability.moduleType}
                    </p>
                    <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                      Controls whether tenant admins can enable this module inside products.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ConsoleBadge tone={moduleCapability.isEnabled ? "success" : "warning"}>
                      {moduleCapability.isEnabled ? "Enabled" : "Disabled"}
                    </ConsoleBadge>
                    <Button
                      className="h-10 rounded-[10px] border border-[#34312b] bg-[#1a1814] px-4 text-sm font-semibold text-[#f4efe5] hover:bg-[#221f1a] disabled:opacity-50"
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
          </ConsoleSection>
        </div>

        {updatePolicyMutation.error ? (
          <p className="text-sm text-[#e2a8a1]">{updatePolicyMutation.error.message}</p>
        ) : null}
        {updateModuleCapabilityMutation.error ? (
          <p className="text-sm text-[#e2a8a1]">
            {updateModuleCapabilityMutation.error.message}
          </p>
        ) : null}
      </div>
    </GlobalAdminShell>
  );
}
