import { type NextRequest, NextResponse } from 'next/server';

import { needsAccountToken } from './lib/account-routes';
import { auth0 } from './lib/auth0';

export async function proxy(request: NextRequest) {
  if (!auth0) return NextResponse.next();
  const authResponse = await auth0.middleware(request);
  if (!needsAccountToken(request.nextUrl.pathname)) return authResponse;
  const session = await auth0.getSession(request);
  if (!session) return authResponse;
  let token: string;
  try {
    ({ token } = await auth0.getAccessToken(request, authResponse));
  } catch {
    return authResponse;
  }
  const headers = new Headers(request.headers);
  headers.set('authorization', `Bearer ${token}`);
  const response = NextResponse.next({ request: { headers } });
  for (const cookie of authResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|sitemap.xml|robots.txt).*)',
  ],
};
