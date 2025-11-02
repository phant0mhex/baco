// js/layout.js

document.addEventListener('DOMContentLoaded', () => {
  const navPlaceholder = document.getElementById('nav-placeholder');
  const footerPlaceholder = document.getElementById('footer-placeholder'); // <-- NOUVEAU
  
  hideAdminElements();
  
  // --- NOUVELLE STRATÉGIE: Charger nav et footer en parallèle ---
  const navPromise = navPlaceholder ? fetch('_nav.html').then(res => res.text()) : Promise.resolve(null);
  const footerPromise = footerPlaceholder ? fetch('_footer.html').then(res => res.text()) : Promise.resolve(null);

  Promise.all([navPromise, footerPromise])
    .then(([navHtml, footerHtml]) => {
    
      // 1. Injecter la Navigation (si elle existe)
      if (navHtml && navPlaceholder) {
        navPlaceholder.innerHTML = navHtml;
        highlightActiveLink();
        
        // --- LOGIQUE DU MENU BURGER ---
        const menuButton = document.getElementById('mobile-menu-button');
        const menuContent = document.getElementById('nav-content');
        const menuIcon = document.getElementById('mobile-menu-icon');
        if (menuButton && menuContent && menuIcon) {
          menuButton.onclick = () => {
            menuContent.classList.toggle('hidden');
            const isHidden = menuContent.classList.contains('hidden');
            menuIcon.setAttribute('data-lucide', isHidden ? 'menu' : 'x');
            lucide.createIcons(); // Redessiner l'icône changée
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
        
        // --- GESTION DU DROPDOWN DE PRÉSENCE ---
        const presenceContainer = document.getElementById('presence-container');
        const presenceButton = document.getElementById('presence-toggle-button');
        const presenceDropdown = document.getElementById('presence-dropdown');
        if (presenceContainer && presenceButton && presenceDropdown) {
            presenceButton.onclick = (e) => {
                e.stopPropagation(); 
                presenceDropdown.classList.toggle('hidden');
                document.getElementById('profile-dropdown')?.classList.add('hidden');
            };
        }
        
        // --- GESTION DU DROPDOWN DE PROFIL ---
        const profileContainer = document.getElementById('profile-dropdown-container');
        const profileButton = document.getElementById('profile-toggle-button');
        const profileDropdown = document.getElementById('profile-dropdown');
        if (profileContainer && profileButton && profileDropdown) {
            profileButton.onclick = (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('hidden');
                document.getElementById('presence-dropdown')?.classList.add('hidden');
            };
        }
        
        // --- GESTION DU "CLICK-AWAY" ---
        window.addEventListener('click', (e) => {
            if (presenceContainer && !presenceContainer.contains(e.target)) {
                presenceDropdown?.classList.add('hidden');
            }
            if (profileContainer && !profileContainer.contains(e.target)) {
                profileDropdown?.classList.add('hidden');
            }
        });

        // --- LOGIQUE DE PRÉSENCE TEMPS RÉEL ---
        setupRealtimePresence();
      }
      
      // 2. Injecter le Footer (s'il existe)
      if (footerHtml && footerPlaceholder) {
        footerPlaceholder.innerHTML = footerHtml;
        // Mettre à jour l'année dynamiquement
        const yearSpan = document.getElementById('current-year');
        if (yearSpan) {
          yearSpan.textContent = new Date().getFullYear();
        }
      }

      // 3. Appeler Lucide UNE SEULE FOIS (pour la nav ET le footer)
      lucide.createIcons();

    })
    .catch(error => {
      console.error('Impossible de charger le layout (nav/footer):', error);
      if (navPlaceholder) navPlaceholder.innerHTML = '<p class="text-center text-red-500">Erreur chargement menu.</p>';
    });
});

// --- Fonctions inchangées ci-dessous ---

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
      updateOnlineAvatars(presenceState, userProfile.id);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(userProfile);
      }
    });
}

function updateOnlineAvatars(state, localUserId) {
  const counter = document.getElementById('presence-counter');
  const list = document.getElementById('presence-list');
  if (!counter || !list) return;

  let count = 0;
  let html = '';
  
  for (const key in state) {
    const user = state[key][0];
    if (user && user.id && user.id !== localUserId) { 
      count++;
      html += `
        <div class="flex items-center gap-3 p-2 rounded-md">
          <img src="${user.avatar_url}" alt="${user.full_name}" class="w-8 h-8 rounded-full object-cover">
          <span class="text-sm font-medium text-gray-300">${user.full_name}</span>
        </div>
      `;
    }
  }
  
  counter.textContent = count;
  counter.classList.toggle('hidden', count === 0);

  if (count === 0) {
    list.innerHTML = '<p class="p-3 text-sm text-center text-gray-400">Vous êtes seul en ligne.</p>';
  } else {
    list.innerHTML = html;
  }
}