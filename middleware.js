import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();

  const supabase = createMiddlewareClient({ req, res }, {
    // --- MODIFICATION ICI ---
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
    // --- FIN MODIFICATION ---
  });

  const { data: { session } } = await supabase.auth.getSession();
  const userRole = session?.user?.user_metadata?.role || 'user';

  if (userRole !== 'admin') {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/accueil.html';
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/admin.html',
    '/audit.html',
    '/statistiques.html',
  ],
};