import type { User, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { getPrivySession } from "./privy";

const ADMIN_ROLES: UserRole[] = ["OWNER", "ADMIN"];

export type AppUser = Pick<User, "id" | "email" | "name" | "role" | "status" | "privyUserId">;

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const session = await getPrivySession();

  if (!session) {
    return null;
  }

  try {
    return await getPrisma().user.findUnique({
      where: { privyUserId: session.privyUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        privyUserId: true,
      },
    });
  } catch {
    return null;
  }
}

export async function requireActiveUser(requiredRoles?: UserRole[]) {
  const session = await getPrivySession();

  if (!session) {
    redirect("/login");
  }

  let user: AppUser | null = null;

  try {
    user = await getPrisma().user.findUnique({
      where: { privyUserId: session.privyUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        privyUserId: true,
      },
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
