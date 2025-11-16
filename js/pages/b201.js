// js/pages/remise.js

window.pageInit = () => {

  // --- GARDE DE SÉCURITÉ ---
  const calendarEl = document.getElementById('b201-calendar');
  // Si cet élément n'existe pas, on n'est PAS sur la page remise.html.
  if (!calendarEl) {
    return; // Arrêter l'exécution pour éviter les erreurs
  }
  // --- FIN DE LA GARDE ---

  const notyf = (typeof Notyf !== 'undefined') 
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  // --- Références DOM ---
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

  // --- Références DOM (Présence) ---
  const myPresenceStatus = document.getElementById('my-presence-status');
  const presentListContainer = document.getElementById('present-list-container');
  const rccaNuitWarning = document.getElementById('rcca-nuit-warning');
  const adminPresenceLoading = document.getElementById('admin-presence-loading');
  const adminPresenceLists = document.getElementById('admin-presence-lists');
  const adminListAbsent = document.getElementById('admin-list-absent');
  
  // --- État de l'application ---
  let selectedDate = new Date();
  let selectedShift = 'matin';
  let currentRemiseId = null;
  let saveTimer = null;
  let currentUserId = null;
  let currentUserRole = 'user';
  
  let garesCache = [];
  let societesCache = [];
  let taxiSocietesCache = [];

  // ==========================================================
  // == GESTION DE L'AUTOCOMPLÉTION STYLISÉE (CORRIGÉ)
  // ==========================================================
  
  function setupAutocomplete(inputId, dataCache) {
    const input = document.getElementById(inputId);
    if (!input) {
        console.warn(`Input non trouvé pour autocomplete: ${inputId}`);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'relative autocomplete-container';
    
    // Insérer le wrapper et y déplacer l'input
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    
    const suggestionsList = document.createElement('div');
    suggestionsList.className = 'autocomplete-suggestions hidden absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto';
    wrapper.appendChild(suggestionsList);

    input.addEventListener('input', () => {
      const query = input.value.toLowerCase();
      if (query.length === 0) {
        suggestionsList.classList.add('hidden');
        return;
      }
      
      const filteredData = dataCache.filter(item => 
        item.toLowerCase().includes(query)
      );
      
      if (filteredData.length === 0) {
        suggestionsList.classList.add('hidden');
        return;
      }
      
      // CORRECTION : 'class' au lieu de 'class_name'
      suggestionsList.innerHTML = filteredData.map(item => `
        <div class="suggestion-item p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-800 dark:text-gray-200" data-value="${item}">
          ${item}
        </div>
      `).join('');
      suggestionsList.classList.remove('hidden');
    });
    
    // CORRECTION : Utiliser 'mousedown' est plus fiable que 'click' pour les popups
    suggestionsList.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        e.preventDefault(); // Empêche l'input de perdre le focus
        input.value = item.dataset.value;
        suggestionsList.classList.add('hidden');
      }
    });
    
    // Cacher si on clique en dehors
    input.addEventListener('blur', () => {
        // Léger délai pour permettre au clic de s'enregistrer
        setTimeout(() => suggestionsList.classList.add('hidden'), 150);
    });
  }

  // ==========================================================
  // == Fonctions de chargement des données
  // ==========================================================
  
  async function loadPtCarGares() {
    try {
      const { data, error } = await supabaseClient.from('ptcar_abbreviations').select('ptcar_fr').not('ptcar_fr', 'is', null).order('ptcar_fr', { ascending: true });
      if (error) throw error;
      garesCache = [...new Set(data.map(item => item.ptcar_fr))];
    } catch (error) { console.error("Erreur chargement gares (PtCar):", error.message); }
  }
  
  async function loadBusSocietes() {
    try {
      const { data, error } = await supabaseClient.from('societes_bus').select('nom').order('nom', { ascending: true });
      if (error) throw error;
      societesCache = data.map(societe => societe.nom);
    } catch (error) { console.error("Erreur chargement sociétés bus:", error.message); }
  }
  
  async function loadTaxiSocietes() {
    try {
      const { data, error } = await supabaseClient.from('taxis').select('nom').order('nom', { ascending: true });
      if (error) throw error;
      taxiSocietesCache = data.map(taxi => taxi.nom);
    } catch (error) { console.error("Erreur chargement sociétés taxi:", error.message); }
  }

  // --- Initialisation ---

  // 1. Initialiser Flatpickr (CORRIGÉ : s'attache à l'input)
  const calendar = flatpickr(calendarEl, {
    defaultDate: selectedDate,
    locale: "fr",
    dateFormat: "d/m/Y",
    appendTo: document.body, 
    onReady: (selectedDates, dateStr, instance) => {
      instance.calendarContainer.classList.add('font-sans', 'baco-theme');
    },
    onChange: (dates) => {
      selectedDate = dates[0];
      loadPageData();
    }
  });

  // 2. Initialiser les onglets de Shift
  shiftTabsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('shift-tab')) {
      shiftTabsContainer.querySelectorAll('.shift-tab').forEach(tab => tab.classList.remove('active'));
      e.target.classList.add('active');
      selectedShift = e.target.dataset.shift;
      loadPageData();
    }
  });
  
  // 3. Définir le shift actuel par défaut
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 13) { selectedShift = 'matin'; }
  else if (currentHour >= 13 && currentHour < 21) { selectedShift = 'apres-midi'; }
  else {
    selectedShift = 'nuit';
    if (currentHour < 5) {
      selectedDate.setDate(selectedDate.getDate() - 1);
      calendar.setDate(selectedDate);
    }
  }
  shiftTabsContainer.querySelector(`.shift-tab[data-shift="${selectedShift}"]`).classList.add('active');
  
  // 4. Lancement principal (CORRIGÉ)
  (async () => {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        currentUserId = user.id;
        currentUserRole = user.user_metadata.role || 'user';
      }
      
      // 1. Charger les listes de cache
      await Promise.all([
        loadPtCarGares(),
        loadBusSocietes(),
        loadTaxiSocietes()
      ]);
      
      // 2. MAINTENANT, attacher les listeners d'autocomplétion
      // (Doit être appelé APRÈS que les caches soient pleins)
      setupAutocomplete('bus-societe', societesCache);
      setupAutocomplete('bus-depart', garesCache);
      setupAutocomplete('bus-arrivee', garesCache);
      setupAutocomplete('taxi-societe', taxiSocietesCache);
      setupAutocomplete('taxi-depart', garesCache);
      setupAutocomplete('taxi-arrivee', garesCache);
      setupAutocomplete('int-gare', garesCache);
      setupAutocomplete('pmr-depart', garesCache);
      setupAutocomplete('pmr-arrivee', garesCache);
      
      // 3. Enfin, charger les données de la remise
      loadPageData();
  })();

  // --- Fonctions de Chargement de Page ---

  function loadPageData() {
    const dateString = selectedDate.toISOString().split('T')[0];
    contentEl.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
    
    myPresenceStatus.innerHTML = '<div class="flex justify-center items-center py-2"><i data-lucide="loader-2" class="w-5 h-5 text-blue-600 animate-spin"></i></div>';
    presentListContainer.innerHTML = '<p class="text-sm text-gray-400">Chargement...</p>';
    if (currentUserRole === 'admin') {
      adminPresenceLists.classList.add('hidden'); // C'est un <details>, on ne le cache pas
      adminPresenceLoading.classList.remove('hidden');
    }
    lucide.createIcons();

    Promise.all([
      loadRemiseData(dateString, selectedShift),
      loadPresenceData(dateString, selectedShift, currentUserRole === 'admin')
    ]).finally(() => {
      loadingSpinner.classList.add('hidden');
      contentEl.classList.remove('hidden');
      if (currentUserRole === 'admin') {
        adminPresenceLoading.classList.add('hidden');
        adminPresenceLists.classList.remove('hidden'); // C'est un <details>
      }
    });
  }

  async function loadRemiseData(dateString, shift) {
    // ... (Cette fonction est correcte et reste inchangée)
    try {
      let { data: remise, error } = await supabaseClient
        .from('remises')
        .select(`id, message_general, remise_bus(*, profiles(full_name)), remise_taxi(*, profiles(full_name)), remise_intervention(*, profiles(full_name)), remise_pmr(*, profiles(full_name))`)
        .eq('date', dateString)
        .eq('shift', shift)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (!remise) {
        const { data: newRemise, error: createError } = await supabaseClient
          .from('remises')
          .insert({ date: dateString, shift: shift, user_id: currentUserId })
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
    } catch (error) {
      notyf.error("Erreur chargement remise: " + error.message);
    }
  }
  
  // --- Logique de Présence (inchangée) ---
  
  async function loadPresenceData(dateString, shift, isAdmin) {
    const isRccaNuit = (shift === 'nuit');
    try {
      let allProfiles = [];
      if (isAdmin) {
        const { data, error } = await supabaseClient.from('profiles').select('id, full_name').order('full_name');
        if (error) throw error;
        allProfiles = data;
      }
      const { data: presences, error: presenceError } = await supabaseClient
        .from('presences')
        .select('id, user_id, service, check_in_time, check_out_time, profiles:profiles!user_id(full_name)')
        .eq('date', dateString)
        .eq('shift', shift);
      if (presenceError) throw presenceError;
      
      renderMyStatus(presences, isRccaNuit, shift);
      renderPresentList(presences, isRccaNuit);
      
      if (isAdmin) {
        renderAdminAbsentList(allProfiles, presences, isRccaNuit, shift);
      }
    } catch (error) {
      notyf.error("Erreur chargement présence: " + error.message);
    }
  }

  function renderMyStatus(presences, isRccaNuit, shift) {
    const myPresence = presences.find(p => p.user_id === currentUserId);
    const isPresent = myPresence && !myPresence.check_out_time;

    if (isRccaNuit) {
      myPresenceStatus.innerHTML = `<p class="text-sm text-gray-500 italic">Pointage non requis pour RCCA Nuit.</p>`;
      if (!isPresent) {
         myPresenceStatus.innerHTML += `
            <button onclick="window.handleMyPresenceClick(null, 'checkin', 'PACO')"
                    class="mt-2 px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200">
              Check-in (PACO)
            </button>`;
      } else if (isPresent && myPresence.service === 'PACO') {
        // Permet le check-out si on s'est check-in en PACO
        myPresenceStatus.innerHTML = `
          <span class="flex items-center gap-2 text-lg font-semibold text-green-600">
            <i data-lucide="check-circle" class="w-5 h-5"></i>
            Pointé (Service: ${myPresence.service})
          </span>
          <button onclick="window.handleMyPresenceClick('${myPresence.id}', 'checkout', '')"
                  class="px-3 py-1 text-sm font-medium bg-red-100 text-red-700 rounded-full hover:bg-red-200">
            Check-out
          </button>`;
      }
    } else if (isPresent) {
      myPresenceStatus.innerHTML = `
        <span class="flex items-center gap-2 text-lg font-semibold text-green-600">
          <i data-lucide="check-circle" class="w-5 h-5"></i>
          Pointé (Service: ${myPresence.service})
        </span>
        <button onclick="window.handleMyPresenceClick('${myPresence.id}', 'checkout', '')"
                class="px-3 py-1 text-sm font-medium bg-red-100 text-red-700 rounded-full hover:bg-red-200">
          Check-out
        </button>`;
    } else {
      myPresenceStatus.innerHTML = `
        <span class="flex items-center gap-2 text-lg font-semibold text-gray-500">
          <i data-lucide="x-circle" class="w-5 h-5"></i>
          Non pointé
        </span>
        <button onclick="window.handleMyPresenceClick(null, 'checkin', 'PACO')"
                class="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200">
          Check-in (PACO)
        </button>
        <button onclick="window.handleMyPresenceClick(null, 'checkin', 'RCCA')"
                class="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200">
          Check-in (RCCA)
        </button>`;
    }
    lucide.createIcons();
  }

  function renderPresentList(presences, isRccaNuit) {
    presentListContainer.innerHTML = '';
    let pacoHtml = '';
    let rccaHtml = '';
    const present = presences.filter(p => !p.check_out_time);
    present.forEach(p => {
      const userHtml = `
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
          <span class="text-sm font-medium text-gray-800 dark:text-gray-200">${p.profiles.full_name}</span>
        </div>`;
      if (p.service === 'PACO') pacoHtml += userHtml;
      else if (p.service === 'RCCA') rccaHtml += userHtml;
    });
    let finalHtml = '';
    if (pacoHtml) {
      finalHtml += `<h5 class="text-sm font-semibold text-gray-600 dark:text-gray-400">PACO</h5><div class="space-y-2 mt-1 mb-3">${pacoHtml}</div>`;
    }
    if (rccaHtml && !isRccaNuit) {
      finalHtml += `<h5 class="text-sm font-semibold text-gray-600 dark:text-gray-400">RCCA</h5><div class="space-y-2 mt-1 mb-3">${rccaHtml}</div>`;
    }
    if (finalHtml === '') {
      finalHtml = '<p class="text-sm text-gray-400 dark:text-gray-500">Personne n\'est présent.</p>';
    }
    presentListContainer.innerHTML = finalHtml;
  }

  function renderAdminAbsentList(allProfiles, presences, isRccaNuit, shift) {
    adminListAbsent.innerHTML = '';
    rccaNuitWarning.style.display = isRccaNuit ? 'block' : 'none';
    const presentUserIds = new Set(presences.map(p => p.user_id));
    allProfiles.forEach(profile => {
      if (!presentUserIds.has(profile.id)) {
        const absentHtml = `
          <div class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
            <span class="text-sm font-medium text-gray-800 dark:text-gray-200">${profile.full_name}</span>
            <button onclick="window.handleAdminPresenceClick('${profile.id}', '${shift}', 'PACO')" 
                    class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200" title="Check-in PACO">
              PACO
            </button>
            ${!isRccaNuit ? `
            <button onclick="window.handleAdminPresenceClick('${profile.id}', '${shift}', 'RCCA')" 
                    class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200" title="Check-in RCCA">
              RCCA
            </button>` : ''}
          </div>`;
        adminListAbsent.innerHTML += absentHtml;
      }
    });
    if (adminListAbsent.innerHTML === '') {
      adminListAbsent.innerHTML = '<p class="text-sm text-gray-400 dark:text-gray-500">Tout le monde est pointé.</p>';
    }
    lucide.createIcons();
  }

  function renderList(listElement, items, type) {
    if (!items || items.length === 0) {
      listElement.innerHTML = `<p class="text-sm text-gray-400 dark:text-gray-500 text-center">Aucune entrée.</p>`;
      return;
    }
    listElement.innerHTML = items.map(item => {
      let summary = '';
      const author = item.profiles ? item.profiles.full_name.split(' ')[0] : '...';
      if (type === 'bus') summary = `<b>${item.societe || 'N/A'}</b>: ${item.gare_depart} ➔ ${item.gare_arrivee} (${item.heure_appel || 'N/A'}) - <i>${item.motif || '...'}</i>`;
      else if (type === 'taxi') summary = `<b>${item.societe || 'N/A'}</b>: ${item.gare_depart} ➔ ${item.gare_arrivee} ${item.is_pmr ? '(<b>PMR</b>)' : ''} (${item.heure_appel || 'N/A'})`;
      else if (type === 'intervention') summary = `<b>${item.type} (${item.gare})</b>: ${item.motif || '...'} (Appel: ${item.heure_appel || 'N/A'}, Fin: ${item.heure_fin || '...'})`;
      else if (type === 'pmr') summary = `<b>${item.type} (${item.dossier_id || 'N/A'})</b>: ${item.gare_depart} ➔ ${item.gare_arrivee} (${item.heure || 'N/A'})`;
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

  // --- Sauvegarde Message ---
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
    const formData = { remise_id: currentRemiseId, user_id: currentUserId, societe: e.target.elements['bus-societe'].value, gare_depart: e.target.elements['bus-depart'].value, gare_arrivee: e.target.elements['bus-arrivee'].value, heure_appel: e.target.elements['bus-heure-appel'].value || null, motif: e.target.elements['bus-motif'].value };
    const { error } = await supabaseClient.from('remise_bus').insert(formData);
    if (error) notyf.error(error.message);
    else { notyf.success("Bus ajouté !"); formBus.reset(); loadPageData(); }
  });
  
  formTaxi.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = { remise_id: currentRemiseId, user_id: currentUserId, societe: e.target.elements['taxi-societe'].value, is_pmr: e.target.elements['taxi-pmr'].checked, gare_depart: e.target.elements['taxi-depart'].value, gare_arrivee: e.target.elements['taxi-arrivee'].value, heure_appel: e.target.elements['taxi-heure-appel'].value || null, motif: e.target.elements['taxi-motif'].value };
    const { error } = await supabaseClient.from('remise_taxi').insert(formData);
    if (error) notyf.error(error.message);
    else { notyf.success("Taxi ajouté !"); formTaxi.reset(); loadPageData(); }
  });
  
  formIntervention.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = { remise_id: currentRemiseId, user_id: currentUserId, gare: e.target.elements['int-gare'].value, type: e.target.elements['int-type'].value, heure_appel: e.target.elements['int-heure-appel'].value || null, heure_arrivee: e.target.elements['int-heure-arrivee'].value || null, motif: e.target.elements['int-motif'].value, heure_fin: e.target.elements['int-heure-fin'].value || null };
    const { error } = await supabaseClient.from('remise_intervention').insert(formData);
    if (error) notyf.error(error.message);
    else { notyf.success("Intervention ajoutée !"); formIntervention.reset(); loadPageData(); }
  });
  
  formPmr.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = { remise_id: currentRemiseId, user_id: currentUserId, type: e.target.elements['pmr-type'].value, gare_depart: e.target.elements['pmr-depart'].value, gare_arrivee: e.target.elements['pmr-arrivee'].value, heure: e.target.elements['pmr-heure'].value || null, dossier_id: e.target.elements['pmr-dossier'].value, remarque: e.target.elements['pmr-remarque'].value };
    const { error } = await supabaseClient.from('remise_pmr').insert(formData);
    if (error) notyf.error(error.message);
    else { notyf.success("PMR ajoutée !"); formPmr.reset(); loadPageData(); }
  });

  // --- Fonctions Globales (onclick) ---
  
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
    else { notyf.success("Élément supprimé."); loadPageData(); }
  }

  window.handleMyPresenceClick = async (presenceId, action, service) => {
    const dateString = selectedDate.toISOString().split('T')[0];
    try {
      if (action === 'checkin') {
        const { error } = await supabaseClient.rpc('user_check_in', { p_date: dateString, p_shift: selectedShift, p_service: service });
        if (error) throw error;
        notyf.success(`Check-in (service ${service}) réussi !`);
      } else if (action === 'checkout') {
        const { error } = await supabaseClient.rpc('user_check_out', { p_presence_id: presenceId });
        if (error) throw error;
        notyf.success('Check-out réussi !');
      }
      loadPageData();
    } catch (error) {
      notyf.error("Erreur de pointage: " + error.message);
    }
  }
  
  window.handleAdminPresenceClick = async (userId, shift, service) => {
    const dateString = selectedDate.toISOString().split('T')[0];
    const actionText = service === 'NONE' ? 'Check-out' : `Check-in (${service})`;
    if (!confirm(`Confirmer ${actionText} pour cet utilisateur ?`)) return;
    try {
      const { error } = await supabaseClient.rpc('admin_set_presence', {
        p_user_id: userId,
        p_date: dateString,
        p_shift: shift,
        p_service: service
      });
      if (error) throw error;
      notyf.success('Statut de présence mis à jour.');
      loadPageData();
    } catch (error) {
       notyf.error("Erreur admin: " + error.message);
    }
  }

}; 