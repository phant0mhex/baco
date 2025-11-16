// js/pages/remise.js

window.pageInit = () => {

  const notyf = (typeof Notyf !== 'undefined') 
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  // --- Références DOM ---
  const calendarEl = document.getElementById('b201-calendar'); // MODIFIÉ (c'est maintenant un input)
  const shiftTabsContainer = document.getElementById('shift-tabs-container');
  const contentEl = document.getElementById('remise-content');
  const loadingSpinner = document.getElementById('loading-spinner');
  const messageGeneralEl = document.getElementById('message-general');
  const saveStatusEl = document.getElementById('save-status');
  
  const listBus = document.getElementById('list-bus');
  const listTaxi = document.getElementById('list-taxi');
  const listIntervention = document.getElementById('list-intervention');
  const listPmr = document.getElementById('list-pmr');

  const formBus = document.getElementById('form-bus');
  const formTaxi = document.getElementById('form-taxi');
  const formIntervention = document.getElementById('form-intervention');
  const formPmr = document.getElementById('form-pmr');
  
  let selectedDate = new Date();
  let selectedShift = 'matin';
  let currentRemiseId = null;
  let saveTimer = null;
  let currentUserId = null;

  // --- Fonctions de chargement des listes (Datalists) ---
  
  async function loadPtCarGares() {
    const datalist = document.getElementById('gares-list');
    if (!datalist) return;
    try {
      const { data, error } = await supabaseClient
        .from('ptcar_abbreviations')
        .select('ptcar_fr')
        .not('ptcar_fr', 'is', null)
        .order('ptcar_fr', { ascending: true });
      if (error) throw error;
      const uniqueGares = [...new Set(data.map(item => item.ptcar_fr))];
      datalist.innerHTML = uniqueGares.map(gare => 
        `<option value="${gare}"></option>`
      ).join('');
    } catch (error) {
      console.error("Erreur chargement gares (PtCar):", error.message);
    }
  }
  
  async function loadBusSocietes() {
    const datalist = document.getElementById('bus-societes-list');
    if (!datalist) return;
    try {
      const { data, error } = await supabaseClient
        .from('societes_bus')
        .select('nom')
        .order('nom', { ascending: true });
      if (error) throw error;
      datalist.innerHTML = data.map(societe => 
        `<option value="${societe.nom}"></option>`
      ).join('');
    } catch (error) {
      console.error("Erreur chargement sociétés bus:", error.message);
    }
  }
  
  // --- Initialisation ---

  // 1. Initialiser Flatpickr (MODIFIÉ)
  const calendar = flatpickr(calendarEl, {
    // inline: false, // Plus besoin de 'inline: true'
    defaultDate: selectedDate,
    locale: "fr",
    dateFormat: "d/m/Y", // Format plus lisible
    appendTo: document.body, // S'assure qu'il s'affiche au-dessus de tout
    onReady: (selectedDates, dateStr, instance) => {
      // Appliquer le thème sombre (copié de layout.js)
      instance.calendarContainer.classList.add('font-sans', 'baco-theme');
    },
    onChange: (dates) => {
      selectedDate = dates[0];
      loadRemiseData();
    }
  });

  // 2. Initialiser les onglets de Shift (inchangé)
  shiftTabsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('shift-tab')) {
      shiftTabsContainer.querySelectorAll('.shift-tab').forEach(tab => tab.classList.remove('active'));
      e.target.classList.add('active');
      selectedShift = e.target.dataset.shift;
      loadRemiseData();
    }
  });
  
  // 3. Définir le shift actuel par défaut (inchangé)
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 13) {
    selectedShift = 'matin';
  } else if (currentHour >= 13 && currentHour < 21) {
    selectedShift = 'apres-midi';
  } else {
    selectedShift = 'nuit';
    if (currentHour < 5) {
      selectedDate.setDate(selectedDate.getDate() - 1);
      calendar.setDate(selectedDate);
    }
  }
  shiftTabsContainer.querySelector(`.shift-tab[data-shift="${selectedShift}"]`).classList.add('active');
  
  // 4. Récupérer l'ID utilisateur et charger TOUTES les données (inchangé)
  (async () => {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) currentUserId = user.id;
      Promise.all([
        loadRemiseData(),
        loadPtCarGares(),
        loadBusSocietes()
      ]);
  })();

  // --- Fonctions Principales (inchangées) ---

  async function loadRemiseData() {
    contentEl.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
    saveStatusEl.textContent = '';
    const dateString = selectedDate.toISOString().split('T')[0];
    try {
      let { data: remise, error } = await supabaseClient
        .from('remises')
        .select(`id, message_general, remise_bus(*, profiles(full_name)), remise_taxi(*, profiles(full_name)), remise_intervention(*, profiles(full_name)), remise_pmr(*, profiles(full_name))`)
        .eq('date', dateString)
        .eq('shift', selectedShift)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (!remise) {
        notyf.success(`Création d'une nouvelle remise pour ${selectedShift}...`);
        const { data: newRemise, error: createError } = await supabaseClient
          .from('remises')
          .insert({ date: dateString, shift: selectedShift, user_id: currentUserId })
          .select('id, message_general')
          .single();
        if (createError) throw createError;
        remise = { ...newRemise, remise_bus: [], remise_taxi: [], remise_intervention: [], remise_pmr: [] };
      }
      currentRemiseId = remise.id;
      messageGeneralEl.value = remise.message_general || '';
      renderList(listBus, remise.remise_bus.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), 'bus');
      renderList(listTaxi, remise.remise_taxi.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), 'taxi');
      renderList(listIntervention, remise.remise_intervention.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), 'intervention');
      renderList(listPmr, remise.remise_pmr.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), 'pmr');
      contentEl.classList.remove('hidden');
    } catch (error) {
      notyf.error("Erreur chargement remise: " + error.message);
    } finally {
      loadingSpinner.classList.add('hidden');
    }
  }

  function renderList(listElement, items, type) {
    if (!items || items.length === 0) {
      listElement.innerHTML = `<p class="text-sm text-gray-400 dark:text-gray-500 text-center">Aucune entrée.</p>`;
      return;
    }
    listElement.innerHTML = items.map(item => {
      let summary = '';
      const author = item.profiles ? item.profiles.full_name.split(' ')[0] : '...';
      if (type === 'bus') {
        summary = `<b>${item.societe || 'N/A'}</b>: ${item.gare_depart} ➔ ${item.gare_arrivee} (${item.heure_appel || 'N/A'}) - <i>${item.motif || '...'}</i>`;
      } else if (type === 'taxi') {
        summary = `<b>${item.societe || 'N/A'}</b>: ${item.gare_depart} ➔ ${item.gare_arrivee} ${item.is_pmr ? '(<b>PMR</b>)' : ''} (${item.heure_appel || 'N/A'})`;
      } else if (type === 'intervention') {
        summary = `<b>${item.type} (${item.gare})</b>: ${item.motif || '...'} (Appel: ${item.heure_appel || 'N/A'}, Fin: ${item.heure_fin || '...'})`;
      } else if (type === 'pmr') {
        summary = `<b>${item.type} (${item.dossier_id || 'N/A'})</b>: ${item.gare_depart} ➔ ${item.gare_arrivee} (${item.heure || 'N/A'})`;
      }
      return `
        <div class="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md flex justify-between items-center text-sm">
          <div class="flex-1 min-w-0">
            <p class="truncate text-gray-800 dark:text-gray-200" title="${summary.replace(/<[^>]*>?/gm, '')}">${summary}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Ajouté par ${author}</p>
          </div>
          <button onclick="window.deleteRemiseItem('${type}', '${item.id}')" class="flex-shrink-0 ml-2 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `;
    }).join('');
    lucide.createIcons();
  }

  messageGeneralEl.addEventListener('input', () => {
    saveStatusEl.textContent = 'Saisie...';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveStatusEl.textContent = 'Sauvegarde...';
      const { error } = await supabaseClient
        .from('remises')
        .update({ message_general: messageGeneralEl.value, updated_at: new Date(), user_id: currentUserId })
        .eq('id', currentRemiseId);
      if (error) {
        saveStatusEl.textContent = 'Erreur sauvegarde.';
        notyf.error(error.message);
      } else {
        saveStatusEl.textContent = `Sauvegardé à ${new Date().toLocaleTimeString('fr-FR')}`;
      }
    }, 1000);
  });

  // --- Gestionnaires de formulaires (inchangés) ---

  formBus.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      remise_id: currentRemiseId, user_id: currentUserId,
      societe: e.target.elements['bus-societe'].value,
      gare_depart: e.target.elements['bus-depart'].value,
      gare_arrivee: e.target.elements['bus-arrivee'].value,
      heure_appel: e.target.elements['bus-heure-appel'].value || null,
      motif: e.target.elements['bus-motif'].value,
    };
    const { error } = await supabaseClient.from('remise_bus').insert(formData);
    if (error) notyf.error(error.message);
    else { notyf.success("Bus ajouté !"); formBus.reset(); loadRemiseData(); }
  });
  
  formTaxi.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      remise_id: currentRemiseId, user_id: currentUserId,
      societe: e.target.elements['taxi-societe'].value,
      is_pmr: e.target.elements['taxi-pmr'].checked,
      gare_depart: e.target.elements['taxi-depart'].value,
      gare_arrivee: e.target.elements['taxi-arrivee'].value,
      heure_appel: e.target.elements['taxi-heure-appel'].value || null,
      motif: e.target.elements['taxi-motif'].value,
    };
    const { error } = await supabaseClient.from('remise_taxi').insert(formData);
    if (error) notyf.error(error.message);
    else { notyf.success("Taxi ajouté !"); formTaxi.reset(); loadRemiseData(); }
  });
  
  formIntervention.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      remise_id: currentRemiseId, user_id: currentUserId,
      gare: e.target.elements['int-gare'].value,
      type: e.target.elements['int-type'].value,
      heure_appel: e.target.elements['int-heure-appel'].value || null,
      heure_arrivee: e.target.elements['int-heure-arrivee'].value || null,
      motif: e.target.elements['int-motif'].value,
      heure_fin: e.target.elements['int-heure-fin'].value || null,
    };
    const { error } = await supabaseClient.from('remise_intervention').insert(formData);
    if (error) notyf.error(error.message);
    else { notyf.success("Intervention ajoutée !"); formIntervention.reset(); loadRemiseData(); }
  });
  
  formPmr.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      remise_id: currentRemiseId, user_id: currentUserId,
      type: e.target.elements['pmr-type'].value,
      gare_depart: e.target.elements['pmr-depart'].value,
      gare_arrivee: e.target.elements['pmr-arrivee'].value,
      heure: e.target.elements['pmr-heure'].value || null,
      dossier_id: e.target.elements['pmr-dossier'].value,
      remarque: e.target.elements['pmr-remarque'].value,
    };
    const { error } = await supabaseClient.from('remise_pmr').insert(formData);
    if (error) notyf.error(error.message);
    else { notyf.success("PMR ajoutée !"); formPmr.reset(); loadRemiseData(); }
  });

  window.deleteRemiseItem = async (type, id) => {
    if (!confirm("Voulez-vous vraiment supprimer cet élément ?")) return;
    let tableName = '';
    if (type === 'bus') tableName = 'remise_bus';
    if (type === 'taxi') tableName = 'remise_taxi';
    if (type === 'intervention') tableName = 'remise_intervention';
    if (type === 'pmr') tableName = 'remise_pmr';
    if (!tableName) return;
    const { error } = await supabaseClient.from(tableName).delete().eq('id', id);
    if (error) notyf.error(error.message);
    else { notyf.success("Élément supprimé."); loadRemiseData(); }
  }

}; // Fin de window.pageInit