// js/auth.js

// 1. VOS CLÉS D'API
const SUPABASE_URL = 'https://baco-inky.vercel.app/api-proxy';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbGphaGV5aW1penJ5ZGF6cnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTc1MDIsImV4cCI6MjA3NzQzMzUwMn0.nwMgm-ehAppq0WP-MK8459ZIvsWKjbJmsq6qL_t5sQo';

// 2. INITIALISATION
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. LE GARDIEN (Modifié pour stocker le rôle)
(async () => {
  // On vérifie si on a une session active
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    // PAS DE SESSION = PAS CONNECTÉ
    // On nettoie le sessionStorage au cas où
    sessionStorage.removeItem('userRole');
    
    // Obtenir le nom de la page actuelle
    const currentPage = window.location.pathname.split('/').pop();
    
    // Ne pas rediriger si on est DÉJÀ sur index.html
    if (currentPage !== 'index.html') {
      alert("Vous n'êtes pas connecté. Redirection vers la page de connexion.");
      window.location.href = 'index.html';
    }
  } else {
    // L'utilisateur est connecté, on stocke son rôle
    console.log("Session utilisateur trouvée.", session.user.email);
    
    // Récupérer le rôle depuis user_metadata
    // S'il n'y a pas de métadonnées ou pas de rôle, on assigne 'user' par défaut
    const userRole = session.user.user_metadata?.role || 'user';
    
    // Stocker le rôle dans le sessionStorage pour y accéder depuis TOUTES les pages
    sessionStorage.setItem('userRole', userRole);

    // ===============================================
    // == NOUVELLE LIGNE : On révèle le contenu
    // ===============================================
    document.body.style.visibility = 'visible';

    
  }
})();