import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — no auth required
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/mcp") || // MCP uses its own API key auth
    pathname.startsWith("/p/") ||      // public share viewer pages
    pathname === "/" ||
    pathname === "/opengraph-image" ||
    pathname === "/twitter-image";

  if (isPublic) return NextResponse.next();

  // Check for session cookie
  const session = req.cookies.get("pk-session")?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
