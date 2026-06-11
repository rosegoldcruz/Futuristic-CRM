import type { User, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";

const ADMIN_ROLES: UserRole[] = ["OWNER", "ADMIN"];

export type AppUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "status" | "zitadelUserId"
>;

const APP_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  zitadelUserId: true,
} as const;

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return null;
  }

  try {
    return await getPrisma().user.findUnique({
      where: { email },
      select: APP_USER_SELECT,
    });
  } catch {
    return null;
  }
}

export async function requireActiveUser(requiredRoles?: UserRole[]) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  let user: AppUser | null = null;

  try {
    user = await getPrisma().user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: APP_USER_SELECT,
    });
  } catch {
    redirect("/access-pending");
  }

  if (!user) {
    redirect("/access-pending");
  }

  if (user.status !== "ACTIVE") {
    redirect("/access-pending");
  }

  if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
    redirect("/access-pending");
  }

  return user;
}

export function canAccessAdmin(role: UserRole) {
  return ADMIN_ROLES.includes(role);
}