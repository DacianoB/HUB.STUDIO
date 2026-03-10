"use client";

import type { ChangeEvent, CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ImagePlus, Palette, RotateCcw } from "lucide-react";

import {
  MAX_TENANT_NODE_RADIUS,
  MIN_TENANT_NODE_RADIUS,
  TENANT_THEME_FIELDS,
  readTenantBranding,
  type TenantTheme,
} from "~/app/_nodes/tenant-theme";
import { AdminShell } from "~/app/admin/dashboard/admin-shell";
import { Button } from "~/components/ui/button";
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
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "H";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function messageFromUploadResponse(response: Response, text: string) {
  if (text.trim()) {
    try {
      const parsed = JSON.parse(text) as { message?: string } | undefined;
      if (parsed?.message?.trim()) return parsed.message.trim();
    } catch {
      // Ignore parse errors and fall back to the status code.
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
    return JSON.parse(text) as
      | {
          publicUrl?: string;
        }
      | undefined;
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
  const canEditBranding =
    currentTenantQuery.data?.role === "OWNER" ||
    currentTenantQuery.data?.role === "ADMIN" ||
    currentTenantQuery.data?.role === "INSTRUCTOR";
  const serverDraft = useMemo(
    () => (tenant ? buildDraft({ name: tenant.name, settings: tenant.settings }) : null),
    [tenant]
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

  const previewVars = useMemo(
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
            "--tenant-node-radius-sm": `${Math.max(10, draft.nodeRadius - 8)}px`,
            "--tenant-node-radius-pill": `${Math.max(999, draft.nodeRadius * 2)}px`,
          }) as CSSProperties
        : undefined,
    [draft]
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
          : current
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
      description="Edit the tenant company name, palette, logo, and default node rounding from one place."
      actions={
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="h-11 rounded-xl border-white/10 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
            disabled={!canEditBranding || !serverDraft || !isDirty || updateBrandingMutation.isPending}
            onClick={() => setDraft(serverDraft)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
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
            Save branding
          </Button>
        </div>
      }
    >
      {!draft ? (
        <div className="rounded-3xl border border-white/10 bg-black/25 p-6 text-sm text-zinc-400">
          {currentTenantQuery.isLoading ? "Loading tenant branding..." : "Tenant branding is unavailable."}
        </div>
      ) : (
        <div className="space-y-6">
          {!canEditBranding ? (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
              Company settings are read-only for your current role. Owner, admin, or GM access is required to edit branding.
            </div>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Building2 className="h-5 w-5 text-sky-200" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Company profile</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    This controls the company name node, logo badge, and the default radius used by dynamic-grid surfaces.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                      Company name
                    </span>
                    <input
                      className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-sky-400/50"
                      value={draft.name}
                      disabled={!canEditBranding}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                name: event.target.value,
                              }
                            : current
                        )
                      }
                      placeholder="Your company name"
                    />
                  </label>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                          Default node rounding
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">
                          Applied to cards, nav chips, buttons, and node shells across the tenant UI.
                        </p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white">
                        {draft.nodeRadius}px
                      </div>
                    </div>

                    <input
                      className="mt-4 h-2 w-full cursor-pointer accent-white"
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
                            : current
                        )
                      }
                    />
                    <div className="mt-2 flex justify-between text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      <span>Sharper</span>
                      <span>Rounder</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Company logo
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        Shown in the main brand badge.
                      </p>
                    </div>
                    {draft.logoUrl ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-300 transition hover:text-rose-200 disabled:opacity-50"
                        disabled={!canEditBranding}
                        onClick={() =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  logoUrl: "",
                                }
                              : current
                          )
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col items-center rounded-[32px] border border-dashed border-white/10 bg-black/25 p-6 text-center">
                    {draft.logoUrl ? (
                      <img
                        src={draft.logoUrl}
                        alt={draft.name || "Company logo"}
                        className="h-20 w-20 rounded-2xl object-contain"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl font-semibold text-white">
                        {initialsFromName(draft.name)}
                      </div>
                    )}
                    <p className="mt-4 text-sm text-zinc-300">
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
                      type="button"
                      className="mt-4 h-11 rounded-xl border-white/10 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                      disabled={!canEditBranding || isLogoUploadPending}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {isLogoUploadPending ? "Uploading..." : "Upload logo"}
                    </Button>
                    {logoUploadError ? (
                      <p className="mt-3 text-xs text-rose-300">{logoUploadError}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Palette className="h-5 w-5 text-sky-200" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Live preview</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    This preview mirrors the current dynamic-grid palette surfaces and radius rules.
                  </p>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-[32px] border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                <div
                  className="grid min-h-[360px] grid-cols-[84px_1fr]"
                  style={{
                    ...previewVars,
                    backgroundColor: "var(--tenant-bg-main)",
                    color: "var(--tenant-text-main)",
                  }}
                >
                  <aside
                    className="flex flex-col items-center gap-3 px-3 py-4"
                    style={{
                      backgroundColor: "var(--tenant-bg-secondary)",
                      borderRight: "1px solid var(--tenant-border)",
                    }}
                  >
                    <div
                      className="flex aspect-square w-full items-center justify-center overflow-hidden border"
                      style={{
                        borderRadius: "var(--tenant-node-radius-sm)",
                        borderColor: "var(--tenant-accent)",
                        backgroundColor: "var(--tenant-accent)",
                        color: "var(--tenant-button-text)",
                      }}
                    >
                      {draft.logoUrl ? (
                        <img
                          src={draft.logoUrl}
                          alt={draft.name || "Company logo"}
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <span className="text-xs font-bold">{initialsFromName(draft.name)}</span>
                      )}
                    </div>
                    {["Explore", "Alerts", "Messages"].map((label) => (
                      <div
                        key={label}
                        className="flex h-11 w-11 items-center justify-center text-[10px] font-semibold"
                        style={{
                          borderRadius: "var(--tenant-node-radius-pill)",
                          backgroundColor: "var(--tenant-card-bg)",
                          color: "var(--tenant-text-secondary)",
                        }}
                      >
                        {label.slice(0, 1)}
                      </div>
                    ))}
                  </aside>

                  <div className="p-4">
                    <div
                      className="flex items-center justify-between gap-3 px-4 py-3"
                      style={{
                        borderRadius: "var(--tenant-node-radius)",
                        border: "1px solid var(--tenant-border)",
                        backgroundColor: "var(--tenant-bg-secondary)",
                      }}
                    >
                      <div
                        className="flex-1 px-4 py-3 text-sm"
                        style={{
                          borderRadius: "var(--tenant-node-radius-pill)",
                          backgroundColor: "var(--tenant-card-bg)",
                          color: "var(--tenant-text-secondary)",
                        }}
                      >
                        Search nodes...
                      </div>
                      <div
                        className="px-4 py-3 text-sm font-semibold"
                        style={{
                          borderRadius: "var(--tenant-node-radius-pill)",
                          backgroundColor: "var(--tenant-button-primary)",
                          color: "var(--tenant-button-text)",
                        }}
                      >
                        Sign in
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {["Overview", "Training", "Downloads"].map((item, index) => (
                        <div
                          key={item}
                          className="px-4 py-2 text-xs font-semibold"
                          style={{
                            borderRadius: "var(--tenant-node-radius-pill)",
                            backgroundColor:
                              index === 0 ? "var(--tenant-button-primary)" : "var(--tenant-card-bg)",
                            color:
                              index === 0 ? "var(--tenant-button-text)" : "var(--tenant-text-secondary)",
                          }}
                        >
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {["Library card", "Course card"].map((title) => (
                        <div
                          key={title}
                          className="border p-4"
                          style={{
                            borderRadius: "var(--tenant-node-radius)",
                            borderColor: "var(--tenant-border)",
                            backgroundColor: "var(--tenant-card-bg)",
                          }}
                        >
                          <p className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--tenant-text-secondary)" }}>
                            Preview
                          </p>
                          <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                          <p className="mt-2 text-sm" style={{ color: "var(--tenant-text-secondary)" }}>
                            Surface, text, accent, and radius are all driven by the current palette.
                          </p>
                          <div
                            className="mt-4 inline-flex px-4 py-2 text-xs font-semibold"
                            style={{
                              borderRadius: "var(--tenant-node-radius-pill)",
                              backgroundColor: "var(--tenant-button-primary)",
                              color: "var(--tenant-button-text)",
                            }}
                          >
                            Primary action
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-black/25 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Palette className="h-5 w-5 text-sky-200" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Company palette</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  These are the actual color hooks used across the main page dynamic grid and library item experience.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {TENANT_THEME_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div
                    className="mb-4 h-16 rounded-2xl border border-white/10"
                    style={{ backgroundColor: draft.theme[field.key] }}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">{field.label}</p>
                    <p className="text-xs leading-5 text-zinc-400">{field.hint}</p>
                  </div>
                  <input
                    className="mt-4 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-3"
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
                          : current
                      )
                    }
                  />
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-mono text-zinc-300">
                    {draft.theme[field.key]}
                  </div>
                </label>
              ))}
            </div>

            {updateBrandingMutation.error ? (
              <p className="mt-4 text-sm text-rose-300">{updateBrandingMutation.error.message}</p>
            ) : null}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
