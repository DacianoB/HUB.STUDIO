"use client";

import { Building2 } from "lucide-react";

import { ConsoleShell } from "~/app/admin/_components/console-shell";

type GlobalAdminShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

const NAV_ITEMS = [
  {
    href: "/admin/global/tenants",
    label: "Tenants",
    icon: Building2,
  },
] as const;

export function GlobalAdminShell({
  title,
  description,
  children,
  actions,
}: GlobalAdminShellProps) {
  return (
    <ConsoleShell
      areaLabel="Global admin"
      homeHref="/admin/global/tenants"
      title={title}
      description={description}
      navItems={[...NAV_ITEMS]}
      actions={actions}
      breadcrumbs={[
        { label: "Global admin", href: "/admin/global/tenants" },
        { label: title },
      ]}
    >
      {children}
    </ConsoleShell>
  );
}
