
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define the paths that require authentication
const protectedPaths = ['/', '/inventory', '/orders', '/logistics'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session-token');

  const isProtected = protectedPaths.some((path) => {
    if (path === '/') return pathname === path; // Exact match for root
    return pathname.startsWith(path); // StartsWith for nested routes
  });

  // If trying to access a protected route without a session token, redirect to login
  if (isProtected && !sessionToken) {
    console.log(`Middleware: No session token, redirecting from ${pathname} to /login`);
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If logged in and trying to access login page, redirect to dashboard
  if (sessionToken && pathname === '/login') {
     console.log(`Middleware: Session token exists, redirecting from /login to /`);
     const url = request.nextUrl.clone();
     url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Allow the request to proceed
  return NextResponse.next();
}

// Define the matcher to specify which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
