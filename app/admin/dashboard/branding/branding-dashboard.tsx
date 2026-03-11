"use client";

import type { ChangeEvent, CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ImagePlus, RotateCcw, Save } from "lucide-react";

import {
  ConsoleEmpty,
  ConsoleSection,
  consoleInputClassName,
  consoleInsetClassName,
  consoleMutedTextClassName,
} from "~/app/admin/_components/console-shell";
import {
  MAX_TENANT_NODE_RADIUS,
  MIN_TENANT_NODE_RADIUS,
  TENANT_THEME_FIELDS,
  readTenantBranding,
  type TenantTheme,
} from "~/app/_nodes/tenant-theme";
import { AdminShell } from "~/app/admin/dashboard/admin-shell";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { ACTIVE_TENANT_STORAGE_KEY, api } from "~/trpc/react";

type BrandingDraft = {
  name: string;
  logoUrl: string;
  nodeRadius: number;
  theme: TenantTheme;
};

function buildDraft(input: { name: string; settings: unknown }): BrandingDraft {
  const branding = readTenantBranding(input.settings);
  return {
    name: input.name,
    logoUrl: branding.logoUrl ?? "",
    nodeRadius: branding.nodeRadius,
    theme: branding.theme,
  };
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "HS";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function messageFromUploadResponse(response: Response, text: string) {
  if (text.trim()) {
    try {
      const parsed = JSON.parse(text) as { message?: string } | undefined;
      if (parsed?.message?.trim()) return parsed.message.trim();
    } catch {
      // Ignore parse errors and fall back to status text.
    }
  }

  if (response.statusText.trim()) {
    return `${response.status} ${response.statusText}`.trim();
  }

  return `Upload failed with status ${response.status}.`;
}

function parseUploadResponse(text: string) {
  if (!text.trim()) return undefined;

  try {
    return JSON.parse(text) as { publicUrl?: string } | undefined;
  } catch {
    return undefined;
  }
}

export function BrandingDashboard() {
  const utils = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentTenantQuery = api.tenants.current.useQuery(undefined, {
    retry: false,
  });
  const updateBrandingMutation = api.tenants.updateBranding.useMutation({
    onSuccess: async () => {
      await utils.tenants.current.invalidate();
    },
  });

  const tenant = currentTenantQuery.data?.tenant;
  const canManageBrandingByRole =
    currentTenantQuery.data?.role === "OWNER" ||
    currentTenantQuery.data?.role === "ADMIN" ||
    currentTenantQuery.data?.role === "INSTRUCTOR";
  const brandingBlockedByPolicy =
    currentTenantQuery.data?.policy?.allowBrandingEditor === false;
  const canEditBranding = canManageBrandingByRole && !brandingBlockedByPolicy;
  const serverDraft = useMemo(
    () => (tenant ? buildDraft({ name: tenant.name, settings: tenant.settings }) : null),
    [tenant],
  );
  const [draft, setDraft] = useState<BrandingDraft | null>(serverDraft);
  const [isLogoUploadPending, setIsLogoUploadPending] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState("");

  useEffect(() => {
    setDraft(serverDraft);
  }, [serverDraft]);

  const isDirty = useMemo(() => {
    if (!draft || !serverDraft) return false;
    return JSON.stringify(draft) !== JSON.stringify(serverDraft);
  }, [draft, serverDraft]);

  const previewStyles = useMemo(
    () =>
      draft
        ? ({
            "--tenant-bg-main": draft.theme.bgMain,
            "--tenant-bg-secondary": draft.theme.bgSecondary,
            "--tenant-text-main": draft.theme.textMain,
            "--tenant-text-secondary": draft.theme.textSecondary,
            "--tenant-border": draft.theme.borderColor,
            "--tenant-accent": draft.theme.accent,
            "--tenant-button-primary": draft.theme.buttonPrimary,
            "--tenant-button-primary-hover": draft.theme.buttonPrimaryHover,
            "--tenant-button-text": draft.theme.buttonText,
            "--tenant-card-bg": draft.theme.cardBg,
            "--tenant-node-radius": `${draft.nodeRadius}px`,
          }) as CSSProperties
        : undefined,
    [draft],
  );

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setLogoUploadError("");
    setIsLogoUploadPending(true);

    try {
      const tenantSlug =
        typeof window === "undefined"
          ? null
          : window.localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/uploads/tenant-logo", {
        method: "POST",
        body: formData,
        headers: tenantSlug ? { "x-tenant-slug": tenantSlug } : undefined,
      });
      const responseText = await response.text();
      const result = parseUploadResponse(responseText);

      if (!response.ok) {
        throw new Error(messageFromUploadResponse(response, responseText));
      }

      if (!result?.publicUrl) {
        throw new Error("Upload completed without a public URL.");
      }

      setDraft((current) =>
        current
          ? {
              ...current,
              logoUrl: result.publicUrl ?? "",
            }
          : current,
      );
    } catch (error) {
      setLogoUploadError(error instanceof Error ? error.message : "Logo upload failed.");
    } finally {
      setIsLogoUploadPending(false);
    }
  }

  return (
    <AdminShell
      title="Branding"
      description="Keep identity, palette, and preview separate so the tenant look-and-feel is easier to manage."
      actions={
        <div className="flex flex-wrap gap-3">
          <Button
            className="h-10 rounded-[10px] border border-[#34312b] bg-[#1a1814] px-4 text-sm font-semibold text-[#f4efe5] hover:bg-[#221f1a] disabled:opacity-50"
            disabled={!canEditBranding || !serverDraft || !isDirty || updateBrandingMutation.isPending}
            onClick={() => setDraft(serverDraft)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button
            className="h-10 rounded-[10px] border border-[#4b412f] bg-[#8d7a56] px-4 text-sm font-semibold text-[#15130f] hover:bg-[#9a8660] disabled:opacity-50"
            disabled={
              !canEditBranding ||
              !draft ||
              !draft.name.trim() ||
              !isDirty ||
              updateBrandingMutation.isPending
            }
            onClick={() => {
              if (!draft) return;
              updateBrandingMutation.mutate({
                name: draft.name.trim(),
                logoUrl: draft.logoUrl.trim() || null,
                nodeRadius: draft.nodeRadius,
                theme: draft.theme,
              });
            }}
          >
            <Save className="mr-2 h-4 w-4" />
            Save branding
          </Button>
        </div>
      }
    >
      {!draft ? (
        <ConsoleEmpty
          title={currentTenantQuery.isLoading ? "Loading branding" : "Branding is unavailable"}
          description="The current tenant branding could not be loaded."
        />
      ) : (
        <div className="space-y-5">
          {!canEditBranding ? (
            <div className="rounded-[10px] border border-[#51422b] bg-[#2a2114] px-4 py-3 text-sm text-[#dfc28e]">
              {brandingBlockedByPolicy
                ? "Branding edits are disabled for this tenant by the global admin policy."
                : "Your current role can review branding but cannot edit it."}
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <ConsoleSection
              title="Identity"
              description="Company name, logo, and default component radius for tenant-facing screens."
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                  <label className="grid gap-2">
                    <span className={`text-sm ${consoleMutedTextClassName}`}>Company name</span>
                    <input
                      className={consoleInputClassName}
                      value={draft.name}
                      disabled={!canEditBranding}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                name: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                  </label>

                  <div className={cn(consoleInsetClassName, "p-4")}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#f4efe5]">Default radius</p>
                        <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                          Applied to tenant-side cards, buttons, and node containers.
                        </p>
                      </div>
                      <span className="text-sm font-medium text-[#f4efe5]">
                        {draft.nodeRadius}px
                      </span>
                    </div>

                    <input
                      className="mt-4 h-2 w-full cursor-pointer accent-[#8d7a56]"
                      type="range"
                      min={MIN_TENANT_NODE_RADIUS}
                      max={MAX_TENANT_NODE_RADIUS}
                      step={2}
                      value={draft.nodeRadius}
                      disabled={!canEditBranding}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                nodeRadius: Number(event.target.value),
                              }
                            : current,
                        )
                      }
                    />
                  </div>
                </div>

                <div className={cn(consoleInsetClassName, "p-4")}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#c9b089]" />
                    <p className="text-sm font-medium text-[#f4efe5]">Logo</p>
                  </div>

                  <div className="mt-4 flex flex-col items-center rounded-[10px] border border-dashed border-[#38342d] bg-[#141310] px-4 py-6 text-center">
                    {draft.logoUrl ? (
                      <img
                        src={draft.logoUrl}
                        alt={draft.name || "Tenant logo"}
                        className="h-20 w-20 rounded-[10px] object-contain"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-[10px] border border-[#312d27] bg-[#11100d] text-xl font-semibold text-[#f4efe5]">
                        {initialsFromName(draft.name)}
                      </div>
                    )}

                    <p className={`mt-4 text-sm ${consoleMutedTextClassName}`}>
                      JPG, PNG, WEBP, and GIF are supported.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(event) => void handleLogoUpload(event)}
                    />

                    <Button
                      className="mt-4 h-10 rounded-[10px] border border-[#34312b] bg-[#1a1814] px-4 text-sm font-semibold text-[#f4efe5] hover:bg-[#221f1a] disabled:opacity-50"
                      disabled={!canEditBranding || isLogoUploadPending}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {isLogoUploadPending ? "Uploading" : "Upload logo"}
                    </Button>

                    {draft.logoUrl ? (
                      <Button
                        className="mt-3 h-10 rounded-[10px] border border-[#553531] bg-[#2a1816] px-4 text-sm font-semibold text-[#e2a8a1] hover:bg-[#311d1a] disabled:opacity-50"
                        disabled={!canEditBranding}
                        onClick={() =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  logoUrl: "",
                                }
                              : current,
                          )
                        }
                      >
                        Remove logo
                      </Button>
                    ) : null}

                    {logoUploadError ? (
                      <p className="mt-3 text-sm text-[#e2a8a1]">{logoUploadError}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </ConsoleSection>

            <ConsoleSection
              title="Preview"
              description="A simple tenant-side sample using the current draft values."
            >
              <div
                className="overflow-hidden rounded-[10px] border border-[#2e2b26]"
                style={{
                  ...previewStyles,
                  backgroundColor: "var(--tenant-bg-main)",
                  color: "var(--tenant-text-main)",
                }}
              >
                <div className="grid min-h-[360px] grid-cols-[84px_minmax(0,1fr)]">
                  <aside
                    className="flex flex-col items-center gap-3 px-3 py-4"
                    style={{
                      backgroundColor: "var(--tenant-bg-secondary)",
                      borderRight: "1px solid var(--tenant-border)",
                    }}
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center overflow-hidden border text-sm font-semibold"
                      style={{
                        borderColor: "var(--tenant-accent)",
                        borderRadius: "var(--tenant-node-radius)",
                        backgroundColor: "var(--tenant-accent)",
                        color: "var(--tenant-button-text)",
                      }}
                    >
                      {draft.logoUrl ? (
                        <img
                          src={draft.logoUrl}
                          alt={draft.name}
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        initialsFromName(draft.name)
                      )}
                    </div>
                    {["Home", "Library", "Profile"].map((item) => (
                      <div
                        key={item}
                        className="flex h-10 w-10 items-center justify-center text-[11px]"
                        style={{
                          borderRadius: "var(--tenant-node-radius)",
                          backgroundColor: "var(--tenant-card-bg)",
                          color: "var(--tenant-text-secondary)",
                        }}
                      >
                        {item.slice(0, 1)}
                      </div>
                    ))}
                  </aside>

                  <div className="p-4">
                    <div
                      className="flex items-center justify-between gap-3 border px-4 py-3"
                      style={{
                        borderColor: "var(--tenant-border)",
                        borderRadius: "var(--tenant-node-radius)",
                        backgroundColor: "var(--tenant-bg-secondary)",
                      }}
                    >
                      <div
                        className="flex-1 px-3 py-2 text-sm"
                        style={{
                          borderRadius: "var(--tenant-node-radius)",
                          backgroundColor: "var(--tenant-card-bg)",
                          color: "var(--tenant-text-secondary)",
                        }}
                      >
                        Search content
                      </div>
                      <div
                        className="px-3 py-2 text-sm font-medium"
                        style={{
                          borderRadius: "var(--tenant-node-radius)",
                          backgroundColor: "var(--tenant-button-primary)",
                          color: "var(--tenant-button-text)",
                        }}
                      >
                        Sign in
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {["Product card", "Learning module"].map((label) => (
                        <div
                          key={label}
                          className="border p-4"
                          style={{
                            borderColor: "var(--tenant-border)",
                            borderRadius: "var(--tenant-node-radius)",
                            backgroundColor: "var(--tenant-card-bg)",
                          }}
                        >
                          <p className="text-sm font-medium">{label}</p>
                          <p
                            className="mt-2 text-sm"
                            style={{ color: "var(--tenant-text-secondary)" }}
                          >
                            Preview surfaces, text, and emphasis colors using the current draft.
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ConsoleSection>
          </div>

          <ConsoleSection
            title="Palette"
            description="These are the actual tenant theme hooks used by the runtime components."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {TENANT_THEME_FIELDS.map((field) => (
                <label key={field.key} className={cn(consoleInsetClassName, "p-4")}>
                  <div
                    className="h-16 rounded-[10px] border border-[#312d27]"
                    style={{ backgroundColor: draft.theme[field.key] }}
                  />
                  <p className="mt-4 text-sm font-medium text-[#f4efe5]">{field.label}</p>
                  <p className={`mt-1 text-sm leading-6 ${consoleMutedTextClassName}`}>
                    {field.hint}
                  </p>
                  <input
                    className="mt-4 h-10 w-full rounded-[10px] border border-[#37332d] bg-[#11100d] px-3"
                    type="color"
                    value={draft.theme[field.key]}
                    disabled={!canEditBranding}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              theme: {
                                ...current.theme,
                                [field.key]: event.target.value,
                              },
                            }
                          : current,
                      )
                    }
                  />
                  <div className="mt-3 rounded-[10px] border border-[#312d27] bg-[#11100d] px-3 py-2 text-xs text-[#d3cdc1]">
                    {draft.theme[field.key]}
                  </div>
                </label>
              ))}
            </div>

            {updateBrandingMutation.error ? (
              <p className="mt-4 text-sm text-[#e2a8a1]">
                {updateBrandingMutation.error.message}
              </p>
            ) : null}
          </ConsoleSection>
        </div>
      )}
    </AdminShell>
  );
}
