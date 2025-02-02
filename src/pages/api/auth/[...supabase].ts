import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import logger from '@/services/server-logger';

export async function middleware(req: NextRequest) {
  try {
    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });

    // Refresh session if expired
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        logger.error(error.message);
        throw error;
      }
      logger.info('Session refreshed successfully');
    }

    return res;
  } catch (error) {
    logger.error((error as Error).message);
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }
}

// Ensure the middleware is only called for relevant paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - auth folder (allow public access to auth pages)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|auth).*)',
  ],
}; 