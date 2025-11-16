// js/pages/pmr.js

window.pageInit = () => {
    
  const notyf = (typeof Notyf !== 'undefined') 
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) }; // Fallback

  // --- RÉFÉRENCES DOM (DÉPLACÉES À L'INTÉRIEUR) ---
  const resultDisplay = document.getElementById('resultDisplay');
  const searchInput = document.getElementById('search-bar');
  const zoneFilter = document.getElementById('filter-zone');
  const etatFilter = document.getElementById('filter-etat');
  const typeFilter = document.getElementById('filter-type');
  
  const modal = document.getElementById('pmr-modal');
  const modalTitle = document.getElementById('modal-title');
  const pmrForm = document.getElementById('pmr-form');
  const pmrIdInput = document.getElementById('modal-pmr-id');
  const submitButton = document.getElementById('modal-submit-button');
  
  /**
   * Charge et affiche les données PMR en fonction des filtres
   */
  // CORRECTION : Attacher à window
  window.loadPmrData = async () => {
    resultDisplay.innerHTML = '<div class="col-span-full flex justify-center items-center py-20"><i data-lucide="loader-2" class="w-10 h-10 text-blue-600 animate-spin"></i></div>';
    lucide.createIcons();
    
    try {
      let query = supabaseClient
        .from('pmr_data')
        .select('*')
        .order('gare', { ascending: true }); // Trier par gare A-Z

      // 1. Appliquer les filtres
      const zone = zoneFilter.value;
      const etat = etatFilter.value;
      const type = typeFilter.value;
      const searchTerm = searchInput.value.trim();

      if (zone !== 'all') {
        query = query.eq('zone', zone);
      }
      if (etat !== 'all') {
        query = query.eq('etat_rampe', etat);
      }
      if (type !== 'all') {
        query = query.eq('type_assistance', type);
      }
      
      // 2. Appliquer la recherche
      if (searchTerm) {
        query = query.or(
          `gare.ilike.%${searchTerm}%`,
          `quai.ilike.%${searchTerm}%`,
          `rampe_id.ilike.%${searchTerm}%`
        );
      }
      
      const { data, error } = await query;
      if (error) throw error;

      if (data.length === 0) {
        resultDisplay.innerHTML = `
          <div class="col-span-full flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-lg border border-dashed border-gray-300">
            <i data-lucide="accessibility" class="w-16 h-16 text-gray-300"></i>
            <h3 class="mt-4 text-xl font-semibold text-gray-800">Aucune donnée PMR</h3>
            <p class="mt-2 text-sm text-gray-500">Aucune rampe ou restriction ne correspond à vos filtres actuels.</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      // 3. Afficher les fiches
      resultDisplay.innerHTML = data.map(entry => renderPmrCard(entry)).join('');
      
      lucide.createIcons();
      if (window.hideAdminElements) window.hideAdminElements();

    } catch (error) {
      resultDisplay.innerHTML = `<p class="col-span-full text-red-600 text-center">Erreur: ${error.message}</p>`;
      notyf.error('Erreur lors du chargement des données.');
    }
  }
  
  /**
   * Génère le HTML pour une seule fiche PMR (fonction interne)
   */
  function renderPmrCard(entry) {
    let etatColor = 'text-gray-600 bg-gray-100'; // En attente
    if (entry.etat_rampe === 'OK') {
      etatColor = 'text-green-800 bg-green-100';
    } else if (entry.etat_rampe === 'HS') {
      etatColor = 'text-red-800 bg-red-100';
    }

    let typeColor = 'bg-gray-100 text-gray-800';
    if (entry.type_assistance === 'Taxi') {
      typeColor = 'bg-yellow-100 text-yellow-800';
    } else if (entry.type_assistance === 'Full') {
      typeColor = 'bg-blue-100 text-blue-800';
    } else if (entry.type_assistance === 'Light') {
      typeColor = 'bg-green-100 text-green-800';
    }

    const entryJson = JSON.stringify(entry).replace(/"/g, "&quot;");
    
    const renderInfo = (icon, label, value) => {
      if (!value) return '';
      return `
        <div class="flex items-start gap-3">
          <i data-lucide="${icon}" class="w-4 h-4 text-gray-500 flex-shrink-0 mt-1"></i>
          <div class="text-sm">
            <span class="font-medium text-gray-600">${label}:</span>
            <span class="text-gray-800">${value}</span>
          </div>
        </div>`;
    };
    
    return `
      <div class="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-1">
        <div class="flex justify-between items-start p-4 border-b">
          <div>
            <h3 class="text-xl font-bold text-blue-700">${entry.gare}</h3>
            <span class="text-sm font-medium text-gray-600">Quai: ${entry.quai || 'N/A'}</span>
          </div>
          <div class="flex flex-col items-end gap-2">
            <span class="px-3 py-1 text-sm font-bold rounded-full ${etatColor}">
              ${entry.etat_rampe || 'N/A'}
            </span>
            ${entry.type_assistance ? `
            <span class="px-3 py-1 text-xs font-bold rounded-full ${typeColor}">
              ${entry.type_assistance}
            </span>` : ''}
          </div>
        </div>
        <div class="p-4 space-y-3">
          ${renderInfo('combine', 'Type', entry.type_rampe)}
          ${renderInfo('hash', 'ID Rampe', entry.rampe_id)}
          ${renderInfo('shield', 'Zone', entry.zone)}
          ${renderInfo('calendar', 'Validité', entry.validite)}
          ${renderInfo('lock', 'Cadenas', entry.cadenas)}
          ${entry.reparation_demandee ? `<div class="flex items-center gap-2 text-yellow-600"><i data-lucide="wrench" class="w-4 h-4"></i><span class="text-sm font-medium">Réparation demandée</span></div>` : ''}
        </div>
        ${(entry.remarque_rampe || entry.restrictions_gare || entry.remarque_gare) ? `
        <div class="p-4 border-t space-y-3">
          ${renderInfo('alert-circle', 'Rem. Rampe', entry.remarque_rampe)}
          ${renderInfo('alert-triangle', 'Restrictions', entry.restrictions_gare)}
          ${renderInfo('info', 'Rem. Gare', entry.remarque_gare)}
        </div>
        ` : ''}
        <div class="admin-only flex justify-end items-center p-3 bg-gray-50 border-t gap-2">
          <button onclick="window.deletePmrEntry(${entry.id}, '${entry.gare}', '${entry.quai}')" class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-600 bg-red-100 rounded hover:bg-red-200">
            <i data-lucide="trash-2" class="w-3 h-3"></i> Supprimer
          </button>
          <button onclick="window.showPmrModal(${entryJson})" class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200">
            <i data-lucide="pencil" class="w-3 h-3"></i> Modifier
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Ouvre et pré-remplit le modal
   */
  // CORRECTION : Attacher à window
  window.showPmrModal = (entry = null) => {
    pmrForm.reset();
    const isEdit = entry !== null;
    
    modalTitle.textContent = isEdit ? `Modifier: ${entry.gare} (Quai ${entry.quai})` : 'Ajouter une entrée PMR';
    pmrIdInput.value = isEdit ? entry.id : '';
    
    document.getElementById('modal-gare').value = isEdit ? entry.gare : '';
    document.getElementById('modal-quai').value = isEdit ? entry.quai : '';
    document.getElementById('modal-zone').value = isEdit ? entry.zone : '';
    document.getElementById('modal-type-assistance').value = isEdit ? (entry.type_assistance || 'N/A') : 'N/A';
    document.getElementById('modal-type-rampe').value = isEdit ? (entry.type_rampe || 'Aucune') : 'Aucune';
    document.getElementById('modal-rampe-id').value = isEdit ? entry.rampe_id : '';
    document.getElementById('modal-etat-rampe').value = isEdit ? (entry.etat_rampe || 'OK') : 'OK';
    document.getElementById('modal-validite').value = isEdit ? entry.validite : '';
    document.getElementById('modal-cadenas').value = isEdit ? entry.cadenas : '';
    document.getElementById('modal-reparation').checked = isEdit ? entry.reparation_demandee : false;
    document.getElementById('modal-remarque-rampe').value = isEdit ? entry.remarque_rampe : '';
    document.getElementById('modal-restrictions-gare').value = isEdit ? entry.restrictions_gare : '';
    document.getElementById('modal-remarque-gare').value = isEdit ? entry.remarque_gare : '';
    
    modal.style.display = 'flex';
    lucide.createIcons();
  }
  
  /**
   * Cache le modal
   */
  // CORRECTION : Attacher à window
  window.hidePmrModal = () => {
    modal.style.display = 'none';
  }
  
  /**
   * Gère la soumission du formulaire (Ajout/Modification)
   */
  // CORRECTION : Attacher à window
  window.handlePmrFormSubmit = async (event) => {
    event.preventDefault();
    
    const pmrId = pmrIdInput.value;
    const isEdit = pmrId !== '';
    
    const entryData = {
      gare: document.getElementById('modal-gare').value,
      quai: document.getElementById('modal-quai').value,
      zone: document.getElementById('modal-zone').value,
      type_assistance: document.getElementById('modal-type-assistance').value,
      type_rampe: document.getElementById('modal-type-rampe').value,
      rampe_id: document.getElementById('modal-rampe-id').value,
      etat_rampe: document.getElementById('modal-etat-rampe').value,
      validite: document.getElementById('modal-validite').value,
      cadenas: document.getElementById('modal-cadenas').value,
      reparation_demandee: document.getElementById('modal-reparation').checked,
      remarque_rampe: document.getElementById('modal-remarque-rampe').value,
      restrictions_gare: document.getElementById('modal-restrictions-gare').value,
      remarque_gare: document.getElementById('modal-remarque-gare').value,
    };
    
    Object.keys(entryData).forEach(key => {
      if (entryData[key] === '' || entryData[key] === 'N/A') entryData[key] = null;
    });
    
    submitButton.disabled = true;
    submitButton.textContent = 'Enregistrement...';

    try {
      let error;
      if (isEdit) {
        const { error: updateError } = await supabaseClient
          .from('pmr_data')
          .update(entryData)
          .eq('id', pmrId);
        error = updateError;
      } else {
        const { error: insertError } = await supabaseClient
          .from('pmr_data')
          .insert([entryData]);
        error = insertError;
      }
      if (error) throw error;
      
      notyf.success(isEdit ? "Entrée mise à jour !" : "Entrée ajoutée !");
      window.hidePmrModal();
      window.loadPmrData();
      
    } catch (error) {
      notyf.error("Erreur lors de l'opération: " + error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Enregistrer';
    }
  }
  
  /**
   * Supprime une entrée PMR
   */
  // CORRECTION : Attacher à window
  window.deletePmrEntry = async (id, gare, quai) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'entrée pour ${gare} (Quai ${quai || 'N/A'}) ?`)) {
      return;
    }
    try {
      const { error } = await supabaseClient
        .from('pmr_data')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      notyf.success("Entrée supprimée !");
      window.loadPmrData();
    } catch (error) {
       notyf.error("Erreur: " + error.message);
    }
  }

  // --- Gérer le paramètre de recherche dans l'URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get('search');
  if (searchParam) {
      searchInput.value = searchParam;
  }

  // --- Lancement initial ---
  window.loadPmrData(); // Appeler la fonction globale

}; // Fin de window.pageInit