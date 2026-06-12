import type { User, UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["OWNER", "ADMIN"];

export type AppUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "status" | "zitadelUserId"
>;

const DEV_USER: AppUser = {
  id: "dev-shell-user",
  email: "cruz@vulpinehomes.com",
  name: "Cruz",
  role: "OWNER",
  status: "ACTIVE",
  zitadelUserId: null,
};

export async function getCurrentAppUser(): Promise<AppUser> {
  return DEV_USER;
}

export async function requireActiveUser(_requiredRoles?: UserRole[]) {
  return DEV_USER;
}

export function canAccessAdmin(role: UserRole) {
  return ADMIN_ROLES.includes(role);
}