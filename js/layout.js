// js/layout.js

// --- LOGIQUE DU THÈME SOMBRE (Partie 1) ---
// S'exécute immédiatement pour appliquer le thème avant le chargement complet
// et éviter le "flash" de contenu.
(function() {
  const theme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (theme === 'dark' || (!theme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();
// -----------------------------------------

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
        
        // --- LOGIQUE DU MENU BURGER (Existante) ---
        const menuButton = document.getElementById('mobile-menu-button');
        const menuContent = document.getElementById('nav-content');
        const menuIcon = document.getElementById('mobile-menu-icon');
        if (menuButton && menuContent && menuIcon) {
          menuButton.onclick = () => {
            menuContent.classList.toggle('hidden');
            const isHidden = menuContent.classList.contains('hidden');
            menuIcon.setAttribute('data-lucide', isHidden ? 'menu' : 'x');
            lucide.createIcons();
          };
        }
        
        // --- CHARGEMENT DE L'AVATAR (Existant) ---
        loadNavAvatar(); 
        
        // --- LOGIQUE DE DÉCONNEXION (Existante) ---
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
          logoutButton.onclick = async () => {
            sessionStorage.removeItem('userRole');
            const { error } = await supabaseClient.auth.signOut();
            if (error) console.error('Erreur de déconnexion:', error);
            else window.location.href = 'index.html';
          };
        }
        
        // --- LOGIQUE DU THÈME SOMBRE (Partie 2) ---
        // Attache l'événement au bouton chargé depuis _nav.html
        const themeToggle = document.getElementById('theme-toggle');
        const themeIconMoon = document.getElementById('theme-icon-moon');
        const themeIconSun = document.getElementById('theme-icon-sun');
        
        if (themeToggle && themeIconMoon && themeIconSun) {
          // Mettre à jour l'icône au chargement
          if (document.documentElement.classList.contains('dark')) {
            themeIconMoon.classList.add('hidden');
            themeIconSun.classList.remove('hidden');
          }
          
          // Gérer le clic
          themeToggle.onclick = () => {
            if (document.documentElement.classList.contains('dark')) {
              // Passer en clair
              document.documentElement.classList.remove('dark');
              localStorage.setItem('theme', 'light');
              themeIconMoon.classList.remove('hidden');
              themeIconSun.classList.add('hidden');
            } else {
              // Passer en sombre
              document.documentElement.classList.add('dark');
              localStorage.setItem('theme', 'dark');
              themeIconMoon.classList.add('hidden');
              themeIconSun.classList.remove('hidden');
            }
          };
        }
        
        // --- LOGIQUE DE PRÉSENCE (Existante) ---
        setupRealtimePresence();
        
      })
      .catch(error => {
        console.error('Impossible de charger la navigation:', error);
        navPlaceholder.innerHTML = '<p class="text-center text-red-500">Erreur de chargement du menu.</p>';
      });
  }
});

function highlightActiveLink() {
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
  const userRole = sessionStorage.getItem('userRole');
  if (userRole !== 'admin') {
    const style = document.createElement('style');
    style.innerHTML = '.admin-only { display: none !important; }';
    document.head.appendChild(style);
  }
}

async function loadNavAvatar() {
  const navAvatar = document.getElementById('nav-avatar');
  if (!navAvatar) return; 
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return;
    const { data, error } = await supabaseClient.from('profiles').select('avatar_url').eq('id', user.id).single();
    if (error) throw error;
    if (data && data.avatar_url) {
      navAvatar.src = data.avatar_url;
    }
  } catch (error) {
    console.error("Impossible de charger l'avatar de la nav:", error.message);
  }
}

async function setupRealtimePresence() {
  let userProfile = { id: 'visiteur', full_name: 'Visiteur', avatar_url: 'https://via.placeholder.com/40' };
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      const { data: profile } = await supabaseClient.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();
      if (profile) userProfile = { id: user.id, ...profile };
    }
  } catch (e) { console.error("Erreur de profil pour la présence:", e); }

  const channel = supabaseClient.channel('baco-online-users', {
    config: { presence: { key: userProfile.id } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      updateOnlineAvatars(presenceState);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(userProfile);
      }
    });
}

function updateOnlineAvatars(state) {
  const container = document.getElementById('online-users');
  if (!container) return;
  container.innerHTML = ''; // Vider la liste
  for (const key in state) {
    const user = state[key][0]; 
    if (user) {
      const img = document.createElement('img');
      img.src = user.avatar_url;
      img.title = user.full_name;
      img.className = 'w-10 h-10 rounded-full border-2 border-gray-900 dark:border-gray-700 object-cover'; // Ajout dark:border
      container.appendChild(img);
    }
  }
}