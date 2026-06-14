import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;

    // Allow auth API routes, login, logout, access-pending, and home
    if (
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/email-engine/unsubscribe") ||
      pathname.startsWith("/api/intake/vulpine-supply") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/logout") ||
      pathname.startsWith("/access-pending") ||
      pathname === "/"
    ) {
      return NextResponse.next();
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Public paths — no auth required
        if (
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/email-engine/unsubscribe") ||
          pathname.startsWith("/api/intake/vulpine-supply") ||
          pathname.startsWith("/login") ||
          pathname.startsWith("/logout") ||
          pathname.startsWith("/access-pending") ||
          pathname === "/"
        ) {
          return true;
        }

        // All other routes require authentication
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
