import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/logout",
  "/access-pending",
]);

const PROTECTED_ROUTES = new Set([
  "/dashboard",
  "/email-engine",
  "/email-engine/overview",
  "/email-engine/contacts",
  "/email-engine/companies",
  "/email-engine/lists",
  "/email-engine/templates",
  "/email-engine/campaigns",
  "/email-engine/queue",
  "/email-engine/exports",
  "/email-engine/deliverability",
  "/email-engine/compliance",
  "/email-engine/settings",
  "/bid-opportunities",
  "/quote-pipeline",
  "/suppliers",
  "/projects",
  "/planhub",
  "/zoominfo",
  "/buildingconnected",
  "/import-center",
  "/activity-log",
  "/compliance-center",
  "/settings",
  "/admin/users",
]);

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  if (PROTECTED_ROUTES.has(pathname)) {
    if (!request.auth) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};