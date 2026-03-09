"use client";

import posthog from "posthog-js";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

import { GlobalAdminNavbar } from "~/app/_components/global-admin-navbar";
import { TRPCReactProvider } from "~/trpc/react";

function AnalyticsBootstrap() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      person_profiles: "always",
    });
  }, []);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCReactProvider>
        <AnalyticsBootstrap />
        <GlobalAdminNavbar />
        {children}
      </TRPCReactProvider>
    </SessionProvider>
  );
}
