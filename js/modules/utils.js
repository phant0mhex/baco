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

// ================= NOUVELLE FONCTION AJOUTÉE =================
/**
 * Nettoie un numéro de téléphone pour ne garder que les chiffres.
 * @param {string} phone Le numéro de téléphone (ex: "0490/10.10.10").
 * @returns {string} Le numéro nettoyé (ex: "0490101010").
 */
export function cleanPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, ''); // Supprime tout ce qui n'est pas un chiffre
}
// ==============================================================

// ================= NOUVELLE FONCTION AJOUTÉE =================
/**
 * Formate un numéro de téléphone belge brut (ex: 0490101010) en un format lisible (ex: 0490/10.10.10).
 * @param {string} phone Le numéro de téléphone brut.
 * @returns {string} Le numéro formaté, ou le numéro d'origine s'il est invalide.
 */
export function formatPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  
  const digits = phone.replace(/\D/g, ''); // Nettoyer le numéro au cas où

  if (digits.length === 10) {
    // Mobiles (04xx) ou 0800 10 chiffres (ex: 0490/10.10.10)
    if (digits.startsWith('04') || digits.startsWith('0800')) {
      return `${digits.substring(0, 4)}/${digits.substring(4, 6)}.${digits.substring(6, 8)}.${digits.substring(8, 10)}`;
    }
  }
  if (digits.length === 9) {
    // Lignes fixes (065, 071, etc.) (ex: 065/12.34.56)
    if (digits.startsWith('0') && !digits.startsWith('0800') && !digits.startsWith('02')) {
      return `${digits.substring(0, 3)}/${digits.substring(3, 5)}.${digits.substring(5, 7)}.${digits.substring(7, 9)}`;
    }
    // Lignes fixes (02) (ex: 02/123.45.67)
    if (digits.startsWith('02')) {
      return `${digits.substring(0, 2)}/${digits.substring(2, 5)}.${digits.substring(5, 7)}.${digits.substring(7, 9)}`;
    }
    // 0800 9 chiffres (ex: 0800/12.345)
    if (digits.startsWith('0800')) {
      return `${digits.substring(0, 4)}/${digits.substring(4, 6)}.${digits.substring(6, 9)}`;
    }
  }
  
  // Si aucun format ne correspond, retourner le numéro d'origine (nettoyé ou non)
  return phone; 
}


// ==========================================================
// == NOUVELLE FONCTION CENTRALISÉE : formatDate
// ==========================================================
/**
 * Formate une date selon différents formats prédéfinis.
 * @param {string} dateString - La date en format ISO (ex: '2025-11-15T10:30:00')
 * @param {'short' | 'long' | 'admin'} format - Le format désiré.
 */
export function formatDate(dateString, format = 'short') {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  let options = {};

  switch (format) {
    case 'long':
      // Pour le changelog (ex: 15 novembre 2025)
      options = { day: '2-digit', month: 'long', year: 'numeric' };
      break;
    case 'admin':
      // Pour l'audit (ex: 15 nov. 2025, 10:30)
      options = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
      break;
    case 'short':
    default:
      // Pour le journal (ex: 15 nov., 10:30)
      options = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  }

  return date.toLocaleDateString('fr-FR', options).replace('.', '');
}

// ==========================================================
// == NOUVELLE FONCTION CENTRALISÉE : highlightText
// ==========================================================
/**
 * Surligne un terme de recherche dans un texte.
 * @param {string} text - Le texte dans lequel chercher.
 * @param {string} term - Le terme à surligner.
 */
export function highlightText(text, term) {
  if (!term || !text) return text;
  try {
    // Échapper les caractères spéciaux pour la regex
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
  } catch (e) {
    // En cas d'erreur regex (ex: terme de recherche invalide), retourner le texte original
    return text;
  }
}


// ================= EXPORT EXCEL (.XLSX) =================
export function exportToXLSX(data, filename = 'export.xlsx') {
  if (typeof XLSX === 'undefined') {
    console.error("SheetJS (XLSX) n'est pas chargé.");
    alert("Erreur : Bibliothèque Excel manquante.");
    return;
  }
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  XLSX.writeFile(wb, filename);
}

// ================= EXPORT PDF (.PDF) =================
export function exportToPDF(data, filename = 'export.pdf', title = 'Rapport') {
  if (typeof jspdf === 'undefined') {
    console.error("jsPDF n'est pas chargé.");
    alert("Erreur : Bibliothèque PDF manquante.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Titre du document
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 22);

  // Préparation des données pour l'autoTable
  if (data.length > 0) {
    const headers = [Object.keys(data[0])];
    const rows = data.map(obj => Object.values(obj).map(val => String(val || '')));

    doc.autoTable({
      head: headers,
      body: rows,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }, // Bleu
      theme: 'grid'
    });
  }

  doc.save(filename);
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