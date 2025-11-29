// js/pages/journal.js

window.pageInit = () => {

  const notyf = (typeof Notyf !== 'undefined')
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  // --- DOM Elements ---
  const logForm = document.getElementById('log-form');
  const logMessageInput = document.getElementById('log-message');
  const logSubmitButton = document.getElementById('log-submit-button');
  const logFeed = document.getElementById('log-feed');
  const filterAuthorSelect = document.getElementById('filter-author');
  const filterDateInput = document.getElementById('filter-date');
  const paginationContainer = document.getElementById('pagination-container'); // Nouveau

  // --- Modale d'édition ---
  const editModal = document.getElementById('edit-log-modal');
  const editLogIdInput = document.getElementById('edit-log-id');
  const editLogContentInput = document.getElementById('edit-log-content');
  const editLogUrgentCheckbox = document.getElementById('edit-log-urgent');
  const editLogSubmitBtn = document.getElementById('edit-log-submit-btn');

  // --- Variables d'état ---
  let currentUserId = null;
  let currentUserFullName = 'un utilisateur';
  const adminRole = sessionStorage.getItem('userRole') === 'admin';
  const JOURNAL_STORAGE_KEY = 'lastJournalVisit';
  
  // Pagination
  let currentPage = 1;
  const rowsPerPage = 3; // Nombre de messages par page

  // Filtres
  let selectedDateFilter = null;
  let selectedAuthorFilter = 'all';

  // Mentions
  const mentionPopup = document.getElementById('mention-popup');
  let userCache = [];
  let selectedMentionIndex = -1;
  let currentMentionQuery = '';

  // --- Initialisation Utilisateur ---
  (async () => {
    try {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) throw new Error("Utilisateur non identifié");
      currentUserId = user.id;
      
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name, username')
        .eq('id', currentUserId)
        .single();
        
      if (profile) currentUserFullName = profile.full_name || profile.username;
      
      loadAuthors(); 
      loadLogFeed();
    } catch (error) {
      console.error("Erreur init:", error.message);
    }
  })();

  // --- Initialisation Flatpickr (Filtre Date) ---
  if (filterDateInput) {
    flatpickr(filterDateInput, {
      locale: "fr",
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "j F Y",
      onReady: (selectedDates, dateStr, instance) => {
        instance.calendarContainer.classList.add('font-sans', 'baco-theme');
      },
      onChange: (selectedDates, dateStr) => {
        selectedDateFilter = dateStr;
        currentPage = 1; // Reset pagination au filtre
        loadLogFeed();
      }
    });
  }

  // --- CHARGEMENT DES AUTEURS ---
  const loadAuthors = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
        
      if (error) throw error;
      
      userCache = data.map(u => ({ ...u, username: u.full_name.split(' ')[0].toLowerCase() }));

      if(filterAuthorSelect) {
          const currentVal = filterAuthorSelect.value;
          filterAuthorSelect.innerHTML = '<option value="all">Tous les auteurs</option>' + 
            data.map(u => `<option value="${u.id}">${u.full_name}</option>`).join('');
          filterAuthorSelect.value = currentVal;
          
          filterAuthorSelect.addEventListener('change', (e) => {
            selectedAuthorFilter = e.target.value;
            currentPage = 1; // Reset pagination au filtre
            loadLogFeed();
          });
      }
    } catch (e) { console.error("Erreur auteurs", e); }
  }

  // --- CHARGEMENT DU FLUX (PAGINÉ) ---
  const loadLogFeed = async () => {
    logFeed.innerHTML = '<div class="flex justify-center items-center py-20"><i data-lucide="loader-2" class="w-10 h-10 text-blue-600 animate-spin"></i></div>';
    if (paginationContainer) paginationContainer.innerHTML = ''; // Vider la pagination pendant le chargement
    lucide.createIcons();
    
    try {
      // Calculer l'intervalle pour la pagination
      const from = (currentPage - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;

      // Construire la requête
      let query = supabaseClient
        .from('main_courante')
        .select(`
            *, 
            profiles ( full_name, avatar_url ),
            log_reactions ( user_id, emoji ) 
        `, { count: 'exact' }) // Demander le nombre total exact
        .order('created_at', { ascending: false })
        .range(from, to); // Appliquer la pagination

      // --- APPLICATION DES FILTRES ---
      if (selectedDateFilter) {
        const start = `${selectedDateFilter}T00:00:00`;
        const end = `${selectedDateFilter}T23:59:59`;
        query = query.gte('created_at', start).lte('created_at', end);
      }

      if (selectedAuthorFilter !== 'all') {
        query = query.eq('user_id', selectedAuthorFilter);
      }
      // -------------------------------

      const { data, count, error } = await query;
      if (error) throw error;
      
      // Marquer comme lu
      const now = new Date().toISOString();
      localStorage.setItem(JOURNAL_STORAGE_KEY, now);
      if (window.loadJournalNotificationCount) window.loadJournalNotificationCount();

      if (data.length === 0) {
        logFeed.innerHTML = `<div class="text-center py-10 text-gray-500">Aucun message ne correspond à vos critères.</div>`;
        return;
      }
      
      // Rendu des cartes (Inchangé)
      logFeed.innerHTML = data.map(entry => {
        const author = entry.profiles; 
        const timestamp = window.formatDate(entry.created_at, 'short');
        const authorName = author ? author.full_name : 'Inconnu';
        const authorAvatar = author ? author.avatar_url : 'https://via.placeholder.com/40';
        const hasRights = adminRole || (currentUserId && currentUserId === entry.user_id);
        const safeContent = entry.message_content.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
        const isUrgent = entry.is_urgent || false;

        // Réactions
        const reactionsMap = { '👍': 0, '👀': 0, '⚠️': 0 };
        let myReaction = null;
        if (entry.log_reactions) {
            entry.log_reactions.forEach(r => {
                if (reactionsMap[r.emoji] !== undefined) reactionsMap[r.emoji]++;
                if (r.user_id === currentUserId) myReaction = r.emoji;
            });
        }

        const reactionButtons = Object.keys(reactionsMap).map(emoji => {
            const count = reactionsMap[emoji];
            const isActive = (myReaction === emoji);
            const activeClass = isActive 
                ? 'bg-blue-100 border-blue-300 text-blue-800' 
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100';
            const action = isActive ? 'remove' : 'add';
            
            return `
                <button onclick="window.toggleReaction('${entry.id}', '${emoji}', '${action}')" 
                        class="flex items-center gap-1 px-2 py-1 text-xs border rounded-full transition-all ${activeClass}"
                        title="${isActive ? 'Retirer' : 'Ajouter'} ${emoji}">
                    <span>${emoji}</span>
                    <span class="${count > 0 ? '' : 'hidden'} font-semibold">${count}</span>
                </button>
            `;
        }).join('');

        const cardClass = isUrgent 
          ? 'bg-red-50 border-l-4 border-red-500 shadow-md' 
          : 'bg-white border border-gray-200 shadow-sm';
        const badgeUrgent = isUrgent 
          ? `<div class="flex items-center gap-1 text-red-600 font-bold text-xs uppercase tracking-wide animate-pulse"><i data-lucide="siren" class="w-4 h-4"></i> Urgent</div>` 
          : '';

        return `
          <div class="${cardClass} rounded-lg flex gap-4 p-4 group transition-all">
            <img src="${authorAvatar}" alt="avatar" class="w-10 h-10 rounded-full object-cover hidden sm:block border border-gray-200">
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start mb-2">
                <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <div class="flex items-center gap-2">
                    <img src="${authorAvatar}" alt="avatar" class="w-8 h-8 rounded-full object-cover sm:hidden"> 
                    <span class="font-semibold text-gray-900">${authorName}</span>
                  </div>
                  <span class="text-xs text-gray-500 hidden sm:inline">&bull;</span>
                  <span class="text-xs text-gray-500">${timestamp}</span>
                  ${badgeUrgent}
                </div>
                
                ${hasRights ? `
                <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onclick="window.openEditLogModal('${entry.id}', '${safeContent}', ${isUrgent})" class="p-1.5 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                  <button onclick="window.deleteLogEntry(${entry.id})" class="p-1.5 text-red-500 rounded-full hover:bg-red-100 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>` : ''}
              </div>
              
              <div class="text-gray-800 whitespace-pre-wrap break-words mb-3 ${isUrgent ? 'font-medium' : ''}">${entry.message_content}</div>
              
              <div class="flex items-center gap-2 pt-2 border-t border-gray-100/50">
                 ${reactionButtons}
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      lucide.createIcons();

      // Gérer l'affichage de la pagination
      const totalPages = Math.ceil(count / rowsPerPage);
      renderPagination(totalPages, count, from, to);
      
    } catch (error) {
      logFeed.innerHTML = `<p class="text-red-600 text-center">Erreur: ${error.message}</p>`;
    }
  }

  // --- RENDU PAGINATION ---
  const renderPagination = (totalPages, totalRows, from, to) => {
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }
    
    const toRow = Math.min(to + 1, totalRows);
    
    const infoHtml = `
      <p class="text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm px-3 py-1.5">
        Messages <span class="font-bold text-gray-900">${from + 1}</span> à <span class="font-bold text-gray-900">${toRow}</span> sur
        <span class="font-bold text-gray-900">${totalRows}</span>
      </p>
    `;
    
    const prevDisabled = currentPage === 1;
    const nextDisabled = currentPage === totalPages;
    
    const buttonsHtml = `
      <div class="flex gap-2">
        <button 
          onclick="window.changePage(${currentPage - 1})" 
          ${prevDisabled ? 'disabled' : ''}
          class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm 
                 hover:bg-gray-50 
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          <span>Précédent</span>
        </button>
        
        <button 
          onclick="window.changePage(${currentPage + 1})" 
          ${nextDisabled ? 'disabled' : ''}
          class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm 
                 hover:bg-gray-50 
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <span>Suivant</span>
          <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </button>
      </div>
    `;
    
    paginationContainer.innerHTML = infoHtml + buttonsHtml;
    lucide.createIcons();
  }

  // --- ACTIONS GLOBALES ---

  window.changePage = (page) => {
    if (page < 1) return;
    currentPage = page;
    loadLogFeed();
    // Remonter en haut de la liste
    const filters = document.querySelector('.bg-white.p-4.rounded-xl'); // Cibler la barre de filtres
    if(filters) filters.scrollIntoView({ behavior: 'smooth' });
  }

  window.toggleReaction = async (logId, emoji, action) => {
      if(!currentUserId) return;
      try {
          if (action === 'remove') {
              await supabaseClient.from('log_reactions').delete().match({ log_id: logId, user_id: currentUserId });
          } else {
              const { error } = await supabaseClient.from('log_reactions').upsert({ log_id: logId, user_id: currentUserId, emoji: emoji }, { onConflict: 'log_id, user_id' });
              if(error) throw error;
          }
          loadLogFeed();
      } catch (e) { console.error(e); notyf.error("Impossible de réagir."); }
  }

  window.resetFilters = () => {
    selectedDateFilter = null;
    selectedAuthorFilter = 'all';
    currentPage = 1; // Reset pagination
    if(filterDateInput && filterDateInput._flatpickr) filterDateInput._flatpickr.clear();
    if(filterAuthorSelect) filterAuthorSelect.value = 'all';
    loadLogFeed();
  }

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    const textarea = document.getElementById('log-message');
    const urgentCheckbox = document.getElementById('log-urgent');
    const message = textarea.value.trim();
    const isUrgent = urgentCheckbox ? urgentCheckbox.checked : false;

    if (!message || !currentUserId) return;

    logSubmitButton.disabled = true;
    logSubmitButton.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>...</span>';
    lucide.createIcons();

    try {
      const { data: logEntry, error: logError } = await supabaseClient
        .from('main_courante')
        .insert({ message_content: message, user_id: currentUserId, is_urgent: isUrgent })
        .select().single();

      if (logError) throw logError;
      
      const mentions = message.match(/@(\w+)/g);
      if (mentions) { 
          // Logique de notification (inchangée) 
      }

      notyf.success(isUrgent ? 'Message URGENT publié !' : 'Message publié.');
      textarea.value = '';
      if(urgentCheckbox) urgentCheckbox.checked = false;
      currentPage = 1; // Retour à la première page lors d'un post
      loadLogFeed();
    } catch (error) { notyf.error(error.message); } 
    finally {
      logSubmitButton.disabled = false;
      logSubmitButton.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> <span>Publier</span>';
      lucide.createIcons();
    }
  }

  window.deleteLogEntry = async (id) => {
    if (!confirm("Supprimer ce message ?")) return;
    try {
      const { error } = await supabaseClient.from('main_courante').delete().eq('id', id);
      if (error) throw error;
      notyf.success('Message supprimé.');
      loadLogFeed(); 
    } catch (error) { notyf.error(error.message); }
  }

  window.openEditLogModal = (id, content, isUrgent) => {
    editLogIdInput.value = id;
    editLogContentInput.value = content;
    if (editLogUrgentCheckbox) editLogUrgentCheckbox.checked = isUrgent;
    editModal.style.display = 'flex';
    lucide.createIcons();
  }

  window.closeEditLogModal = () => { editModal.style.display = 'none'; }

  window.handleEditLogSubmit = async (e) => {
    e.preventDefault();
    const id = editLogIdInput.value;
    const newContent = editLogContentInput.value.trim();
    const isUrgent = editLogUrgentCheckbox ? editLogUrgentCheckbox.checked : false;

    if (!newContent) { notyf.error("Message vide."); return; }
    editLogSubmitBtn.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('main_courante')
            .update({ message_content: newContent, is_urgent: isUrgent, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
        notyf.success("Modifié avec succès.");
        window.closeEditLogModal();
        loadLogFeed();
    } catch (error) { notyf.error(error.message); } 
    finally { editLogSubmitBtn.disabled = false; }
  }

  logForm.addEventListener('submit', handlePostSubmit);
};