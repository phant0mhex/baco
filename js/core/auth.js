// js/core/auth.js

// 1. VOS CLÉS D'API
const SUPABASE_URL = 'https://baco-inky.vercel.app/api-proxy';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbGphaGV5aW1penJ5ZGF6cnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTc1MDIsImV4cCI6MjA3NzQzMzUwMn0.nwMgm-ehAppq0WP-MK8459ZIvsWKjbJmsq6qL_t5sQo';

// 2. INITIALISATION ET EXPORTATION
const { createClient } = supabase;
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. LE GARDIEN (Modifié pour stocker le rôle)
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    sessionStorage.removeItem('userRole');
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage !== 'index.html' && currentPage !== 'reset-password.html') {
      window.location.href = 'index.html';
    } else {
      // Si on est sur index.html ou reset-password, on peut afficher la page
      document.body.style.visibility = 'visible';
    }
  } else {
    console.log("Session utilisateur trouvée.", session.user.email);
    const userRole = session.user.user_metadata?.role || 'user';
    sessionStorage.setItem('userRole', userRole);
    document.body.style.visibility = 'visible';
  }
})();