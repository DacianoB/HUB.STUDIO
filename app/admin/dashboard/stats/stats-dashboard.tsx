"use client";

import { Download, MousePointerClick, Package2, Users } from "lucide-react";

import {
  ConsoleBadge,
  ConsoleEmpty,
  ConsoleSection,
  consoleInsetClassName,
  consoleMutedTextClassName,
} from "~/app/admin/_components/console-shell";
import { AdminShell } from "~/app/admin/dashboard/admin-shell";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: Date | null | undefined) {
  if (!value) return "No recent activity";
  return dateFormatter.format(value);
}

function roleTone(role: string) {
  if (role === "OWNER") return "accent";
  if (role === "ADMIN") return "success";
  return "neutral";
}

function statusTone(status: string) {
  if (status === "ACTIVE" || status === "PUBLISHED") return "success";
  if (status === "PENDING" || status === "DRAFT") return "warning";
  return "neutral";
}

export function StatsDashboard() {
  const statsQuery = api.stats.overview.useQuery();
  const data = statsQuery.data;
  const timelineMax = Math.max(...(data?.timeline.map((entry) => entry.trackedActions) ?? [1]));

  return (
    <AdminShell
      title="Stats"
      description="Track real product usage and user activity across the tenant without mixing reporting into product or membership setup."
    >
      {!data ? (
        <ConsoleEmpty
          title={statsQuery.isLoading ? "Loading stats" : "Stats are unavailable"}
          description="The tenant activity report could not be loaded."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className={cn(consoleInsetClassName, "p-4")}>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#c9b089]" />
                <p className="text-sm font-medium text-[#f4efe5]">Active members</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                {data.summary.activeMembers}
              </p>
            </div>

            <div className={cn(consoleInsetClassName, "p-4")}>
              <div className="flex items-center gap-2">
                <Package2 className="h-4 w-4 text-[#c9b089]" />
                <p className="text-sm font-medium text-[#f4efe5]">Published products</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                {data.summary.publishedProducts}
              </p>
            </div>

            <div className={cn(consoleInsetClassName, "p-4")}>
              <div className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-[#c9b089]" />
                <p className="text-sm font-medium text-[#f4efe5]">Tracked actions</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                {data.summary.trackedActions30d}
              </p>
              <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>Last 30 days</p>
            </div>

            <div className={cn(consoleInsetClassName, "p-4")}>
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-[#c9b089]" />
                <p className="text-sm font-medium text-[#f4efe5]">Downloads</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                {data.summary.downloads30d}
              </p>
              <p className={`mt-1 text-sm ${consoleMutedTextClassName}`}>Last 30 days</p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <ConsoleSection
              title="Activity over the last 14 days"
              description="Each bar reflects tracked interactions from product, asset, and step activity."
            >
              <div className="space-y-3">
                {data.timeline.map((entry) => (
                  <div key={entry.date} className="grid gap-2 lg:grid-cols-[84px_minmax(0,1fr)_180px] lg:items-center">
                    <p className={`text-sm ${consoleMutedTextClassName}`}>{entry.label}</p>
                    <div className="h-8 rounded-[10px] bg-[#141310]">
                      <div
                        className="h-full rounded-[10px] bg-[#8d7a56]"
                        style={{
                          width: `${Math.max(6, (entry.trackedActions / timelineMax) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className={`flex gap-4 text-sm ${consoleMutedTextClassName}`}>
                      <span>{entry.trackedActions} actions</span>
                      <span>{entry.registeredUsers} users</span>
                      <span>{entry.visitors} visitors</span>
                    </div>
                  </div>
                ))}
              </div>
            </ConsoleSection>

            <ConsoleSection
              title="30 day summary"
              description="The current reporting window covers the last 30 days of tracked usage."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className={cn(consoleInsetClassName, "p-4")}>
                  <p className="text-sm font-medium text-[#f4efe5]">Engaged users</p>
                  <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                    {data.summary.trackedUsers30d}
                  </p>
                </div>
                <div className={cn(consoleInsetClassName, "p-4")}>
                  <p className="text-sm font-medium text-[#f4efe5]">Visitor sessions</p>
                  <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                    {data.summary.visitorSessions30d}
                  </p>
                </div>
                <div className={cn(consoleInsetClassName, "p-4")}>
                  <p className="text-sm font-medium text-[#f4efe5]">Step completions</p>
                  <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                    {data.summary.completions30d}
                  </p>
                </div>
                <div className={cn(consoleInsetClassName, "p-4")}>
                  <p className="text-sm font-medium text-[#f4efe5]">Custom events</p>
                  <p className="mt-3 text-3xl font-semibold text-[#f4efe5]">
                    {data.summary.customEvents30d}
                  </p>
                </div>
              </div>
            </ConsoleSection>
          </div>

          <ConsoleSection
            title="Product performance"
            description="Sort order is based on tracked activity in the last 30 days."
          >
            {data.products.length ? (
              <div className="overflow-hidden rounded-[10px] border border-[#2e2b26]">
                <div className="divide-y divide-[#2a2823]">
                  {data.products.map((product) => (
                    <div
                      key={product.id}
                      className="grid gap-3 bg-[#171613] px-4 py-4 xl:grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,0.7fr))]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-[#f4efe5]">{product.name}</p>
                          <ConsoleBadge tone={statusTone(product.status)}>
                            {product.status}
                          </ConsoleBadge>
                          <ConsoleBadge tone="accent">{product.type.replaceAll("_", " ")}</ConsoleBadge>
                        </div>
                        <p className={`mt-2 text-sm ${consoleMutedTextClassName}`}>
                          {product.steps} steps, {product.assets} assets, {product.assignedUsers} assigned users
                        </p>
                      </div>

                      <div>
                        <p className={`text-sm ${consoleMutedTextClassName}`}>Actions</p>
                        <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                          {product.interactions30d}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${consoleMutedTextClassName}`}>Downloads</p>
                        <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                          {product.downloads30d}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${consoleMutedTextClassName}`}>Completions</p>
                        <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                          {product.completions30d}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${consoleMutedTextClassName}`}>Users</p>
                        <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                          {product.registeredUsers30d}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${consoleMutedTextClassName}`}>Last activity</p>
                        <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                          {formatDate(product.lastActivityAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ConsoleEmpty
                title="No products found"
                description="Product metrics will appear here once the tenant starts publishing items."
              />
            )}
          </ConsoleSection>

          <ConsoleSection
            title="Member activity"
            description="This view shows who has access and who is actually interacting with tenant content."
          >
            {data.members.length ? (
              <div className="overflow-hidden rounded-[10px] border border-[#2e2b26]">
                <div className="divide-y divide-[#2a2823]">
                  {data.members.map((member) => (
                    <div
                      key={member.userId}
                      className="grid gap-3 bg-[#171613] px-4 py-4 xl:grid-cols-[minmax(0,1fr)_120px_120px_110px_110px_120px_160px]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-[#f4efe5]">
                            {member.name ?? member.email ?? member.userId}
                          </p>
                          <ConsoleBadge tone={roleTone(member.role)}>{member.role}</ConsoleBadge>
                          <ConsoleBadge tone={statusTone(member.status)}>{member.status}</ConsoleBadge>
                        </div>
                        <p className={`mt-2 text-sm ${consoleMutedTextClassName}`}>
                          {member.email ?? "No email"}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${consoleMutedTextClassName}`}>Products</p>
                        <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                          {member.grantedProducts}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${consoleMutedTextClassName}`}>Actions</p>
                        <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                          {member.interactions30d}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${consoleMutedTextClassName}`}>Downloads</p>
                        <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                          {member.downloads30d}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${consoleMutedTextClassName}`}>Completions</p>
                        <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                          {member.completions30d}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm ${consoleMutedTextClassName}`}>Last activity</p>
                        <p className="mt-1 text-sm font-medium text-[#f4efe5]">
                          {formatDate(member.lastActivityAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ConsoleEmpty
                title="No member activity yet"
                description="User engagement will appear here once members start interacting with products."
              />
            )}
          </ConsoleSection>
        </div>
      )}
    </AdminShell>
  );
}
