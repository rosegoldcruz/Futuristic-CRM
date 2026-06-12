import type { User, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth/auth";
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
  const session = await getServerSession(getAuthOptions());
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

export async function requireActiveUser(
  requiredRoles?: UserRole[]
): Promise<AppUser> {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "ACTIVE") {
    redirect("/access-pending");
  }

  if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    redirect("/access-pending");
  }

  return user;
}

export function canAccessAdmin(role: UserRole) {
  return ADMIN_ROLES.includes(role);
}
