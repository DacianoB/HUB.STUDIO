"use client";

import { useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  MailPlus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import {
  ConsoleBadge,
  ConsoleEmpty,
  ConsoleSection,
  consoleInputClassName,
  consoleInsetClassName,
  consoleMutedTextClassName,
  consoleSelectClassName,
} from "~/app/admin/_components/console-shell";
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
    image?: string | null;
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

type InviteRecord = {
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

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const actionButtonClassName =
  "h-10 rounded-[10px] border border-[#4b412f] bg-[#8d7a56] px-4 text-sm font-semibold text-[#15130f] hover:bg-[#9a8660] disabled:opacity-50";
const mutedButtonClassName =
  "h-10 rounded-[10px] border border-[#34312b] bg-[#1a1814] px-4 text-sm font-semibold text-[#f4efe5] hover:bg-[#221f1a] disabled:opacity-50";
const dangerButtonClassName =
  "h-10 rounded-[10px] border border-[#553531] bg-[#2a1816] px-4 text-sm font-semibold text-[#e2a8a1] hover:bg-[#311d1a] disabled:opacity-50";

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

function getMemberInitials(member: MemberRecord) {
  const source = member.user.name?.trim() || member.user.email || member.userId;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

function roleTone(role: TenantRole) {
  if (role === "OWNER") return "accent";
  if (role === "ADMIN") return "success";
  return "neutral";
}

function statusTone(status: MembershipStatus) {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING") return "warning";
  return "danger";
}

function ProductAccessEditor({
  access,
  userId,
}: {
  access: ProductAccessRecord;
  userId: string;
}) {
  const utils = api.useUtils();
  const [canView, setCanView] = useState(access.canView);
  const [canDownload, setCanDownload] = useState(access.canDownload);
  const [canEditProgress, setCanEditProgress] = useState(access.canEditProgress);

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
    canView !== access.canView ||
    canDownload !== access.canDownload ||
    canEditProgress !== access.canEditProgress;

  return (
    <div className={cn(consoleInsetClassName, "p-4")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#f4efe5]">{access.product.name}</p>
          <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
            {access.product.type.replaceAll("_", " ")}
            {access.product.slug ? ` / ${access.product.slug}` : ""}
          </p>
        </div>
        <p className={`text-sm ${consoleMutedTextClassName}`}>
          Updated {formatDate(access.updatedAt)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-[#f4efe5]">
          <input
            type="checkbox"
            checked={canView}
            onChange={(event) => setCanView(event.target.checked)}
          />
          View
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-[#f4efe5]">
          <input
            type="checkbox"
            checked={canDownload}
            onChange={(event) => setCanDownload(event.target.checked)}
          />
          Download
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-[#f4efe5]">
          <input
            type="checkbox"
            checked={canEditProgress}
            onChange={(event) => setCanEditProgress(event.target.checked)}
          />
          Edit progress
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          className={actionButtonClassName}
          disabled={!isDirty || saveMutation.isPending}
          onClick={() =>
            saveMutation.mutate({
              userId,
              productId: access.productId,
              canView,
              canDownload,
              canEditProgress,
            })
          }
        >
          Save access
        </Button>
        <Button
          className={dangerButtonClassName}
          disabled={revokeMutation.isPending}
          onClick={() =>
            revokeMutation.mutate({
              userId,
              productId: access.productId,
            })
          }
        >
          Remove
        </Button>
      </div>

      {saveMutation.error ? (
        <p className="mt-3 text-sm text-[#e2a8a1]">{saveMutation.error.message}</p>
      ) : null}
      {revokeMutation.error ? (
        <p className="mt-3 text-sm text-[#e2a8a1]">{revokeMutation.error.message}</p>
      ) : null}
    </div>
  );
}

function GrantAccessForm({
  userId,
  products,
}: {
  userId: string;
  products: ProductRecord[];
}) {
  const utils = api.useUtils();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [canView, setCanView] = useState(true);
  const [canDownload, setCanDownload] = useState(true);
  const [canEditProgress, setCanEditProgress] = useState(false);
  const activeProductId = products.some((product) => product.id === productId)
    ? productId
    : (products[0]?.id ?? "");

  const grantMutation = api.users.grantProductAccess.useMutation({
    onSuccess: async () => {
      setCanView(true);
      setCanDownload(true);
      setCanEditProgress(false);
      await utils.users.listProductAccesses.invalidate();
    },
  });

  return (
    <div className={cn(consoleInsetClassName, "p-4")}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <select
          className={consoleSelectClassName}
          value={activeProductId}
          onChange={(event) => setProductId(event.target.value)}
          disabled={!products.length}
        >
          {products.length ? null : <option value="">All products already assigned</option>}
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <Button
          className={actionButtonClassName}
          disabled={!activeProductId || grantMutation.isPending}
          onClick={() =>
            grantMutation.mutate({
              userId,
              productId: activeProductId,
              canView,
              canDownload,
              canEditProgress,
            })
          }
        >
          Grant product access
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-[#f4efe5]">
          <input
            type="checkbox"
            checked={canView}
            onChange={(event) => setCanView(event.target.checked)}
          />
          View
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-[#f4efe5]">
          <input
            type="checkbox"
            checked={canDownload}
            onChange={(event) => setCanDownload(event.target.checked)}
          />
          Download
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-[#f4efe5]">
          <input
            type="checkbox"
            checked={canEditProgress}
            onChange={(event) => setCanEditProgress(event.target.checked)}
          />
          Edit progress
        </label>
      </div>

      {grantMutation.error ? (
        <p className="mt-3 text-sm text-[#e2a8a1]">{grantMutation.error.message}</p>
      ) : null}
    </div>
  );
}

export function UsersDashboard() {
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MembershipStatus>("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | TenantRole>("ALL");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ManagedRole>("MEMBER");
  const [unlockEmail, setUnlockEmail] = useState("");
  const [unlockRole, setUnlockRole] = useState<ManagedRole>("MEMBER");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, ManagedRole>>({});

  const currentTenantQuery = api.tenants.current.useQuery(undefined, {
    retry: false,
  });
  const membersQuery = api.users.listMembers.useQuery();
  const joinRequestsQuery = api.users.listJoinRequests.useQuery();
  const invitesQuery = api.tenants.listInvites.useQuery();
  const productAccessesQuery = api.users.listProductAccesses.useQuery();
  const productsQuery = api.products.list.useQuery();

  const inviteMutation = api.tenants.inviteByEmail.useMutation({
    onSuccess: async () => {
      setInviteEmail("");
      await Promise.all([
        utils.tenants.listInvites.invalidate(),
        utils.users.listJoinRequests.invalidate(),
        utils.tenants.current.invalidate(),
      ]);
    },
  });
  const unlockMutation = api.tenants.unlockByEmail.useMutation({
    onSuccess: async () => {
      setUnlockEmail("");
      await Promise.all([
        utils.tenants.listInvites.invalidate(),
        utils.users.listJoinRequests.invalidate(),
        utils.users.listMembers.invalidate(),
        utils.tenants.current.invalidate(),
      ]);
    },
  });
  const updateMemberMutation = api.users.updateMember.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.users.listMembers.invalidate(),
        utils.users.listJoinRequests.invalidate(),
      ]);
    },
  });
  const approveJoinRequestMutation = api.users.approveJoinRequest.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.users.listJoinRequests.invalidate(),
        utils.users.listMembers.invalidate(),
        utils.tenants.current.invalidate(),
      ]);
    },
  });

  const members = (membersQuery.data ?? []) as MemberRecord[];
  const productAccesses = (productAccessesQuery.data ?? []) as ProductAccessRecord[];
  const products = (productsQuery.data ?? []) as ProductRecord[];
  const pendingMemberships =
    (joinRequestsQuery.data?.pendingMemberships ?? []) as MemberRecord[];
  const pendingInvites = (joinRequestsQuery.data?.pendingInvites ?? []) as InviteRecord[];
  const allInvites = (invitesQuery.data ?? []) as InviteRecord[];

  const filteredMembers = members.filter((member) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      getMemberDisplayName(member).toLowerCase().includes(query) ||
      getMemberSubtitle(member).toLowerCase().includes(query);
    const matchesStatus = statusFilter === "ALL" || member.status === statusFilter;
    const matchesRole = roleFilter === "ALL" || member.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });
  const activeSelectedMemberId = filteredMembers.some(
    (member) => member.userId === selectedMemberId,
  )
    ? selectedMemberId
    : (filteredMembers[0]?.userId ?? "");
  const selectedMember =
    filteredMembers.find((member) => member.userId === activeSelectedMemberId) ??
    members.find((member) => member.userId === activeSelectedMemberId) ??
    null;
  const selectedMemberAccesses = selectedMember
    ? productAccesses.filter((access) => access.userId === selectedMember.userId)
    : [];
  const availableProducts = selectedMember
    ? products.filter(
        (product) =>
          !selectedMemberAccesses.some((access) => access.productId === product.id),
      )
    : [];
  const selectedRoleDraft = selectedMember
    ? (roleDrafts[selectedMember.userId] ??
      (selectedMember.role === "OWNER" ? "MEMBER" : selectedMember.role))
    : "MEMBER";

  const activeMembers = members.filter((member) => member.status === "ACTIVE").length;
  const outstandingInvites = allInvites.filter((invite) => invite.status !== "BLOCKED").length;

  return (
    <AdminShell
      title="Users"
      description="Manage the tenant directory without mixing approvals, invitations, and product permissions into a single crowded page."
    >
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <ConsoleSection
            title="Directory"
            description="Search the current member list and open one person at a time for role and access changes."
          >
            <div className="grid gap-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7f7769]" />
                  <input
                    className={cn(consoleInputClassName, "pl-9")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name or email"
                  />
                </label>

                <select
                  className={consoleSelectClassName}
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "ALL" | MembershipStatus)
                  }
                >
                  {statusFilters.map((status) => (
                    <option key={status} value={status}>
                      {status === "ALL" ? "All statuses" : formatStatus(status)}
                    </option>
                  ))}
                </select>

                <select
                  className={consoleSelectClassName}
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as "ALL" | TenantRole)}
                >
                  {roleFilters.map((role) => (
                    <option key={role} value={role}>
                      {role === "ALL" ? "All roles" : formatRole(role)}
                    </option>
                  ))}
                </select>
              </div>

              {filteredMembers.length ? (
                <div className="overflow-hidden rounded-[10px] border border-[#2e2b26]">
                  <div className="divide-y divide-[#2a2823]">
                    {filteredMembers.map((member) => {
                      const isSelected = member.userId === activeSelectedMemberId;
                      const accessCount = productAccesses.filter(
                        (access) => access.userId === member.userId,
                      ).length;

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setSelectedMemberId(member.userId)}
                          className={cn(
                            "flex w-full flex-col gap-3 px-4 py-4 text-left transition lg:flex-row lg:items-center lg:justify-between",
                            isSelected ? "bg-[#201d18]" : "bg-[#171613] hover:bg-[#1d1a16]",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#312d27] bg-[#11100d] text-sm font-semibold text-[#f4efe5]">
                              {getMemberInitials(member)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#f4efe5]">
                                {getMemberDisplayName(member)}
                              </p>
                              <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                                {getMemberSubtitle(member)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <ConsoleBadge tone={roleTone(member.role)}>
                              {formatRole(member.role)}
                            </ConsoleBadge>
                            <ConsoleBadge tone={statusTone(member.status)}>
                              {formatStatus(member.status)}
                            </ConsoleBadge>
                            <span className={`text-sm ${consoleMutedTextClassName}`}>
                              {accessCount} product{accessCount === 1 ? "" : "s"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <ConsoleEmpty
                  title="No members matched the current filters"
                  description="Try a different search or clear the role and status filters."
                />
              )}
            </div>
          </ConsoleSection>

          <ConsoleSection
            title="Selected user"
            description="Edit one membership at a time so access changes stay readable."
          >
            {selectedMember ? (
              <div className="space-y-4">
                <div className={cn(consoleInsetClassName, "p-4")}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-[#312d27] bg-[#11100d] text-sm font-semibold text-[#f4efe5]">
                      {getMemberInitials(selectedMember)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-[#f4efe5]">
                        {getMemberDisplayName(selectedMember)}
                      </p>
                      <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                        {getMemberSubtitle(selectedMember)}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                      <dt className={consoleMutedTextClassName}>Joined</dt>
                      <dd className="text-[#f4efe5]">{formatDate(selectedMember.joinedAt)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                      <dt className={consoleMutedTextClassName}>Status</dt>
                      <dd>
                        <ConsoleBadge tone={statusTone(selectedMember.status)}>
                          {formatStatus(selectedMember.status)}
                        </ConsoleBadge>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-[#2a2823] pt-3">
                      <dt className={consoleMutedTextClassName}>Role</dt>
                      <dd>
                        <ConsoleBadge tone={roleTone(selectedMember.role)}>
                          {formatRole(selectedMember.role)}
                        </ConsoleBadge>
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className={cn(consoleInsetClassName, "p-4")}>
                  <div className="grid gap-3">
                    <label className="grid gap-2">
                      <span className={`text-sm ${consoleMutedTextClassName}`}>Membership role</span>
                      <select
                        className={consoleSelectClassName}
                        value={selectedRoleDraft}
                        onChange={(event) =>
                          setRoleDrafts((current) => ({
                            ...current,
                            [selectedMember.userId]: event.target.value as ManagedRole,
                          }))
                        }
                        disabled={selectedMember.role === "OWNER"}
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {formatRole(role)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        className={actionButtonClassName}
                        disabled={
                          selectedMember.role === "OWNER" ||
                          selectedRoleDraft === selectedMember.role ||
                          updateMemberMutation.isPending
                        }
                        onClick={() =>
                          updateMemberMutation.mutate({
                            userId: selectedMember.userId,
                            role: selectedRoleDraft,
                          })
                        }
                      >
                        Save role
                      </Button>
                      <Button
                        className={mutedButtonClassName}
                        disabled={
                          selectedMember.status === "ACTIVE" || updateMemberMutation.isPending
                        }
                        onClick={() =>
                          updateMemberMutation.mutate({
                            userId: selectedMember.userId,
                            status: "ACTIVE",
                          })
                        }
                      >
                        Set active
                      </Button>
                      <Button
                        className={dangerButtonClassName}
                        disabled={
                          selectedMember.role === "OWNER" ||
                          selectedMember.status === "BLOCKED" ||
                          updateMemberMutation.isPending
                        }
                        onClick={() =>
                          updateMemberMutation.mutate({
                            userId: selectedMember.userId,
                            status: "BLOCKED",
                          })
                        }
                      >
                        Block user
                      </Button>
                    </div>

                    {selectedMember.role === "OWNER" ? (
                      <p className={`text-sm ${consoleMutedTextClassName}`}>
                        Owner access stays protected here. Product permissions can still be
                        reviewed below.
                      </p>
                    ) : null}

                    {updateMemberMutation.error ? (
                      <p className="text-sm text-[#e2a8a1]">
                        {updateMemberMutation.error.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-[#f4efe5]">Product access</p>
                    <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                      Assign only the products this user should be able to open.
                    </p>
                  </div>

                  <GrantAccessForm userId={selectedMember.userId} products={availableProducts} />

                  {selectedMemberAccesses.length ? (
                    <div className="space-y-3">
                      {selectedMemberAccesses.map((access) => (
                        <ProductAccessEditor
                          key={`${access.id}-${access.updatedAt.toISOString()}-${access.canView}-${access.canDownload}-${access.canEditProgress}`}
                          access={access}
                          userId={selectedMember.userId}
                        />
                      ))}
                    </div>
                  ) : (
                    <ConsoleEmpty
                      title="No product access assigned yet"
                      description="Use the form above to grant access to one of the available products."
                    />
                  )}
                </div>
              </div>
            ) : (
              <ConsoleEmpty
                title="No member selected"
                description="Choose someone from the directory to manage role, status, and product access."
              />
            )}
          </ConsoleSection>
        </div>
        
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <ConsoleSection
            title="Requests and queue"
            description="Keep approvals separate from the main member directory so pending items are easier to resolve."
          >
            <div className="space-y-4">
              <div className={cn(consoleInsetClassName, "p-4")}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#c9b089]" />
                    <p className="text-sm font-medium text-[#f4efe5]">Pending join requests</p>
                  </div>
                  <ConsoleBadge tone={pendingMemberships.length ? "warning" : "success"}>
                    {pendingMemberships.length}
                  </ConsoleBadge>
                </div>

                {pendingMemberships.length ? (
                  <div className="space-y-3">
                    {pendingMemberships.map((member) => (
                      <div
                        key={member.id}
                        className="flex flex-col gap-3 border-t border-[#2a2823] pt-3 first:border-t-0 first:pt-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#f4efe5]">
                            {getMemberDisplayName(member)}
                          </p>
                          <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                            {getMemberSubtitle(member)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            className={actionButtonClassName}
                            disabled={approveJoinRequestMutation.isPending}
                            onClick={() =>
                              approveJoinRequestMutation.mutate({
                                userId: member.userId,
                                role: "MEMBER",
                              })
                            }
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            className={dangerButtonClassName}
                            disabled={updateMemberMutation.isPending}
                            onClick={() =>
                              updateMemberMutation.mutate({
                                userId: member.userId,
                                status: "BLOCKED",
                              })
                            }
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ConsoleEmpty
                    title="No join requests"
                    description="New membership requests will appear here when the tenant is using approval mode."
                  />
                )}
              </div>

              <div className={cn(consoleInsetClassName, "p-4")}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MailPlus className="h-4 w-4 text-[#c9b089]" />
                    <p className="text-sm font-medium text-[#f4efe5]">Pending invites</p>
                  </div>
                  <ConsoleBadge tone={pendingInvites.length ? "warning" : "success"}>
                    {pendingInvites.length}
                  </ConsoleBadge>
                </div>

                {pendingInvites.length ? (
                  <div className="space-y-3">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between gap-3 border-t border-[#2a2823] pt-3 first:border-t-0 first:pt-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#f4efe5]">{invite.email}</p>
                          <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                            {formatRole(invite.role)} invited on {formatDate(invite.createdAt)}
                          </p>
                        </div>
                        <ConsoleBadge tone="warning">{formatStatus(invite.status)}</ConsoleBadge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ConsoleEmpty
                    title="No pending invites"
                    description="Invite activity will appear here after you send access to new people."
                  />
                )}
              </div>

              {approveJoinRequestMutation.error ? (
                <p className="text-sm text-[#e2a8a1]">
                  {approveJoinRequestMutation.error.message}
                </p>
              ) : null}
            </div>
          </ConsoleSection>

          <ConsoleSection
            title="Invite and unlock"
            description="Invite a future user by email or unlock immediate access for someone who should enter the tenant right away."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <div className={cn(consoleInsetClassName, "p-4")}>
                <div className="flex items-center gap-2">
                  <MailPlus className="h-4 w-4 text-[#c9b089]" />
                  <p className="text-sm font-medium text-[#f4efe5]">Send invitation</p>
                </div>
                <div className="mt-4 grid gap-3">
                  <input
                    className={consoleInputClassName}
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="name@company.com"
                  />
                  <select
                    className={consoleSelectClassName}
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as ManagedRole)}
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {formatRole(role)}
                      </option>
                    ))}
                  </select>
                  <Button
                    className={actionButtonClassName}
                    disabled={!inviteEmail.trim() || inviteMutation.isPending}
                    onClick={() =>
                      inviteMutation.mutate({
                        email: inviteEmail.trim(),
                        role: inviteRole,
                      })
                    }
                  >
                    Send invite
                  </Button>
                </div>
                {inviteMutation.error ? (
                  <p className="mt-3 text-sm text-[#e2a8a1]">{inviteMutation.error.message}</p>
                ) : null}
              </div>

              <div className={cn(consoleInsetClassName, "p-4")}>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[#c9b089]" />
                  <p className="text-sm font-medium text-[#f4efe5]">Unlock immediate access</p>
                </div>
                <div className="mt-4 grid gap-3">
                  <input
                    className={consoleInputClassName}
                    type="email"
                    value={unlockEmail}
                    onChange={(event) => setUnlockEmail(event.target.value)}
                    placeholder="name@company.com"
                  />
                  <select
                    className={consoleSelectClassName}
                    value={unlockRole}
                    onChange={(event) => setUnlockRole(event.target.value as ManagedRole)}
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {formatRole(role)}
                      </option>
                    ))}
                  </select>
                  <Button
                    className={mutedButtonClassName}
                    disabled={!unlockEmail.trim() || unlockMutation.isPending}
                    onClick={() =>
                      unlockMutation.mutate({
                        email: unlockEmail.trim(),
                        role: unlockRole,
                      })
                    }
                  >
                    Unlock access
                  </Button>
                </div>
                {unlockMutation.error ? (
                  <p className="mt-3 text-sm text-[#e2a8a1]">{unlockMutation.error.message}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              <div className={cn(consoleInsetClassName, "p-4")}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#c9b089]" />
                  <p className="text-sm font-medium text-[#f4efe5]">Active members</p>
                </div>
                <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">{activeMembers}</p>
              </div>

              <div className={cn(consoleInsetClassName, "p-4")}>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#c9b089]" />
                  <p className="text-sm font-medium text-[#f4efe5]">Queue items</p>
                </div>
                <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                  {pendingMemberships.length + pendingInvites.length}
                </p>
              </div>

              <div className={cn(consoleInsetClassName, "p-4")}>
                <div className="flex items-center gap-2">
                  <MailPlus className="h-4 w-4 text-[#c9b089]" />
                  <p className="text-sm font-medium text-[#f4efe5]">Outstanding invites</p>
                </div>
                <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                  {outstandingInvites}
                </p>
              </div>

              <div className={cn(consoleInsetClassName, "p-4")}>
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-[#c9b089]" />
                  <p className="text-sm font-medium text-[#f4efe5]">Member cap</p>
                </div>
                <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                  {currentTenantQuery.data?.policy?.maxActiveMembers ?? "Unlimited"}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium text-[#f4efe5]">Recent invite activity</p>
              {allInvites.length ? (
                <div className="mt-3 overflow-hidden rounded-[10px] border border-[#2e2b26]">
                  <div className="divide-y divide-[#2a2823]">
                    {allInvites.slice(0, 6).map((invite) => (
                      <div
                        key={invite.id}
                        className="flex flex-col gap-3 bg-[#171613] px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#f4efe5]">{invite.email}</p>
                          <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>
                            {formatRole(invite.role)} / {formatDate(invite.createdAt)}
                          </p>
                        </div>
                        <ConsoleBadge tone={statusTone(invite.status)}>
                          {formatStatus(invite.status)}
                        </ConsoleBadge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <ConsoleEmpty
                    title="No invite history yet"
                    description="The latest invitation activity will appear here once the tenant starts adding people."
                  />
                </div>
              )}
            </div>
          </ConsoleSection>
        </div>
      </div>
    </AdminShell>
  );
}
