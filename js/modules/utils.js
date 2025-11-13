// js/modules/utils.js

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
    // Note: Nécessite que supabaseClient soit importé si utilisé ici, 
    // ou que le module layout principal passe supabaseClient en paramètre.
    // Pour l'instant, on garde la logique de `layout.js` (etc...)
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