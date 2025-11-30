// js/pages/repertoire.js
import { ModalManager } from '../modules/utils.js';

window.pageInit = function() {

  if (typeof notyf === 'undefined') { console.error('Notyf n\'est pas chargé !'); }

  // --- 1. Initialisation du Manager ---
  const contactModal = new ModalManager({
    modalId: 'contact-modal',
    formId: 'contact-form',
    titleId: 'modal-title',
    submitBtnId: 'modal-submit-button'
  });

  // --- 2. Variables et DOM ---
  const resultDisplay = document.getElementById('resultDisplay');
  const viewToggleGrid = document.getElementById('view-toggle-grid');
  const viewToggleList = document.getElementById('view-toggle-list');
  const viewPreferenceKey = 'baco-repertoire-view';
  let currentView = localStorage.getItem(viewPreferenceKey) || 'grid';
  const filterContainer = document.getElementById('mainCategories');
  const zoneContainer = document.getElementById('zoneSubCategoriesContainer');
  const zoneCheckboxContainer = document.getElementById('zoneSubCategories');
  const sortAzButton = document.getElementById('sort-az');
  const sortZaButton = document.getElementById('sort-za');
  const contactIdInput = document.getElementById('modal-contact-id');
  let currentSortOrder = 'az';

  // --- 3. Exposer les fonctions globales ---
  window.updateSubCategories = updateSubCategories;
  window.updateDisplay = updateDisplay;

  // ============================================================
  // ==  NOUVELLE LOGIQUE MODALE (ModalManager)  ==
  // ============================================================

  window.showContactModal = (contact = null) => {
    const isEdit = contact !== null;
    
    contactModal.open({
      title: isEdit ? 'Modifier le contact' : 'Ajouter un contact',
      onOpen: () => {
        if (isEdit) {
          contactIdInput.value = contact.id;
          document.getElementById('modal-nom').value = contact.nom;
          document.getElementById('modal-tel').value = contact.tel;
          document.getElementById('modal-email').value = contact.email || '';
          document.getElementById('modal-categorie').value = contact.categorie_principale;
          document.getElementById('modal-zone').value = contact.zone || '';
          document.getElementById('modal-groupe').value = contact.groupe;
        } else {
          contactIdInput.value = ''; // Mode création
        }
      }
    });
  }

  window.hideContactModal = () => {
    contactModal.close();
  }

  window.handleFormSubmit = async (event) => {
    event.preventDefault();
    
    const contactId = contactIdInput.value;
    const isEdit = contactId !== '';
    
    const contactData = {
      nom: document.getElementById('modal-nom').value,
      tel: document.getElementById('modal-tel').value,
      email: document.getElementById('modal-email').value || null,
      categorie_principale: document.getElementById('modal-categorie').value,
      zone: document.getElementById('modal-zone').value || null,
      groupe: document.getElementById('modal-groupe').value
    };

    contactModal.startLoading(); // Spinner

    try {
      let error;
      if (isEdit) {
        const { error: updateError } = await supabaseClient
          .from('contacts_repertoire')
          .update(contactData)
          .eq('id', contactId);
        error = updateError;
      } else {
        const { error: insertError } = await supabaseClient
          .from('contacts_repertoire')
          .insert([contactData]);
        error = insertError;
      }

      if (error) throw error;

      notyf.success(isEdit ? "Contact mis à jour !" : "Contact ajouté !");
      contactModal.close();
      loadMainCategories(); 
      updateDisplay(); 

    } catch (error) {
      notyf.error("Erreur: " + error.message);
    } finally {
      contactModal.stopLoading();
    }
  }

  // ============================================================
  // ==  LOGIQUE METIER (Affichage, Filtres, Export)  ==
  // ============================================================

  const updateViewToggleUI = () => {
    if (currentView === 'list') {
      viewToggleList.classList.add('bg-gray-100', 'text-blue-600');
      viewToggleGrid.classList.remove('bg-gray-100', 'text-blue-600');
    } else {
      viewToggleGrid.classList.add('bg-gray-100', 'text-blue-600');
      viewToggleList.classList.remove('bg-gray-100', 'text-blue-600');
    }
  }

  const setView = (view) => {
    if (view === currentView) return;
    currentView = view;
    localStorage.setItem(viewPreferenceKey, currentView);
    updateDisplay();
  }

  window.toggleGroup = (contentId, headerElement) => {
    const content = document.getElementById(contentId);
    const icon = headerElement.querySelector('i[data-lucide="chevron-down"]');
    if (!content) return;
    const isOpen = !content.classList.contains('max-h-0');
    if (isOpen) {
      content.classList.add('max-h-0', 'p-0');
      content.classList.remove('p-4', 'max-h-[40rem]');
      headerElement.classList.remove('border-b');
      headerElement.setAttribute('aria-expanded', 'false');
      icon.classList.remove('rotate-180');
    } else {
      content.classList.remove('max-h-0', 'p-0');
      content.classList.add('p-4', 'max-h-[40rem]');
      headerElement.classList.add('border-b');
      headerElement.setAttribute('aria-expanded', 'true');
      icon.classList.add('rotate-180');
    }
  };

  const loadMainCategories = async () => {
    const categoriesContainer = document.getElementById('mainCategories');
    try {
      const { data, error } = await supabaseClient.from('contacts_repertoire').select('categorie_principale');
      if (error) throw error;
      const categories = [...new Set(data.map(item => item.categorie_principale))].filter(Boolean).sort();
      
      if (categories.length === 0) {
         categoriesContainer.innerHTML = '<p class="text-gray-600">Aucune catégorie trouvée.</p>';
         return;
      }
      categoriesContainer.innerHTML = categories.map(categorie => `
        <label class="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-full cursor-pointer hover:bg-gray-100 transition-all shadow-sm">
          <input type="checkbox" value="${categorie}" onchange="window.updateSubCategories()" class="rounded text-blue-600 focus:ring-blue-500">
          <span class="font-medium text-gray-700">${categorie}</span>
        </label>
      `).join('');
    } catch (error) {
      categoriesContainer.innerHTML = `<p class="text-red-600">Erreur chargement catégories: ${error.message}</p>`;
    }
  }

  const populateZoneFilters = async (selectedMainCategories) => {
    zoneCheckboxContainer.innerHTML = '<p class="text-gray-600">Chargement des zones...</p>';
    const zonableCategories = ['MIA', 'DSE'];
    const relevantCategories = selectedMainCategories.filter(cat => zonableCategories.includes(cat));
    if (relevantCategories.length === 0) {
        zoneCheckboxContainer.innerHTML = '';
        return;
    }
    try {
        const { data, error } = await supabaseClient.from('contacts_repertoire').select('zone').in('categorie_principale', relevantCategories);
        if (error) throw error;
        const zones = [...new Set(data.map(item => item.zone))].filter(Boolean).sort();
        zoneCheckboxContainer.innerHTML = zones.map(zone => `
            <label class="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-full cursor-pointer hover:bg-gray-100 transition-all shadow-sm">
                <input type="checkbox" value="${zone}" onchange="window.updateDisplay()" class="rounded text-blue-600 focus:ring-blue-500">
                <span class="font-medium text-gray-700">${zone}</span>
            </label>
        `).join('');
    } catch (error) {
        zoneCheckboxContainer.innerHTML = `<p class="text-red-600">Erreur zones: ${error.message}</p>`;
    }
  }

  async function updateSubCategories() {
    const mainChecked = Array.from(document.querySelectorAll('#mainCategories input:checked')).map(cb => cb.value);
    const zonableCategories = ['MIA', 'DSE']; 
    const showZoneFilters = mainChecked.some(cat => zonableCategories.includes(cat));
    if (showZoneFilters) {
        zoneContainer.style.display = 'block';
        await populateZoneFilters(mainChecked);
    } else {
        zoneContainer.style.display = 'none';
        zoneCheckboxContainer.innerHTML = '';
    }
    updateDisplay();
  }

  async function updateDisplay() {
    if (!resultDisplay) return;
    resultDisplay.innerHTML = '<div class="flex justify-center items-center py-10"><i data-lucide="loader-2" class="w-8 h-8 text-blue-600 animate-spin"></i></div>';
    lucide.createIcons();
    updateViewToggleUI();

    const mainChecked = Array.from(document.querySelectorAll('#mainCategories input:checked')).map(cb => cb.value);
    const zoneSubChecked = Array.from(document.querySelectorAll('#zoneSubCategories input:checked')).map(cb => cb.value);
    const searchTerm = document.getElementById('search-bar').value.trim();

    let query = supabaseClient.from('contacts_repertoire').select('id, nom, tel, groupe, email, categorie_principale, zone').order('nom', { ascending: (currentSortOrder === 'az') });
    
    // ... (Logique de construction des filtres OR identique) ...
    const orFilters = [];
    const categoriesWithZones = ['MIA', 'DSE'];
    const mainCategoriesWithZones = mainChecked.filter(cat => categoriesWithZones.includes(cat));
    const mainCategoriesWithoutZones = mainChecked.filter(cat => !categoriesWithZones.includes(cat));
    if (mainCategoriesWithZones.length > 0) {
      if (zoneSubChecked.length > 0) {
        zoneSubChecked.forEach(zone => {
          if (zone === 'FTY') {
            if (mainCategoriesWithZones.includes('MIA')) orFilters.push(`and(categorie_principale.eq.MIA,zone.eq.FTY),and(categorie_principale.eq.MIA,zone.eq.FMS,groupe.eq.TL/MPI)`);
            if (mainCategoriesWithZones.includes('DSE')) orFilters.push(`and(categorie_principale.eq.DSE,zone.eq.FTY)`);
          } else {
            mainCategoriesWithZones.forEach(cat => orFilters.push(`and(categorie_principale.eq.${cat},zone.eq.${zone})`));
          }
        });
      } else {
        mainCategoriesWithZones.forEach(cat => orFilters.push(`categorie_principale.eq.${cat}`));
      }
    }
    mainCategoriesWithoutZones.forEach(cat => orFilters.push(`categorie_principale.eq.${cat}`));

    if (orFilters.length > 0) query = query.or(orFilters.join(','));
    if (searchTerm) query = query.or(`nom.ilike.*${searchTerm}*,tel.ilike.*${searchTerm}*,email.ilike.*${searchTerm}*,groupe.ilike.*${searchTerm}*`);

    if (orFilters.length === 0 && !searchTerm) {
      resultDisplay.innerHTML = '<p class="text-gray-600">Veuillez sélectionner une catégorie ou lancer une recherche.</p>';
      return;
    }

    const { data: contacts, error } = await query;
    if (error) { resultDisplay.innerHTML = `<p class'text-red-600'>Erreur: ${error.message}</p>`; return; }

    const columns = {};
    let hasContent = false;
    for (const contact of contacts) {
      const col = contact.groupe;
      if (!columns[col]) columns[col] = [];
      columns[col].push(contact);
      hasContent = true;
    }

    // ... (Rendu HTML Grille/Liste identique à votre code existant) ...
    // Pour la brièveté, j'insère le bloc de rendu générique
    if (!hasContent) {
      resultDisplay.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-lg border border-dashed border-gray-300"><i data-lucide="user-x" class="w-16 h-16 text-gray-300"></i><h3 class="mt-4 text-xl font-semibold text-gray-800">Aucun contact trouvé</h3></div>`;
    } else {
      let outputHTML = currentView === 'list' ? '<div class="space-y-6">' : '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:items-start">';
      const sortedKeys = Object.keys(columns).sort();
      
      for (const col of sortedKeys) {
        const colName = window.highlightText(col, searchTerm);
        const groupId = `group-${col.replace(/[^a-zA-Z0-9]/g, '-')}`;
        
        if (currentView === 'list') {
            outputHTML += `<div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"><h3 class="text-xl font-semibold text-gray-900 p-4 border-b bg-gray-50">${colName}</h3><div class="divide-y divide-gray-100">`;
            outputHTML += columns[col].map(p => renderContactRow(p, searchTerm)).join('');
            outputHTML += `</div></div>`;
        } else {
            outputHTML += `<div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <h3 class="text-xl font-semibold text-gray-900 p-4 border-b bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors" onclick="window.toggleGroup('${groupId}', this)">
                    <span>${colName}</span><i data-lucide="chevron-down" class="w-5 h-5 transition-transform duration-300 ease-in-out rotate-180"></i>
                </h3>
                <div id="${groupId}" class="flex flex-col gap-3 p-4 overflow-hidden overflow-y-auto transition-all duration-300 ease-in-out max-h-[40rem]">
                    ${columns[col].map(p => renderContactCard(p, searchTerm)).join('')}
                </div>
            </div>`;
        }
      }
      outputHTML += '</div>';
      resultDisplay.innerHTML = outputHTML;
    }
    
    lucide.createIcons();
    if (window.hideAdminElements) window.hideAdminElements();
  }

  function renderContactRow(p, searchTerm) {
     const contactJson = JSON.stringify(p).replace(/"/g, "&quot;");
     const displayName = window.highlightText(p.nom, searchTerm);
     const formattedPhone = p.tel ? window.formatPhoneNumber(window.cleanPhoneNumber(p.tel)) : '(manquant)';
     const displayTel = window.highlightText(formattedPhone, searchTerm);
     const cleanPhone = window.cleanPhoneNumber(p.tel);
     return `
        <div class="flex items-center justify-between p-4 hover:bg-gray-50">
          <div class="flex items-center gap-4 flex-grow min-w-0">
            <i data-lucide="user" class="w-5 h-5 text-gray-500 flex-shrink-0"></i>
            <div class="flex-grow min-w-0">
              <div class="text-sm font-medium text-gray-900 truncate">${displayName}</div>
              <div class="flex flex-col sm:flex-row sm:items-center sm:gap-4 sm:flex-wrap mt-1">
                ${p.tel ? `<a href="etrali:${cleanPhone}" class="flex items-center gap-2 text-sm font-mono text-blue-600 hover:text-blue-800 flex-shrink-0"><i data-lucide="phone" class="w-4 h-4"></i><span>${displayTel}</span></a>` : ''}
                ${p.email ? `<a href="mailto:${p.email}" class="flex items-center gap-2 text-sm font-mono text-gray-600 hover:text-blue-800 min-w-0"><i data-lucide="mail" class="w-4 h-4 flex-shrink-0"></i><span class="truncate">${p.email}</span></a>` : ''}
              </div>
            </div>
          </div>
          <div class="admin-only flex items-center gap-1 flex-shrink-0 ml-4">
              <button onclick='window.showContactModal(${contactJson})' class="p-1 text-blue-600 rounded hover:bg-blue-100"><i data-lucide="pencil" class="w-4 h-4"></i></button>
              <button onclick="window.deleteContact(${p.id}, '${p.nom}')" class="p-1 text-red-600 rounded hover:bg-red-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </div>`;
  }

  function renderContactCard(p, searchTerm) {
      const contactJson = JSON.stringify(p).replace(/"/g, "&quot;");
      const displayName = window.highlightText(p.nom, searchTerm);
      const formattedPhone = p.tel ? window.formatPhoneNumber(window.cleanPhoneNumber(p.tel)) : '(manquant)';
      const cleanPhone = window.cleanPhoneNumber(p.tel);
      return `
        <div class="bg-gray-50 rounded-lg border border-gray-200 transition-all hover:shadow-sm">
          <div class="flex items-center justify-between p-3 border-b border-gray-100">
            <span class="flex items-center gap-2.5 text-sm font-medium text-gray-900"><i data-lucide="user" class="w-4 h-4 text-gray-600"></i><span>${displayName}</span></span>
            <div class="admin-only flex items-center gap-2">
                <button onclick='window.showContactModal(${contactJson})' class="p-1 text-blue-600 rounded hover:bg-blue-100"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button onclick="window.deleteContact(${p.id}, '${p.nom}')" class="p-1 text-red-600 rounded hover:bg-red-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
          </div>
          <div class="p-3 flex flex-col gap-2">
             ${p.tel ? `<a href="etrali:${cleanPhone}" class="flex items-center gap-2 text-sm font-mono text-blue-600 hover:text-blue-800 transition-colors"><i data-lucide="phone" class="w-4 h-4"></i><span>${formattedPhone}</span></a>` : ''}
             ${p.email ? `<a href="mailto:${p.email}" class="flex items-center gap-2 text-sm font-mono text-gray-600 hover:text-blue-800 transition-colors"><i data-lucide="mail" class="w-4 h-4"></i><span class="truncate">${p.email}</span></a>` : ''}
          </div>
        </div>`;
  }

  window.exportRepertoireData = async (format) => {
    // ... (votre fonction exportRepertoireData existante et fonctionnelle) ...
    // Je la remets pour complétude
    const mainChecked = Array.from(document.querySelectorAll('#mainCategories input:checked')).map(cb => cb.value);
    const zoneSubChecked = Array.from(document.querySelectorAll('#zoneSubCategories input:checked')).map(cb => cb.value);
    const searchTerm = document.getElementById('search-bar').value.trim();

    if (mainChecked.length === 0 && !searchTerm) { notyf.error("Sélectionnez une catégorie."); return; }
    notyf.success("Génération...");

    // Construction requête (simplifiée)
    let query = supabaseClient.from('contacts_repertoire').select('nom, tel, email, groupe, categorie_principale, zone').order('nom', { ascending: true });
    // ... (logique de filtres identique à updateDisplay) ...
    const orFilters = [];
    const categoriesWithZones = ['MIA', 'DSE'];
    const mainCategoriesWithZones = mainChecked.filter(cat => categoriesWithZones.includes(cat));
    const mainCategoriesWithoutZones = mainChecked.filter(cat => !categoriesWithZones.includes(cat));
    if (mainCategoriesWithZones.length > 0) {
      if (zoneSubChecked.length > 0) {
        zoneSubChecked.forEach(zone => {
          if (zone === 'FTY') {
            if (mainCategoriesWithZones.includes('MIA')) orFilters.push(`and(categorie_principale.eq.MIA,zone.eq.FTY),and(categorie_principale.eq.MIA,zone.eq.FMS,groupe.eq.TL/MPI)`);
            if (mainCategoriesWithZones.includes('DSE')) orFilters.push(`and(categorie_principale.eq.DSE,zone.eq.FTY)`);
          } else {
            mainCategoriesWithZones.forEach(cat => orFilters.push(`and(categorie_principale.eq.${cat},zone.eq.${zone})`));
          }
        });
      } else { mainCategoriesWithZones.forEach(cat => orFilters.push(`categorie_principale.eq.${cat}`)); }
    }
    mainCategoriesWithoutZones.forEach(cat => orFilters.push(`categorie_principale.eq.${cat}`));

    if (orFilters.length > 0) query = query.or(orFilters.join(','));
    if (searchTerm) query = query.or(`nom.ilike.*${searchTerm}*,tel.ilike.*${searchTerm}*,email.ilike.*${searchTerm}*,groupe.ilike.*${searchTerm}*`);

    try {
        const { data } = await query;
        if (!data || !data.length) { notyf.error("Aucun contact."); return; }
        const exportData = data.map(c => ({ "Nom": c.nom, "Groupe": c.groupe, "Téléphone": c.tel ? window.formatPhoneNumber(window.cleanPhoneNumber(c.tel)) : '', "Email": c.email || '', "Catégorie": c.categorie_principale, "Zone": c.zone || '' }));
        const dateStr = new Date().toISOString().split('T')[0];
        if (format === 'xlsx') window.exportToXLSX(exportData, `Repertoire_${dateStr}.xlsx`);
        else if (format === 'pdf') window.exportToPDF(exportData, `Repertoire_${dateStr}.pdf`, "Répertoire Téléphonique");
    } catch (error) { console.error(error); notyf.error("Erreur export."); }
  };

  window.deleteContact = async (id, nom) => {
    if (!confirm(`Supprimer "${nom}" ?`)) return;
    const { error } = await supabaseClient.from('contacts_repertoire').delete().eq('id', id);
    if (error) notyf.error("Erreur: " + error.message);
    else { notyf.success("Contact supprimé !"); loadMainCategories(); updateDisplay(); }
  }

  // --- Écouteurs et Lancement ---
  sortAzButton.addEventListener('click', () => {
    if (currentSortOrder === 'az') return;
    currentSortOrder = 'az';
    updateDisplay();
  });
  sortZaButton.addEventListener('click', () => {
    if (currentSortOrder === 'za') return;
    currentSortOrder = 'za';
    updateDisplay();
  });
  viewToggleGrid.addEventListener('click', () => setView('grid'));
  viewToggleList.addEventListener('click', () => setView('list'));

  loadMainCategories();
  updateDisplay(); 
};