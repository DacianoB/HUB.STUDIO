"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  KeyRound,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { AdminShell } from "~/app/admin/dashboard/admin-shell";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type TenantRole = "OWNER" | "ADMIN" | "INSTRUCTOR" | "MEMBER";
type ManagedRole = Exclude<TenantRole, "OWNER">;
type MembershipStatus = "ACTIVE" | "PENDING" | "BLOCKED";

type MemberRecord = {
  id: string;
  userId: string;
  role: TenantRole;
  status: MembershipStatus;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
  };
};

type ProductRecord = {
  id: string;
  name: string;
  slug: string | null;
  type: string;
};

type ProductAccessRecord = {
  id: string;
  userId: string;
  productId: string;
  canView: boolean;
  canDownload: boolean;
  canEditProgress: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: ProductRecord;
};

type PendingInviteRecord = {
  id: string;
  email: string;
  role: ManagedRole;
  status: MembershipStatus;
  createdAt: Date;
};

const roleOptions: ManagedRole[] = ["ADMIN", "INSTRUCTOR", "MEMBER"];
const statusFilters: Array<"ALL" | MembershipStatus> = [
  "ALL",
  "ACTIVE",
  "PENDING",
  "BLOCKED",
];
const roleFilters: Array<"ALL" | TenantRole> = [
  "ALL",
  "OWNER",
  "ADMIN",
  "INSTRUCTOR",
  "MEMBER",
];

const permissionFields = [
  { key: "canView", label: "View" },
  { key: "canDownload", label: "Download" },
  { key: "canEditProgress", label: "Edit progress" },
] as const;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatRole(role: TenantRole) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function formatStatus(status: MembershipStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "Not available";
  return dateFormatter.format(value);
}

function getMemberDisplayName(member: MemberRecord) {
  return member.user.name?.trim() || member.user.email || member.userId;
}

function getMemberSubtitle(member: MemberRecord) {
  return member.user.email || member.user.id;
}

function getInitials(member: MemberRecord) {
  const source = member.user.name?.trim() || member.user.email || member.userId;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

function statusBadgeClass(status: MembershipStatus) {
  if (status === "ACTIVE") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  }
  if (status === "PENDING") {
    return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  }
  return "border-rose-400/25 bg-rose-400/10 text-rose-100";
}

function roleBadgeClass(role: TenantRole) {
  if (role === "OWNER") {
    return "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100";
  }
  if (role === "ADMIN") {
    return "border-sky-400/25 bg-sky-400/10 text-sky-100";
  }
  if (role === "INSTRUCTOR") {
    return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  }
  return "border-white/15 bg-white/5 text-zinc-200";
}

function buildAccessDraft(access?: ProductAccessRecord) {
  return {
    canView: access?.canView ?? true,
    canDownload: access?.canDownload ?? true,
    canEditProgress: access?.canEditProgress ?? false,
  };
}

function ProductAccessCard({
  access,
  userId,
}: {
  access: ProductAccessRecord;
  userId: string;
}) {
  const utils = api.useUtils();
  const [draft, setDraft] = useState(buildAccessDraft(access));

  useEffect(() => {
    setDraft(buildAccessDraft(access));
  }, [access]);

  const saveMutation = api.users.grantProductAccess.useMutation({
    onSuccess: async () => {
      await utils.users.listProductAccesses.invalidate();
    },
  });
  const revokeMutation = api.users.revokeProductAccess.useMutation({
    onSuccess: async () => {
      await utils.users.listProductAccesses.invalidate();
    },
  });

  const isDirty =
    draft.canView !== access.canView ||
    draft.canDownload !== access.canDownload ||
    draft.canEditProgress !== access.canEditProgress;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{access.product.name}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {access.product.type.replaceAll("_", " ")}
            {access.product.slug ? ` / ${access.product.slug}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          <span>Created {formatDate(access.createdAt)}</span>
          <span>Updated {formatDate(access.updatedAt)}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {permissionFields.map((field) => (
          <label
            key={field.key}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200"
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-transparent accent-sky-400"
              checked={draft[field.key]}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [field.key]: event.target.checked,
                }))
              }
            />
            {field.label}
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          className="h-10 rounded-xl border-sky-500/30 bg-sky-500 px-4 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
          disabled={!isDirty || saveMutation.isPending}
          onClick={() =>
            saveMutation.mutate({
              userId,
              productId: access.productId,
              ...draft,
            })
          }
        >
          Save permissions
        </Button>
        <Button
          className="h-10 rounded-xl border-rose-500/30 bg-rose-500/15 px-4 text-sm font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
          disabled={revokeMutation.isPending}
          onClick={() =>
            revokeMutation.mutate({
              userId,
              productId: access.productId,
            })
          }
        >
          Remove access
        </Button>
      </div>

      {saveMutation.error ? (
        <p className="mt-3 text-xs text-rose-300">{saveMutation.error.message}</p>
      ) : null}
      {revokeMutation.error ? (
        <p className="mt-3 text-xs text-rose-300">{revokeMutation.error.message}</p>
      ) : null}
    </div>
  );
}

function GrantProductAccessForm({
  userId,
  availableProducts,
}: {
  userId: string;
  availableProducts: ProductRecord[];
}) {
  const utils = api.useUtils();
  const [productId, setProductId] = useState(availableProducts[0]?.id ?? "");
  const [draft, setDraft] = useState(buildAccessDraft());

  useEffect(() => {
    if (!availableProducts.length) {
      setProductId("");
      return;
    }

    if (!availableProducts.some((product) => product.id === productId)) {
      setProductId(availableProducts[0]?.id ?? "");
    }
  }, [availableProducts, productId]);

  const grantMutation = api.users.grantProductAccess.useMutation({
    onSuccess: async () => {
      setDraft(buildAccessDraft());
      await utils.users.listProductAccesses.invalidate();
    },
  });

  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-2">
          <label className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            Add product access
          </label>
          <select
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            disabled={!availableProducts.length}
          >
            {availableProducts.length ? null : <option value="">All products assigned</option>}
            {availableProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
          disabled={!productId || grantMutation.isPending}
          onClick={() =>
            grantMutation.mutate({
              userId,
              productId,
              ...draft,
            })
          }
        >
          Grant access
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {permissionFields.map((field) => (
          <label
            key={field.key}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200"
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-400"
              checked={draft[field.key]}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [field.key]: event.target.checked,
                }))
              }
            />
            {field.label}
          </label>
        ))}
      </div>

      {grantMutation.error ? (
        <p className="mt-3 text-xs text-rose-300">{grantMutation.error.message}</p>
      ) : null}
    </div>
  );
}

function MemberManagementRow({
  member,
  isExpanded,
  onToggle,
  productAccesses,
  products,
}: {
  member: MemberRecord;
  isExpanded: boolean;
  onToggle: () => void;
  productAccesses: ProductAccessRecord[];
  products: ProductRecord[];
}) {
  const utils = api.useUtils();
  const memberAccesses = productAccesses.filter((access) => access.userId === member.userId);
  const availableProducts = products.filter(
    (product) => !memberAccesses.some((access) => access.productId === product.id),
  );
  const canEditMembership = member.role !== "OWNER";

  const [roleDraft, setRoleDraft] = useState<ManagedRole>(
    member.role === "OWNER" ? "ADMIN" : member.role,
  );

  useEffect(() => {
    setRoleDraft(member.role === "OWNER" ? "ADMIN" : member.role);
  }, [member.role]);

  const updateMemberMutation = api.users.updateMember.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.users.listMembers.invalidate(),
        utils.users.listJoinRequests.invalidate(),
      ]);
    },
  });

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/25">
      <button
        type="button"
        className="w-full px-5 py-5 text-left transition hover:bg-white/5"
        onClick={onToggle}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-sky-400/10 text-sm font-semibold text-sky-100">
              {getInitials(member)}
            </div>
            <div>
              <p className="text-base font-semibold text-white">
                {getMemberDisplayName(member)}
              </p>
              <p className="mt-1 text-sm text-zinc-400">{getMemberSubtitle(member)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                roleBadgeClass(member.role),
              )}
            >
              {formatRole(member.role)}
            </span>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                statusBadgeClass(member.status),
              )}
            >
              {formatStatus(member.status)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              {memberAccesses.length} product{memberAccesses.length === 1 ? "" : "s"}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-500">
              Joined {formatDate(member.joinedAt)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white">
              {isExpanded ? "Hide" : "Manage"}
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </div>
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-white/10 px-5 py-5">
          <div className="grid gap-5 2xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  Membership summary
                </p>
                <div className="mt-4 space-y-3 text-sm text-zinc-300">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Member ID
                    </p>
                    <p className="mt-1 break-all text-white">{member.userId}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Created
                    </p>
                    <p className="mt-1 text-white">{formatDate(member.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Last updated
                    </p>
                    <p className="mt-1 text-white">{formatDate(member.updatedAt)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  Membership controls
                </p>
                {canEditMembership ? (
                  <>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                          Role
                        </label>
                        <select
                          className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                          value={roleDraft}
                          onChange={(event) =>
                            setRoleDraft(event.target.value as ManagedRole)
                          }
                        >
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {formatRole(role)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="h-10 rounded-xl border-sky-500/30 bg-sky-500 px-4 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
                          disabled={
                            roleDraft === member.role || updateMemberMutation.isPending
                          }
                          onClick={() =>
                            updateMemberMutation.mutate({
                              userId: member.userId,
                              role: roleDraft,
                            })
                          }
                        >
                          Save role
                        </Button>
                        <Button
                          className="h-10 rounded-xl border-emerald-500/30 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                          disabled={
                            member.status === "ACTIVE" || updateMemberMutation.isPending
                          }
                          onClick={() =>
                            updateMemberMutation.mutate({
                              userId: member.userId,
                              status: "ACTIVE",
                            })
                          }
                        >
                          {member.status === "PENDING" ? "Approve member" : "Set active"}
                        </Button>
                        <Button
                          className="h-10 rounded-xl border-rose-500/30 bg-rose-500/15 px-4 text-sm font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                          disabled={
                            member.status === "BLOCKED" || updateMemberMutation.isPending
                          }
                          onClick={() =>
                            updateMemberMutation.mutate({
                              userId: member.userId,
                              status: "BLOCKED",
                            })
                          }
                        >
                          Block member
                        </Button>
                      </div>
                    </div>

                    {updateMemberMutation.error ? (
                      <p className="mt-3 text-xs text-rose-300">
                        {updateMemberMutation.error.message}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-4 text-sm text-zinc-400">
                    Owner membership is protected here. View access can still be reviewed, but
                    role and status are locked.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                    Product access
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    Manage what this user can open
                  </h3>
                </div>
                <p className="text-sm text-zinc-400">
                  {memberAccesses.length} assigned / {products.length} available products
                </p>
              </div>

              <div className="mt-4">
                <GrantProductAccessForm
                  userId={member.userId}
                  availableProducts={availableProducts}
                />
              </div>

              <div className="mt-4 space-y-3">
                {memberAccesses.length ? (
                  memberAccesses.map((access) => (
                    <ProductAccessCard
                      key={access.id}
                      access={access}
                      userId={member.userId}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-zinc-500">
                    This member does not have any product access yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function UsersDashboard() {
  return null;
}
