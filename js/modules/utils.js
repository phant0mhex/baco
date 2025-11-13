// js/modules/utils.js

// NOUVEL IMPORT EN HAUT
import { supabaseClient } from '../core/auth.js';

/**
 * Charge un composant HTML (comme _nav.html) dans un placeholder
 */
export async function loadComponent(placeholderId, htmlFilePath) {
  const placeholder = document.getElementById(placeholderId);
  if (!placeholder) return false;
  
  try {
    const response = await fetch(htmlFilePath);
    if (!response.ok) throw new Error(`Fichier non trouvé: ${htmlFilePath}`);
    const html = await response.text();
    placeholder.outerHTML = html; // Remplace le placeholder
    return true;
  } catch (error) {
    console.error(`Erreur lors du chargement de ${placeholderId}:`, error);
    placeholder.innerHTML = `<p class="text-center text-red-500">Erreur chargement ${placeholderId}</p>`;
    return false;
  }
}

/**
 * Charge la dernière entrée du changelog dans le footer
 */
export async function loadLatestChangelog() {
  const versionElement = document.getElementById('version-info');
  if (!versionElement) return;
  try {
    // Utilise le supabaseClient importé
    const { data, error } = await supabaseClient
      .from('changelog')
      .select('title, type') 
      .order('created_at', { ascending: false })
      .limit(1) 
      .single(); 
    if (error) throw error;
    if (data) {
      let typeText = '';
      if (data.type === 'Nouveau') typeText = '[Nouveau]';
      else if (data.type === 'Corrigé') typeText = '[Fix]';
      else if (data.type === 'Amélioré') typeText = '[MàJ]';
      versionElement.innerHTML = `
        <i data-lucide="list-checks" class="w-4 h-4"></i>
        <span>${typeText} ${data.title}</span>
      `;
      versionElement.classList.remove('text-gray-500');
      lucide.createIcons();
    } else {
      versionElement.innerHTML = '<span>v1.0.0</span>'; // Fallback
    }
  } catch (error) {
    console.error("Erreur chargement version changelog:", error.message);
    const spinner = versionElement.querySelector('i');
    const text = versionElement.querySelector('span');
    if (spinner) spinner.style.display = 'none';
    if (text) text.textContent = 'v1.0.0';
  }
}
/**
 * Injecte les styles CSS pour le calendrier flatpickr
 */
export function injectCalendarStyles() {
  const style = document.createElement('style');
  style.innerHTML = `
   
      .flatpickr-calendar.baco-theme {
      background: #1F2937 !important; /* bg-gray-800 */
      border: 1px solid #374151 !important; /* border-gray-700 */
      border-radius: 0.5rem !important; /* rounded-lg */
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important; /* shadow-xl */
      width: auto !important;
      min-width: 340px !important; /* Largeur fixe pour un look propre */
      padding: 0.75rem !important; /* p-3 */
      color: #D1D5DB !important; /* text-gray-300 */
    }
    .baco-theme .flatpickr-months { background: transparent !important; padding: 0.25rem !important; border-bottom: 1px solid #374151 !important; margin-bottom: 0.75rem !important; }
    .baco-theme .flatpickr-months .flatpickr-month { height: 2.5rem !important; }
    .baco-theme .flatpickr-months .flatpickr-prev-month, .baco-theme .flatpickr-months .flatpickr-next-month { fill: #D1D5DB !important; padding: 0.5rem !important; border-radius: 0.375rem !important; top: 0.5rem !important; }
    .baco-theme .flatpickr-months .flatpickr-prev-month svg, .baco-theme .flatpickr-months .flatpickr-next-month svg { fill: #D1D5DB !important; }
    .baco-theme .flatpickr-months .flatpickr-prev-month:hover, .baco-theme .flatpickr-months .flatpickr-next-month:hover { background: #374151 !important; }
    .baco-theme .flatpickr-months .flatpickr-prev-month:hover svg, .baco-theme .flatpickr-months .flatpickr-next-month:hover svg { fill: #F9FAFB !important; }
    .baco-theme .flatpickr-current-month .flatpickr-monthDropdown-months, .baco-theme .flatpickr-current-month input.cur-year { font-size: 1.125rem !important; font-weight: 600 !important; color: #F9FAFB !important; background: transparent !important; border: none !important; padding: 0 0.25rem !important; border-radius: 0.375rem !important; transition: background 0.1s ease !important; }
    .baco-theme .flatpickr-current-month .flatpickr-monthDropdown-months:hover, .baco-theme .flatpickr-current-month input.cur-year:hover { background: #374151 !important; }
    .baco-theme .numInputWrapper { width: 4rem !important; }
    .baco-theme .flatpickr-weekdaycontainer { padding: 0 0.5rem !important; }
    .baco-theme .flatpickr-weekday { color: #9CA3AF !important; font-weight: 500 !important; font-size: 0.75rem !important; text-transform: uppercase !important; background: transparent !important; height: 2rem !important; line-height: 2rem !important; }
    .baco-theme .flatpickr-weekwrapper { border-right: 1px solid #374151 !important; margin-right: 0.5rem !important; }
    .baco-theme .flatpickr-weekwrapper .flatpickr-weeks { padding: 0 0.5rem !important; box-shadow: none !important; }
    .baco-theme .flatpickr-weekwrapper .flatpickr-weeks span { color: #9CA3AF !important; font-size: 0.875rem !important; font-weight: 500 !important; height: 2.25rem !important; line-height: 2.25rem !important; }
    .baco-theme .dayContainer { padding: 0 !important; }
    .baco-theme .flatpickr-day { color: #D1D5DB !important; border: 1px solid transparent !important; border-radius: 0.375rem !important; font-weight: 400 !important; height: 2.25rem !important; line-height: 2.25rem !important; }
    .baco-theme .flatpickr-day:hover { background: #374151 !important; color: #F9FAFB !important; border-color: #374151 !important; }
    .baco-theme .flatpickr-day.today { background: transparent !important; border: 1px solid #2563EB !important; color: #F9FAFB !important; }
    .baco-theme .flatpickr-day.today:hover { background: #374151 !important; border-color: #374151 !important; }
    .baco-theme .flatpickr-day.selected, .baco-theme .flatpickr-day.startRange, .baco-theme .flatpickr-day.endRange { background: #2563EB !important; border-color: #2563EB !important; color: #FFFFFF !important; }
    .baco-theme .flatpickr-day.flatpickr-disabled, .baco-theme .flatpickr-day.prevMonthDay, .baco-theme .flatpickr-day.nextMonthDay { color: #4B5563 !important; background: transparent !important; border-color: transparent !important; }
    .baco-theme .flatpickr-day.prevMonthDay:hover, .baco-theme .flatpickr-day.nextMonthDay:hover { background: transparent !important; border-color: transparent !important; color: #4B5563 !important; }
    }`;
  document.head.appendChild(style);
}

/**
 * Configure le bouton "Go To Top"
 */
export function setupGoToTop() {
  const goToTopButton = document.getElementById('go-to-top-button');
  if (goToTopButton) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 200) {
        goToTopButton.classList.remove('hidden', 'opacity-0');
      } else {
        goToTopButton.classList.add('opacity-0');
        setTimeout(() => { if (window.scrollY <= 200) goToTopButton.classList.add('hidden'); }, 300);
      }
    });
    goToTopButton.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}