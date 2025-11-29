// js/modules/nav.js
import { supabaseClient } from '../core/auth.js';
import { currentUserId } from '../core/layout.js'; // Importer l'ID utilisateur
import { loadNotificationDropdown } from './notifications.js';
/**
 * Met en surbrillance le lien de navigation actif
 */
export function highlightActiveLink() {
  const currentPage = window.location.pathname.split('/').pop();
  if (!currentPage) return;
  const navLinksContainer = document.getElementById('nav-links');
  if (!navLinksContainer) return;

  // Logique pour les dropdowns (ex: PMR)
  const pmrLink = navLinksContainer.querySelector(`a[href="pmr.html"]`);
  const clientsPmrLink = navLinksContainer.querySelector(`a[href="clients_pmr.html"]`);
  if (pmrLink && clientsPmrLink && (currentPage === 'pmr.html' || currentPage === 'clients_pmr.html')) {
    document.getElementById('pmr-toggle-button')?.classList.add('bg-gray-700', 'font-bold');
  }
  
  // Logique pour les liens directs
  const activeLink = navLinksContainer.querySelector(`a[href="${currentPage}"]`);
  activeLink?.classList.add('bg-gray-700', 'font-bold');
}


/**
 * Masque les éléments réservés aux administrateurs/modérateurs
 */
export function hideAdminElements() {
  const userRole = sessionStorage.getItem('userRole');
  const isStaff = userRole === 'admin' || userRole === 'moderator';

  // 1. Si ce n'est ni un admin ni un modérateur, on cache tout ce qui est .admin-only
  if (!isStaff) {
    const style = document.createElement('style');
    style.innerHTML = '.admin-only { display: none !important; }';
    document.head.appendChild(style);
  } 
  
  // 2. Si c'est un modérateur, on cache spécifiquement les pages "Super Admin"
  if (userRole === 'moderator') {
    const style = document.createElement('style');
    // On cache les liens vers admin.html et audit.html dans la navigation
    style.innerHTML = `
        a[href="admin.html"],
        a[href="audit.html"] { display: none !important; }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Charge l'avatar de l'utilisateur dans la barre de navigation
 */
export async function loadNavAvatar() {
  const navAvatar = document.getElementById('nav-avatar');
  if (!navAvatar || !currentUserId) return; // Utilise l'ID déjà chargé

  try {
    const { data, error } = await supabaseClient.from('profiles').select('avatar_url').eq('id', currentUserId).single();
    if (error) throw error;
    if (data && data.avatar_url) {
      navAvatar.src = data.avatar_url;
    }
  } catch (error) {
    console.error("Impossible de charger l'avatar de la nav:", error.message);
  }
}

/**
 * Injecte le style CSS pour l'effet "glow" de l'admin
 */
export function injectAdminGlowStyles() {
  const style = document.createElement('style');
  style.innerHTML = `
    .admin-avatar-glow {
      padding: 2px; border-radius: 9999px;
      background: linear-gradient(90deg, #60a5fa, #f472b6, #fb923c, #60a5fa);
      background-size: 300% 300%;
      animation: admin-glow-animation 3s linear infinite;
      display: inline-block; vertical-align: middle; 
    }
    @keyframes admin-glow-animation {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }`;
  document.head.appendChild(style);
}

/**
 * Applique la classe "glow" si l'utilisateur est admin
 */
export function applyAdminGlow() {
  const userRole = sessionStorage.getItem('userRole');
  if (userRole === 'admin') {
    document.getElementById('admin-avatar-border')?.classList.add('admin-avatar-glow');
  }
}

// ==========================================================
// == NOUVELLE FONCTION POUR CHARGER LA PRÉSENCE
// ==========================================================
/**
 * Charge la liste des utilisateurs récemment actifs (moins de 5 minutes)
 */
async function loadPresenceDropdown() {
  const list = document.getElementById('presence-list');
  const counter = document.getElementById('presence-counter');
  if (!list || !counter || !currentUserId) return;

  list.innerHTML = '<p class="p-3 text-sm text-center text-gray-400">Chargement...</p>';
  
  try {
    // Calculer la date d'il y a 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('full_name, avatar_url')
      .gt('last_seen', fiveMinutesAgo) // Plus récent que 5 minutes
      .neq('id', currentUserId) // Exclure soi-même
      .order('full_name', { ascending: true });

    if (error) throw error;

    if (data.length === 0) {
      list.innerHTML = '<p class="p-3 text-sm text-center text-gray-400">Vous êtes seul en ligne.</p>';
      counter.classList.add('hidden');
    } else {
      list.innerHTML = data.map(user => {
        const displayName = user.full_name || 'Utilisateur';
        const avatarUrl = user.avatar_url || 'https://via.placeholder.com/40';
        return `
          <div class="flex items-center gap-3 p-2 rounded-md">
            <img src="${avatarUrl}" alt="${displayName}" class="w-8 h-8 rounded-full object-cover">
            <span class="text-sm font-medium text-gray-300">${displayName}</span>
          </div>
        `;
      }).join('');
      
      counter.textContent = data.length;
      counter.classList.remove('hidden');
    }
    
  } catch (error) {
    console.error("[Presence] Erreur:", error.message);
    list.innerHTML = '<p class="p-3 text-sm text-center text-red-400">Erreur de chargement.</p>';
    counter.classList.add('hidden');
  }
}
// ==========================================================



/**
 * Configure la logique des menus déroulants de la navigation
 */
export function setupNavDropdowns() {
    const allDropdowns = [
        { 
            container: document.getElementById('profile-dropdown-container'),
            button: document.getElementById('profile-toggle-button'),
            menu: document.getElementById('profile-dropdown'),
            chevron: null 
        },
        { 
            container: document.getElementById('notifications-dropdown-container'),
            button: document.getElementById('notifications-toggle-button'),
            menu: document.getElementById('notifications-dropdown'),
            chevron: null 
        },
        { // <-- AJOUTÉ
            container: document.getElementById('presence-container'),
            button: document.getElementById('presence-toggle-button'),
            menu: document.getElementById('presence-dropdown'),
            chevron: null 
        },
        { 
            container: document.getElementById('pmr-dropdown-container'),
            button: document.getElementById('pmr-toggle-button'),
            menu: document.getElementById('pmr-dropdown'),
            chevron: document.getElementById('pmr-chevron-icon')
        },
        { 
            container: document.getElementById('repertoire-dropdown-container'),
            button: document.getElementById('repertoire-toggle-button'),
            menu: document.getElementById('repertoire-dropdown'),
            chevron: document.getElementById('repertoire-chevron-icon')
        },
        { 
            container: document.getElementById('data-dropdown-container'),
            button: document.getElementById('data-toggle-button'),
            menu: document.getElementById('data-dropdown'),
            chevron: document.getElementById('data-chevron-icon')
        }
    ];

    function toggleMenu(menuToToggle, chevronToToggle, button) {
        const isCurrentlyOpen = !menuToToggle.classList.contains('hidden');

        // 1. Fermer TOUS les menus
        allDropdowns.forEach(({ menu, chevron }) => {
            menu?.classList.add('hidden');
            chevron?.setAttribute('data-lucide', 'chevron-down');
        });

        // 2. Ouvrir le menu cible si nécessaire
        if (!isCurrentlyOpen) {
            menuToToggle.classList.remove('hidden');
            chevronToToggle?.setAttribute('data-lucide', 'chevron-up');

           if (button && button.id === 'notifications-toggle-button') {
                loadNotificationDropdown();
            } 
            if (button && button.id === 'presence-toggle-button') {
                loadPresenceDropdown(); // <-- APPEL DE LA NOUVELLE FONCTION
           }
        }
        
        lucide.createIcons();
    }

    // Attacher les écouteurs
    allDropdowns.forEach(({ button, menu, chevron, container }) => {
        if (button && menu) {
            button.onclick = (e) => {
                e.stopPropagation();
                toggleMenu(menu, chevron, button);
            };
            menu.addEventListener('click', (e) => e.stopPropagation());
        }
    });

    // Logique de fermeture "Click-away"
    window.addEventListener('click', (e) => {
        const containers = allDropdowns.map(d => d.container);
        let clickedInsideADropdown = containers.some(c => c && c.contains(e.target));

        if (!clickedInsideADropdown) {
            allDropdowns.forEach(({ menu, chevron }) => {
                menu?.classList.add('hidden');
                chevron?.setAttribute('data-lucide', 'chevron-down');
            });
            lucide.createIcons();
        }
    });
}

/**
 * Configure le bouton de déconnexion
 */
export function setupLogout() {
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.onclick = async () => {
      sessionStorage.removeItem('userRole');
      const { error } = await supabaseClient.auth.signOut();
      if (error) console.error('Erreur de déconnexion:', error);
      else window.location.href = 'index.html';
    };
  }
}

/**
 * Configure le menu burger mobile
 */
export function setupMobileMenu() {
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
}