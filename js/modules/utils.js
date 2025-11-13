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
      background: #1F2937 !important; border: 1px solid #374151 !important;
      /* ... (le reste de vos styles de calendrier) ... */
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