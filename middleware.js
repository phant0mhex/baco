import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  // Crée une réponse pour pouvoir la modifier
  const res = NextResponse.next();

  // Crée un client Supabase pour le contexte du Middleware
  const supabase = createMiddlewareClient({ req, res }, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  // Récupère la session en cours en lisant le cookie
  const { data: { session } } = await supabase.auth.getSession();

  // Récupère le rôle de l'utilisateur (comme dans votre layout.js)
  const userRole = session?.user?.user_metadata?.role || 'user';

  // Définir les pages admin protégées
  const adminPaths = [
    '/admin.html',
    '/audit.html',
    '/statistiques.html'
  ];

  // Si l'utilisateur tente d'accéder à une page admin
  if (adminPaths.includes(req.nextUrl.pathname)) {
    // Et s'il n'est PAS admin
    if (userRole !== 'admin') {
      // Redirige vers la page d'accueil
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/accueil.html';
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Si tout va bien, laisser la requête continuer
  return res;
}