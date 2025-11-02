// js/layout.js

// --- GESTION DU THÈME (SANS CHANGEMENT) ---
(function() {
  // (Logique du thème sombre retirée comme demandé)
})();

document.addEventListener('DOMContentLoaded', () => {
  const navPlaceholder = document.getElementById('nav-placeholder');
  
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
        
        // --- LOGIQUE DU MENU BURGER ---
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
        
        // --- CHARGEMENT DE L'AVATAR ---
        loadNavAvatar(); 
        
        // --- LOGIQUE DE DÉCONNEXION ---
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
          logoutButton.onclick = async () => {
            sessionStorage.removeItem('userRole');
            const { error } = await supabaseClient.auth.signOut();
            if (error) console.error('Erreur de déconnexion:', error);
            else window.location.href = 'index.html';
          };
        }
        
        // ==========================================================
        // ==  NOUVELLE LOGIQUE: GESTION DU DROPDOWN DE PRÉSENCE  ==
        // ==========================================================
        const presenceContainer = document.getElementById('presence-container');
        const presenceButton = document.getElementById('presence-toggle-button');
        const presenceDropdown = document.getElementById('presence-dropdown');
        
        if (presenceContainer && presenceButton && presenceDropdown) {
            // 1. Ouvrir/Fermer le dropdown en cliquant sur le bouton
            presenceButton.onclick = (e) => {
                e.stopPropagation(); // Empêche le 'click-away' de se déclencher
                presenceDropdown.classList.toggle('hidden');
            };
            
            // 2. Gérer le 'click-away' pour fermer le dropdown
            window.addEventListener('click', (e) => {
                // Si on clique en dehors du conteneur de présence
                if (!presenceContainer.contains(e.target)) {
                    presenceDropdown.classList.add('hidden');
                }
            });
        }

        // --- LOGIQUE DE PRÉSENCE TEMPS RÉEL (Existante) ---
        setupRealtimePresence();
        
      })
      .catch(error => {
        console.error('Impossible de charger la navigation:', error);
        navPlaceholder.innerHTML = '<p class="text-center text-red-500">Erreur de chargement du menu.</p>';
      });
  }
});

function highlightActiveLink() {
  // (Fonction inchangée)
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
  // (Fonction inchangée)
  const userRole = sessionStorage.getItem('userRole');
  if (userRole !== 'admin') {
    const style = document.createElement('style');
    style.innerHTML = '.admin-only { display: none !important; }';
    document.head.appendChild(style);
  }
}

async function loadNavAvatar() {
  // (Fonction inchangée)
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
  // (Fonction inchangée)
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
      updateOnlineAvatars(presenceState, userProfile.id); // <- Passer l'ID local
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(userProfile);
      }
    });
}

/**
 * NOUVELLE VERSION de updateOnlineAvatars
 * Met à jour le compteur et la liste du dropdown.
 */
function updateOnlineAvatars(state, localUserId) {
  const counter = document.getElementById('presence-counter');
  const list = document.getElementById('presence-list');
  if (!counter || !list) return;

  let count = 0;
  let html = '';
  
  for (const key in state) {
    const user = state[key][0]; // [0] car c'est le premier état tracké
    
    // On ne s'affiche pas soi-même dans la liste
    if (user && user.id && user.id !== localUserId) { 
      count++;
      html += `
        <div class="flex items-center gap-3 p-2 rounded-md">
          <img src="${user.avatar_url}" alt="${user.full_name}" class="w-8 h-8 rounded-full object-cover">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${user.full_name}</span>
        </div>
      `;
    }
  }
  
  // Mettre à jour le compteur
  counter.textContent = count;
  counter.classList.toggle('hidden', count === 0); // Cache le compteur s'il n'y a personne

  // Mettre à jour la liste
  if (count === 0) {
    list.innerHTML = '<p class="p-3 text-sm text-center text-gray-500 dark:text-gray-400">Vous êtes seul en ligne.</p>';
  } else {
    list.innerHTML = html;
  }
}