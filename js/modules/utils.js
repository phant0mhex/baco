// js/modules/utils.js

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
    placeholder.outerHTML = html;
    return true;
  } catch (error) {
    console.error(`Erreur lors du chargement de ${placeholderId}:`, error);
    placeholder.innerHTML = `<p class="text-center text-red-500">Erreur chargement ${placeholderId}</p>`;
    return false;
  }
}

export function cleanPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

export function formatPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    if (digits.startsWith('04') || digits.startsWith('0800')) {
      return `${digits.substring(0, 4)}/${digits.substring(4, 6)}.${digits.substring(6, 8)}.${digits.substring(8, 10)}`;
    }
  }
  if (digits.length === 9) {
    if (digits.startsWith('0') && !digits.startsWith('0800') && !digits.startsWith('02')) {
      return `${digits.substring(0, 3)}/${digits.substring(3, 5)}.${digits.substring(5, 7)}.${digits.substring(7, 9)}`;
    }
    if (digits.startsWith('02')) {
      return `${digits.substring(0, 2)}/${digits.substring(2, 5)}.${digits.substring(5, 7)}.${digits.substring(7, 9)}`;
    }
    if (digits.startsWith('0800')) {
      return `${digits.substring(0, 4)}/${digits.substring(4, 6)}.${digits.substring(6, 9)}`;
    }
  }
  return phone; 
}

export function formatDate(dateString, format = 'short') {
  if (!dateString) return '';
  const date = new Date(dateString);
  let options = {};

  switch (format) {
    case 'long':
      options = { day: '2-digit', month: 'long', year: 'numeric' };
      break;
    case 'admin':
      options = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
      break;
    case 'short':
    default:
      options = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  }
  return date.toLocaleDateString('fr-FR', options).replace('.', '');
}

export function highlightText(text, term) {
  if (!term || !text) return text;
  try {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
  } catch (e) {
    return text;
  }
}

export function exportToCSV(data, filename = 'export.csv') {
  if (!data || !data.length) {
    alert("Aucune donnée à exporter.");
    return;
  }
  const separator = ',';
  const keys = Object.keys(data[0]);
  const csvContent = [
    keys.join(separator),
    ...data.map(row => keys.map(k => {
      let cell = row[k] === null || row[k] === undefined ? '' : row[k];
      cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
      cell = cell.replace(/"/g, '""');
      if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
      return cell;
    }).join(separator))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

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

export function exportToPDF(data, filename = 'export.pdf', title = 'Rapport') {
  if (!window.jspdf) {
    console.error("jsPDF n'est pas chargé (window.jspdf introuvable).");
    alert("Erreur : Bibliothèque PDF manquante.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 22);

  if (data.length > 0) {
    const headers = [Object.keys(data[0])];
    const rows = data.map(obj => Object.values(obj).map(val => String(val || '')));

    if (doc.autoTable) {
        doc.autoTable({
          head: headers,
          body: rows,
          startY: 28,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [41, 128, 185] },
          theme: 'grid'
        });
    } else {
        console.warn("jsPDF-AutoTable n'est pas chargé.");
        doc.text("Tableau non disponible (plugin manquant)", 14, 30);
    }
  }
  doc.save(filename);
}

export async function loadLatestChangelog() {
  const versionElement = document.getElementById('version-info');
  if (!versionElement) return;
  try {
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
      if (window.lucide) lucide.createIcons();
    } else {
      versionElement.innerHTML = '<span>v1.0.0</span>';
    }
  } catch (error) {
    console.error("Erreur chargement version changelog:", error.message);
    const spinner = versionElement.querySelector('i');
    const text = versionElement.querySelector('span');
    if (spinner) spinner.style.display = 'none';
    if (text) text.textContent = 'v1.0.0';
  }
}

export function injectCalendarStyles() {
  const style = document.createElement('style');
  style.innerHTML = `
      .flatpickr-calendar.baco-theme {
      background: #1F2937 !important;
      border: 1px solid #374151 !important;
      border-radius: 0.5rem !important;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
      width: auto !important;
      min-width: 340px !important;
      padding: 0.75rem !important;
      color: #D1D5DB !important;
    }
    .baco-theme .flatpickr-months { background: transparent !important; padding: 0.25rem !important; border-bottom: 1px solid #374151 !important; margin-bottom: 0.75rem !important; }
    .baco-theme .flatpickr-month { height: 2.5rem !important; }
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
    `;
  document.head.appendChild(style);
}

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

// --- GESTION DE LA PRÉVISUALISATION ---
export function setupPreviewModal() {
  window.previewDocument = (url, type = null) => {
    const modal = document.getElementById('preview-modal');
    const img = document.getElementById('preview-image');
    const iframe = document.getElementById('preview-frame');
    const downloadBtn = document.getElementById('preview-download-btn');
    const errorMsg = document.getElementById('preview-error');

    if (!modal) return;

    // Reset
    img.classList.add('hidden');
    iframe.classList.add('hidden');
    errorMsg.classList.add('hidden');
    
    downloadBtn.href = url;

    if (!type) {
      const ext = url.split('.').pop().split('?')[0].toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
      else if (ext === 'pdf') type = 'pdf';
    }

    if (type === 'image') {
      img.src = url;
      img.classList.remove('hidden');
    } else if (type === 'pdf') {
      iframe.src = url;
      iframe.classList.remove('hidden');
    } else {
      window.open(url, '_blank');
      return; 
    }

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  window.closePreviewModal = () => {
    const modal = document.getElementById('preview-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('preview-image').src = '';
        document.getElementById('preview-frame').src = '';
    }
  };
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closePreviewModal();
  });
}


// ... (code existant: imports, loadComponent, cleanPhoneNumber...)

// ================= GESTIONNAIRE DE MODALE (NOUVEAU) =================
/**
 * Classe utilitaire pour gérer les modales CRUD standardisées.
 */
export class ModalManager {
  /**
   * @param {Object} elements - Les IDs des éléments du DOM
   * @param {string} elements.modalId - ID de la div principale du modal
   * @param {string} [elements.formId] - ID du formulaire (optionnel)
   * @param {string} [elements.titleId] - ID du titre h3 (optionnel)
   * @param {string} [elements.submitBtnId] - ID du bouton de soumission (optionnel)
   */
  constructor({ modalId, formId, titleId, submitBtnId }) {
    this.modal = document.getElementById(modalId);
    this.form = document.getElementById(formId);
    this.title = document.getElementById(titleId);
    this.submitBtn = document.getElementById(submitBtnId);
    
    // Sauvegarde du contenu initial du bouton pour le restaurer après le chargement
    this.defaultSubmitContent = this.submitBtn ? this.submitBtn.innerHTML : 'Enregistrer';
  }

  /**
   * Ouvre la modale
   * @param {Object} options
   * @param {string} [options.title] - Le titre à afficher
   * @param {Function} [options.onOpen] - Fonction callback pour pré-remplir les champs (mode édition)
   */
  open({ title, onOpen = null } = {}) {
    if (!this.modal) return;
    
    // 1. Reset du formulaire
    if (this.form) this.form.reset();
    
    // 2. Mise à jour du titre
    if (this.title && title) this.title.textContent = title;

    // 3. Exécution de la logique de remplissage (si fournie)
    if (onOpen) onOpen();

    // 4. Affichage
    this.modal.style.display = 'flex';
    
    // 5. Rafraîchir les icônes (si Lucide est présent)
    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Ferme la modale
   */
  close() {
    if (this.modal) this.modal.style.display = 'none';
  }

  /**
   * Passe le bouton en état de chargement
   * @param {string} text - Texte à afficher (ex: "Enregistrement...")
   */
  startLoading(text = 'Enregistrement...') {
    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>${text}</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  /**
   * Restaure le bouton à son état initial
   * @param {string} [htmlContent] - HTML optionnel pour remplacer le contenu par défaut
   */
  stopLoading(htmlContent = null) {
    if (this.submitBtn) {
      this.submitBtn.disabled = false;
      this.submitBtn.innerHTML = htmlContent || this.defaultSubmitContent;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}