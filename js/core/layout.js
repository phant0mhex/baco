// js/core/layout.js
import { supabaseClient } from './auth.js';
import { toggleFavorite } from '../modules/favorites.js';
import { 
  highlightActiveLink, hideAdminElements, loadNavAvatar, 
  injectAdminGlowStyles, applyAdminGlow, setupNavDropdowns, 
  setupLogout, setupMobileMenu 
} from '../modules/nav.js';
import { initGlobalSearch } from '../modules/search.js';
import { loadJournalNotificationCount, loadNotificationCount } from '../modules/notifications.js';
import { setupThemeToggle } from '../modules/theme.js';
import { 
  loadComponent, loadLatestChangelog, injectCalendarStyles, setupGoToTop, 
  cleanPhoneNumber, formatPhoneNumber, formatDate, highlightText, 
  exportToCSV, exportToXLSX, exportToPDF, setupPreviewModal // <-- AJOUT
} from '../modules/utils.js';

export let notyf;
if (typeof Notyf !== 'undefined') {
  notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    dismissible: true
  });
  window.notyf = notyf;
} else {
  console.error("Notyf n'est pas chargé !");
  notyf = { success: (msg) => alert(msg), error: (msg) => alert(msg) };
  window.notyf = notyf;
}

export let currentUserId = null;

// Expositions globales
window.cleanPhoneNumber = cleanPhoneNumber;
window.formatPhoneNumber = formatPhoneNumber;
window.formatDate = formatDate;
window.highlightText = highlightText;
window.exportToCSV = exportToCSV;
window.exportToXLSX = exportToXLSX;
window.exportToPDF = exportToPDF;

function initNavCalendar() {
  const calendarButton = document.getElementById('nav-calendar-trigger');
  const calendarInput = document.getElementById('nav-calendar-input');

  if (calendarButton && calendarInput && typeof flatpickr !== 'undefined' && flatpickr.l10ns.fr) {
    const calendarInstance = flatpickr(calendarInput, {
      weekNumbers: true,
      locale: "fr",
      position: 'auto right',
      appendTo: document.body, 
      onReady: (selectedDates, dateStr, instance) => {
        instance.calendarContainer.classList.add('font-sans', 'baco-theme');
      }
    });

    calendarButton.addEventListener('click', (e) => {
      e.stopPropagation();
      calendarInstance.open();
    });
  }
}

window.hideInfractionWarning = () => {
  const modal = document.getElementById('infraction-warning-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  sessionStorage.setItem('hasSeenInfractionWarning', 'true');
}

async function checkInfractionWarning(userId) {
  if (sessionStorage.getItem('hasSeenInfractionWarning') === 'true') {
    return;
  }

  try {
    const { data, error, count } = await supabaseClient
      .from('infractions')
      .select('id', { count: 'exact' })
      .eq('id', currentUserId)
      .eq('is_active', true)
      .eq('card_type', 'yellow')
      .gt('expires_at', new Date().toISOString());
      
    if (error) throw error;
    
    if (count === 2) {
      const modal = document.getElementById('infraction-warning-modal');
      if (modal) {
        modal.style.display = 'flex';
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    }
    
  } catch (error) {
    console.error("Erreur lors de la vérification des infractions:", error.message);
  }
}

async function pollJournalNotifications() {
  const badgeElement = document.getElementById('journal-badge');
  if (!badgeElement) return;

  const JOURNAL_STORAGE_KEY = 'lastJournalVisit'; 
  let lastVisit = localStorage.getItem(JOURNAL_STORAGE_KEY);
  if (!lastVisit) lastVisit = '1970-01-01T00:00:00.000Z';

  try {
    const { count, error } = await supabaseClient
      .from('main_courante')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', lastVisit);

    if (error) throw error;

    const oldBadgeCount = parseInt(badgeElement.textContent || '0', 10);

    if (count > 0 && count > oldBadgeCount) {
      badgeElement.textContent = count;
      badgeElement.classList.remove('hidden');

      if (oldBadgeCount === 0) {
         notyf.success({
            message: "Nouveau message dans le journal !",
            onClick: () => { window.location.href = 'journal.html'; }
         });
      }
    } else if (count === 0) {
       badgeElement.classList.add('hidden');
       badgeElement.textContent = '';
    }
  } catch (error) {
    console.warn("[Journal Poll] Erreur:", error.message);
  }
}

async function initLayout() {
  injectCalendarStyles();
  injectAdminGlowStyles();
  
  initGlobalSearch();
  hideAdminElements();

  const navLoaded = await loadComponent('nav-placeholder', '_nav.html');
  if (navLoaded) {
    highlightActiveLink();
    await loadNavAvatar();
    setupThemeToggle();
    applyAdminGlow();
    initNavCalendar();
    setupMobileMenu();
    setupLogout();
    setupNavDropdowns();
    loadJournalNotificationCount();
    loadNotificationCount();
    checkInfractionWarning(currentUserId);
    updateUserHeartbeat();

    setInterval(pollJournalNotifications, 30000);
    setInterval(loadNotificationCount, 30000); 
    setInterval(loadJournalNotificationCount, 30000);
  }

  const footerLoaded = await loadComponent('footer-placeholder', '_footer.html');
  if (footerLoaded) {
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
    loadLatestChangelog();
    setupGoToTop();
    setupPreviewModal(); // <-- INITIALISATION DE LA MODALE
    checkWhatIsNew();
  }

  lucide.createIcons();
}

async function checkWhatIsNew() {
  const STORAGE_KEY = 'baco-last-seen-changelog-id';
  try {
    const { data, error } = await supabaseClient
      .from('changelog')
      .select('id, title, type')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    if (!data) return;

    const lastSeenId = localStorage.getItem(STORAGE_KEY);

    if (data.id.toString() !== lastSeenId) {
      let typeText = data.type === 'Nouveau' ? '[Nouveau]' : '[Mise à jour]';
      notyf.success({
        message: `<strong>${typeText}</strong> ${data.title}`,
        duration: 10000,
        icon: false,
        onClick: () => {
          window.location.href = 'changelog.html';
        }
      });
      localStorage.setItem(STORAGE_KEY, data.id.toString());
    }

  } catch (error) {
    console.warn("Erreur 'Quoi de Neuf':", error.message);
  }
}

async function updateUserHeartbeat() {
  if (!currentUserId) return; 
  try {
    supabaseClient
      .from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', currentUserId);
  } catch (error) {
    console.warn('Erreur heartbeat:', error.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const currentPage = window.location.pathname.split('/').pop();

  if (!session) {
    sessionStorage.removeItem('userRole');
    if (currentPage !== 'index.html' && currentPage !== 'reset-password.html') {
      window.location.href = 'index.html';
      return;
    }
  } else {
    const userRole = session.user.user_metadata?.role || 'user';
    sessionStorage.setItem('userRole', userRole);
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      currentUserId = user.id;
      window.currentUserId = currentUserId;
    }
  }
  
  if (currentPage !== 'index.html' && currentPage !== 'reset-password.html') {
    await initLayout();
  }

  document.body.style.visibility = 'visible';
  
  if (typeof window.pageInit === 'function' && currentPage !== 'index.html' && currentPage !== 'reset-password.html') {
    window.pageInit();
  }
});