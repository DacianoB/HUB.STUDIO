"use client";

import {
  BarChart3,
  Boxes,
  FileStack,
  LayoutDashboard,
  Palette,
  Users,
} from "lucide-react";

import { ConsoleShell } from "~/app/admin/_components/console-shell";

type AdminShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/dashboard/users", label: "Users", icon: Users },
  { href: "/admin/dashboard/products", label: "Products", icon: Boxes },
  { href: "/admin/dashboard/pages", label: "Pages", icon: FileStack },
  { href: "/admin/dashboard/stats", label: "Stats", icon: BarChart3 },
  { href: "/admin/dashboard/branding", label: "Branding", icon: Palette },
] as const;

export function AdminShell({
  title,
  description,
  children,
  actions,
}: AdminShellProps) {
  return (
    <ConsoleShell
      areaLabel="Tenant admin"
      homeHref="/admin/dashboard"
      title={title}
      description={description}
      navItems={[...NAV_ITEMS]}
      actions={actions}
      breadcrumbs={[
        { label: "Tenant admin", href: "/admin/dashboard" },
        { label: title },
      ]}
    >
      {children}
    </ConsoleShell>
  );
}
