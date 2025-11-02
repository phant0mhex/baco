// js/layout.js

document.addEventListener('DOMContentLoaded', () => {
  const navPlaceholder = document.getElementById('nav-placeholder');
  
  hideAdminElements(); // (Fonction de gestion des rôles)
  
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
        
        // --- NOUVEAU: LOGIQUE DU MENU BURGER ---
        const menuButton = document.getElementById('mobile-menu-button');
        const menuContent = document.getElementById('nav-content');
        const menuIcon = document.getElementById('mobile-menu-icon');

        if (menuButton && menuContent && menuIcon) {
          menuButton.onclick = () => {
            // Bascule la visibilité du conteneur de navigation
            menuContent.classList.toggle('hidden');

            // Met à jour l'icône (menu ou X)
            if (menuContent.classList.contains('hidden')) {
              // Le menu est fermé, afficher 'menu'
              menuIcon.removeAttribute('data-lucide');
              menuIcon.setAttribute('data-lucide', 'menu');
            } else {
              // Le menu est ouvert, afficher 'x'
              menuIcon.removeAttribute('data-lucide');
              menuIcon.setAttribute('data-lucide', 'x');
            }
            lucide.createIcons(); // Re-dessiner la nouvelle icône
          };
        }
        // --- FIN DE LA LOGIQUE DU MENU BURGER ---

        // --- CHARGEMENT DE L'AVATAR (Existant) ---
        loadNavAvatar(); 
        
        // --- LOGIQUE DE DÉCONNEXION (Existante) ---
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
          logoutButton.onclick = async () => {
            sessionStorage.removeItem('userRole');
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
              console.error('Erreur de déconnexion:', error);
            } else {
              window.location.href = 'index.html'; // Retour à la connexion
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
  // Met en surbrillance le lien de la page active
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

function hideAdminElements() {
  // Masque les éléments réservés aux admins si l'utilisateur n'a pas le rôle
  const userRole = sessionStorage.getItem('userRole');
  if (userRole !== 'admin') {
    const style = document.createElement('style');
    style.innerHTML = '.admin-only { display: none !important; }';
    document.head.appendChild(style);
  }
}

async function loadNavAvatar() {
  // Récupère l'avatar de l'utilisateur connecté et l'affiche dans la nav
  const navAvatar = document.getElementById('nav-avatar');
  if (!navAvatar) return; 

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
    }
  } catch (error) {
    console.error("Impossible de charger l'avatar de la nav:", error.message);
  }
}