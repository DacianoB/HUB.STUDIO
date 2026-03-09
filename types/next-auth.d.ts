import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isGlobalAdmin?: boolean;
      activeTenantId?: string | null;
      tenantRole?: "OWNER" | "ADMIN" | "INSTRUCTOR" | "MEMBER" | null;
    };
    activeTenant?: {
      id: string;
      slug: string;
      name: string;
      isOpen: boolean;
    } | null;
  }
}
