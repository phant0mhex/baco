// js/modules/notifications.js
import { supabaseClient } from '../core/auth.js';

const JOURNAL_STORAGE_KEY = 'lastJournalVisit';

/**
 * Charge le nombre de nouveaux messages du journal et met à jour le badge
 */
export async function loadJournalNotificationCount() {
  const badgeElement = document.getElementById('journal-badge');
  if (!badgeElement) return;

  let lastVisit = localStorage.getItem(JOURNAL_STORAGE_KEY);
  if (!lastVisit) lastVisit = '1970-01-01T00:00:00.000Z';

  try {
    const { count, error } = await supabaseClient
      .from('main_courante')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', lastVisit);
      
    if (error) throw error;
    
    if (count > 0) {
      badgeElement.textContent = count;
      badgeElement.classList.remove('hidden'); 
    } else {
      badgeElement.classList.add('hidden');
      badgeElement.textContent = '';
    }
  } catch (error) {
    console.error("[Journal Badge] Erreur:", error.message);
    badgeElement.classList.add('hidden');
  }
}

// Exposer à la fenêtre pour que journal.html puisse l'appeler
window.loadJournalNotificationCount = loadJournalNotificationCount;