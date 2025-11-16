import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();

  const supabase = createMiddlewareClient({ req, res }, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  const { data: { session } } = await supabase.auth.getSession();
  const userRole = session?.user?.user_metadata?.role || 'user';

  // Si l'utilisateur n'est pas admin, on le redirige.
  // La config "matcher" ci-dessous garantit que ce code
  // ne s'exécute QUE pour les pages admin.
  if (userRole !== 'admin') {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/accueil.html';
    return NextResponse.redirect(redirectUrl);
  }

  // L'utilisateur EST admin, on le laisse passer
  return res;
}

//
// --- AJOUTEZ CE BLOC À LA FIN DU FICHIER ---
//
// Cette config indique à Vercel de n'exécuter ce middleware
// QUE pour les trois pages listées.
export const config = {
  matcher: [
    '/admin.html',
    '/audit.html',
    '/statistiques.html',
  ],
};