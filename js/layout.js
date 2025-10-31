// js/layout.js

// (Ce code est celui que vous aviez déjà)
document.addEventListener('DOMContentLoaded', () => {
  const navPlaceholder = document.getElementById('nav-placeholder');

  // --- NOUVELLE FONCTION ---
  // À appeler APRÈS que le HTML principal est chargé
  hideAdminElements();

  if (navPlaceholder) {
    fetch('_nav.html')
      .then(response => {
        if (!response.ok) throw new Error('Erreur de chargement du layout');
        return response.text();
      })
      .then(html => {
        navPlaceholder.innerHTML = html;
        highlightActiveLink();
        lucide.createIcons();

        loadNavAvatar();

        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
          logoutButton.onclick = async () => {
            sessionStorage.removeItem('userRole'); // Nettoyer le rôle
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
              console.error('Erreur de déconnexion:', error);
            } else {
              window.location.href = 'index.html';
            }
          };
        }
      })
      .catch(error => {
        console.error('Impossible de charger la navigation:', error);
        navPlaceholder.innerHTML = '<p class="text-center text-red-500">Erreur de chargement du menu.</p>';
      });
  }
});

function highlightActiveLink() {
  // ... (votre fonction highlightActiveLink reste inchangée)
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage) {
    const navLinksContainer = document.getElementById('nav-links');
    if (navLinksContainer) {
      const activeLink = navLinksContainer.querySelector(`a[href="${currentPage}"]`);
      if (activeLink) {
        activeLink.classList.add('bg-gray-700', 'font-bold');
      }
    }
  }
}


// --- NOUVELLE FONCTION ---
/**
 * Récupère l'avatar de l'utilisateur connecté et l'affiche dans la nav.
 */
async function loadNavAvatar() {
  const navAvatar = document.getElementById('nav-avatar');
  if (!navAvatar) return; // Si la nav n'est pas chargée, abandonner

  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return; // Pas connecté

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    if (data && data.avatar_url) {
      navAvatar.src = data.avatar_url;
    } else {
      // Optionnel : générer un avatar par défaut basé sur l'email
      // Pour l'instant, on garde le placeholder
    }
  } catch (error) {
    console.error("Impossible de charger l'avatar de la nav:", error.message);
  }
}

// --- NOUVELLE FONCTION ---
/**
 * Cache tous les éléments avec la classe 'admin-only' si l'utilisateur
 * n'est pas un admin (rôle récupéré depuis sessionStorage).
 */
function hideAdminElements() {
  const userRole = sessionStorage.getItem('userRole');

  if (userRole !== 'admin') {
    const adminElements = document.querySelectorAll('.admin-only');
    console.log(`Utilisateur 'user', masquage de ${adminElements.length} élément(s) admin.`);

    // On crée une règle CSS pour les cacher, c'est plus performant
    const style = document.createElement('style');
    style.innerHTML = '.admin-only { display: none !important; }';
    document.head.appendChild(style);

    // Note : pour les éléments générés dynamiquement (comme les cartes taxi),
    // il faut appeler cette fonction *après* leur génération.
  } else {
    console.log("Utilisateur 'admin', affichage de tous les éléments.");
  }
}