"use client";

import { useState } from "react";
import { ShieldCheck, UserPlus, Users } from "lucide-react";

import { AdminShell } from "~/app/admin/dashboard/admin-shell";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function UsersDashboard() {
  const utils = api.useUtils();
  const membersQuery = api.users.listMembers.useQuery();
  const joinRequestsQuery = api.users.listJoinRequests.useQuery();
  const productsQuery = api.products.list.useQuery();
  const productAccessesQuery = api.users.listProductAccesses.useQuery();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "INSTRUCTOR" | "MEMBER">(
    "MEMBER"
  );
  const [unlockEmail, setUnlockEmail] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");

  const inviteMutation = api.tenants.inviteByEmail.useMutation({
    onSuccess: async () => {
      setInviteEmail("");
      await Promise.all([
        utils.users.listJoinRequests.invalidate(),
        utils.users.listMembers.invalidate(),
      ]);
    },
  });
  const unlockMutation = api.tenants.unlockByEmail.useMutation({
    onSuccess: async () => {
      setUnlockEmail("");
      await Promise.all([
        utils.users.listMembers.invalidate(),
        utils.users.listJoinRequests.invalidate(),
      ]);
    },
  });
  const grantAccessMutation = api.users.grantProductAccess.useMutation({
    onSuccess: async () => {
      await utils.users.listProductAccesses.invalidate();
    },
  });

  return (
    <AdminShell
      title="Users"
      description="Invite members, manage access, and keep tenant membership under control."
    >
      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-300" />
              <p className="text-sm font-medium text-white">Active members</p>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">
              {membersQuery.data?.length ?? 0}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-300" />
              <p className="text-sm font-medium text-white">Pending invites</p>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">
              {joinRequestsQuery.data?.pendingInvites.length ?? 0}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-fuchsia-300" />
              <p className="text-sm font-medium text-white">Product accesses</p>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">
              {productAccessesQuery.data?.length ?? 0}
            </p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <h2 className="text-lg font-semibold text-white">Invite user</h2>
              <div className="mt-4 space-y-3">
                <input
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                  placeholder="email@company.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
                <select
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(
                      event.target.value as "ADMIN" | "INSTRUCTOR" | "MEMBER"
                    )
                  }
                >
                  <option value="MEMBER">Member</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <Button
                  className="h-11 w-full rounded-xl border-sky-500/30 bg-sky-500 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
                  disabled={!inviteEmail || inviteMutation.isPending}
                  onClick={() =>
                    inviteMutation.mutate({
                      email: inviteEmail,
                      role: inviteRole,
                    })
                  }
                >
                  Send invite
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <h2 className="text-lg font-semibold text-white">Unlock user</h2>
              <div className="mt-4 space-y-3">
                <input
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                  placeholder="email@company.com"
                  value={unlockEmail}
                  onChange={(event) => setUnlockEmail(event.target.value)}
                />
                <Button
                  className="h-11 w-full rounded-xl border-cyan-500/30 bg-cyan-500 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
                  disabled={!unlockEmail || unlockMutation.isPending}
                  onClick={() =>
                    unlockMutation.mutate({
                      email: unlockEmail,
                      role: inviteRole,
                    })
                  }
                >
                  Unlock membership
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <h2 className="text-lg font-semibold text-white">Grant product access</h2>
              <div className="mt-4 space-y-3">
                <select
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                >
                  <option value="">Select member...</option>
                  {(membersQuery.data ?? []).map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.user.email ?? member.userId}
                    </option>
                  ))}
                </select>
                <select
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                >
                  <option value="">Select product...</option>
                  {(productsQuery.data ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <Button
                  className="h-11 w-full rounded-xl border-emerald-500/30 bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                  disabled={
                    !selectedMemberId || !selectedProductId || grantAccessMutation.isPending
                  }
                  onClick={() =>
                    grantAccessMutation.mutate({
                      userId: selectedMemberId,
                      productId: selectedProductId,
                      canView: true,
                      canDownload: true,
                      canEditProgress: false,
                    })
                  }
                >
                  Grant access
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <h2 className="text-lg font-semibold text-white">Pending queue</h2>
              <div className="mt-4 space-y-2">
                {(joinRequestsQuery.data?.pendingInvites ?? []).map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300"
                  >
                    Invite: {invite.email} · {invite.role} · {invite.status}
                  </div>
                ))}
                {(joinRequestsQuery.data?.pendingMemberships ?? []).map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300"
                  >
                    Request: {request.user.email ?? request.user.id} · {request.role}
                  </div>
                ))}
                {!joinRequestsQuery.data?.pendingInvites.length &&
                !joinRequestsQuery.data?.pendingMemberships.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
                    No pending requests.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <h2 className="text-lg font-semibold text-white">Current members</h2>
              <div className="mt-4 space-y-2">
                {(membersQuery.data ?? []).map((member) => (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-white">
                      {member.user.email ?? member.userId}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {member.role} · {member.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <h2 className="text-lg font-semibold text-white">Recent product access</h2>
              <div className="mt-4 space-y-2">
                {(productAccessesQuery.data ?? []).slice(0, 10).map((access) => (
                  <div
                    key={access.id}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300"
                  >
                    {access.user.email ?? access.userId} → {access.product.name}
                  </div>
                ))}
                {!productAccessesQuery.data?.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
                    No product access records yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
