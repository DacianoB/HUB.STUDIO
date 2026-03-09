"use client";

import { api } from "~/trpc/react";

export function HealthPanel() {
  const { data, isLoading } = api.health.ping.useQuery();

  return (
    <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-xs text-zinc-300">
      {isLoading ? "Checking API..." : `tRPC: ${data?.ok ? "online" : "offline"} (${data?.ts ?? "-"})`}
    </div>
  );
}
