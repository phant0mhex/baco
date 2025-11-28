// js/pages/journal.js

window.pageInit = () => {

  const notyf = (typeof Notyf !== 'undefined')
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  const logForm = document.getElementById('log-form');
  const logMessageInput = document.getElementById('log-message');
  const logSubmitButton = document.getElementById('log-submit-button');
  const logFeed = document.getElementById('log-feed');
  
  // Modale d'édition
  const editModal = document.getElementById('edit-log-modal');
  const editLogIdInput = document.getElementById('edit-log-id');
  const editLogContentInput = document.getElementById('edit-log-content');
  const editLogSubmitBtn = document.getElementById('edit-log-submit-btn');

  let currentUserId = null;
  let currentUserFullName = 'un utilisateur';
  const adminRole = sessionStorage.getItem('userRole') === 'admin';
  const JOURNAL_STORAGE_KEY = 'lastJournalVisit';
  
  const mentionPopup = document.getElementById('mention-popup');
  let userCache = [];
  let selectedMentionIndex = -1;
  let currentMentionQuery = '';

  // --- Chargement Cache Utilisateurs (Pour mentions) ---
  const loadUserCache = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, username, full_name')
        .order('username', { ascending: true });
      if (error) throw error;
      userCache = data;
    } catch (error) {
      console.error("Erreur chargement cache utilisateurs:", error.message);
    }
  }

  // --- Identifier l'utilisateur ---
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
        
      if (profile) {
        currentUserFullName = profile.full_name || profile.username || 'un utilisateur';
      }
    } catch (error) {
      console.error("Erreur init. utilisateur journal:", error.message);
    }
  })();

  const markJournalAsRead = async () => {
    const now = new Date().toISOString();
    localStorage.setItem(JOURNAL_STORAGE_KEY, now);
    if (window.loadJournalNotificationCount) {
         window.loadJournalNotificationCount();
    }
  }

  // --- CHARGEMENT DU FLUX (Modifié pour Edit/Delete) ---
  const loadLogFeed = async () => {
    logFeed.innerHTML = '<div class="flex justify-center items-center py-20"><i data-lucide="loader-2" class="w-10 h-10 text-blue-600 animate-spin"></i></div>';
    lucide.createIcons();
    
    try {
      const { data, error } = await supabaseClient
        .from('main_courante')
        .select(`*, profiles ( full_name, avatar_url )`)
        .order('created_at', { ascending: false })
        .limit(50); 
      if (error) throw error;
      
      markJournalAsRead();

      if (data.length === 0) {
        logFeed.innerHTML = `
          <div class="flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-lg border border-dashed border-gray-300">
            <i data-lucide="message-square-x" class="w-16 h-16 text-gray-300"></i>
            <h3 class="mt-4 text-xl font-semibold text-gray-800">Journal vide</h3>
            <p class="mt-2 text-sm text-gray-500">Aucune entrée n'a été enregistrée pour le moment.</p>
          </div>`;
        lucide.createIcons();
        return;
      }
      
      logFeed.innerHTML = data.map(entry => {
        const author = entry.profiles; 
        const timestamp = window.formatDate(entry.created_at, 'short');
        const authorName = author ? author.full_name : 'Utilisateur supprimé';
        const authorAvatar = author ? author.avatar_url : 'https://via.placeholder.com/40';
        
       // Droits (Admin ou Auteur)
       const hasRights = adminRole || (currentUserId && currentUserId === entry.user_id);
        const safeContent = entry.message_content.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
const isUrgent = entry.is_urgent || false; // Récupère le statut (false par défaut)

        // --- LOGIQUE URGENT ---
        // Si urgent : bordure rouge, fond rouge clair, icône sirène animée
        const cardClass = entry.is_urgent 
          ? 'bg-red-50 border-l-4 border-red-500 shadow-md' 
          : 'bg-white border border-gray-200 shadow-sm';
          
        const badgeUrgent = entry.is_urgent 
          ? `<div class="flex items-center gap-1 text-red-600 font-bold text-xs uppercase tracking-wide animate-pulse">
               <i data-lucide="siren" class="w-4 h-4"></i> Urgent
             </div>` 
          : '';
        // ----------------------

        return `
          <div class="${cardClass} rounded-lg flex gap-4 p-4 group transition-all">
            <img src="${authorAvatar}" alt="avatar" class="w-10 h-10 rounded-full object-cover hidden sm:block border border-gray-200">
            <div class="flex-1 min-w-0"> <div class="flex justify-between items-start mb-2">
                <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <div class="flex items-center gap-2">
                    <img src="${authorAvatar}" alt="avatar" class="w-8 h-8 rounded-full object-cover sm:hidden"> 
                    <span class="font-semibold text-gray-900">${authorName}</span>
                  </div>
                  <span class="text-xs text-gray-500 hidden sm:inline">&bull;</span>
                  <span class="text-xs text-gray-500">${timestamp}</span>
                  ${badgeUrgent} </div>
                
                ${hasRights ? `
                <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button onclick="window.openEditLogModal('${entry.id}', '${safeContent}', ${isUrgent})" 
                  class="p-1.5 text-blue-600 rounded-full hover:bg-blue-100 transition-colors" 
                  title="Modifier">
            <i data-lucide="pencil" class="w-4 h-4"></i>
          </button>
                  <button onclick="window.deleteLogEntry(${entry.id})" 
                          class="p-1.5 text-red-500 rounded-full hover:bg-red-100 transition-colors" 
                          title="Supprimer">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
                ` : ''}
              </div>
              
              <div class="text-gray-800 whitespace-pre-wrap break-words ${entry.is_urgent ? 'font-medium' : ''}">${entry.message_content}</div>
            </div>
          </div>
        `;
      }).join('');
      lucide.createIcons();
      
    } catch (error) {
      logFeed.innerHTML = `<p class="text-red-600 text-center">Erreur: ${error.message}</p>`;
      notyf.error('Erreur lors du chargement des messages.');
    }
  }

  // --- GESTION DE L'AJOUT ---
  const handlePostSubmit = async (e) => {
e.preventDefault();
    const textarea = document.getElementById('log-message');
    const urgentCheckbox = document.getElementById('log-urgent'); // Récupérer la checkbox
    
    const message = textarea.value.trim();
    const isUrgent = urgentCheckbox ? urgentCheckbox.checked : false; // Valeur booléenne

    if (!message || !currentUserId) return;

    logSubmitButton.disabled = true;
    logSubmitButton.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>...</span>';
    lucide.createIcons();

    try {
      const { data: logEntry, error: logError } = await supabaseClient
        .from('main_courante')
        .insert({ 
            message_content: message, 
            user_id: currentUserId,
            is_urgent: isUrgent // Ajout du champ
        })
        .select()
        .single();
      if (logError) throw logError;

      // Gestion des mentions (inchangée)
      const mentionRegex = /@(\w+)/g;
      const mentions = message.match(mentionRegex);
      if (mentions && mentions.length > 0) {
        const usernames = mentions.map(m => m.substring(1));
        const { data: users } = await supabaseClient.from('profiles').select('id, full_name').in('username', usernames);
        if (users && users.length > 0) {
          const notifications = users.map(user => ({
            user_id_target: user.id,
            user_id_author: currentUserId,
            message: `${currentUserFullName} vous a mentionné dans le journal.`,
            link_url: `journal.html?highlight=${logEntry.id}`
          }));
          supabaseClient.from('notifications').insert(notifications);
        }
      }
      
      notyf.success(isUrgent ? 'Message URGENT publié !' : 'Message publié.');
      textarea.value = '';
      if (urgentCheckbox) urgentCheckbox.checked = false; // Décocher la case
      loadLogFeed();
    } catch (error) {
      notyf.error(error.message);
    } finally {
      logSubmitButton.disabled = false;
      logSubmitButton.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> <span>Publier</span>';
      lucide.createIcons();
    }
  }
  
  // --- FONCTIONS GLOBALES (Edit/Delete) ---
  
  window.deleteLogEntry = async (id) => {
    if (!confirm("Voulez-vous vraiment supprimer ce message ?")) return;
    try {
      const { error } = await supabaseClient
        .from('main_courante')
        .delete()
        .eq('id', id);
      if (error) throw error;
      notyf.success('Message supprimé.');
      loadLogFeed(); 
    } catch (error) {
      notyf.error("Impossible de supprimer : " + error.message);
    }
  }

  // Ouvrir la modale
 window.openEditLogModal = (id, content, isUrgent) => {
  const editLogIdInput = document.getElementById('edit-log-id');
  const editLogContentInput = document.getElementById('edit-log-content');
  const editLogUrgentCheckbox = document.getElementById('edit-log-urgent'); // Référence à la nouvelle checkbox
  const editModal = document.getElementById('edit-log-modal');

  editLogIdInput.value = id;
  editLogContentInput.value = content;
  
  // AJOUT : Mettre à jour l'état de la case à cocher
  if (editLogUrgentCheckbox) {
    editLogUrgentCheckbox.checked = isUrgent;
  }

  editModal.style.display = 'flex';
  lucide.createIcons();
}

  // Fermer la modale
  window.closeEditLogModal = () => {
    editModal.style.display = 'none';
    editLogIdInput.value = '';
    editLogContentInput.value = '';
  }

  // Soumettre la modification
 window.handleEditLogSubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-log-id').value;
  const newContent = document.getElementById('edit-log-content').value.trim();
  const isUrgent = document.getElementById('edit-log-urgent').checked; // AJOUT
  const editLogSubmitBtn = document.getElementById('edit-log-submit-btn');

  if (!newContent) {
      notyf.error("Le message ne peut pas être vide.");
      return;
  }

    editLogSubmitBtn.disabled = true;
    editLogSubmitBtn.textContent = 'Enregistrement...';

    try {
        const { error } = await supabaseClient
            .from('main_courante')
            .update({ 
                message_content: newContent,
                is_urgent: isUrgent,
                updated_at: new Date().toISOString() // Mettre à jour le timestamp
            })
            .eq('id', id);

        if (error) throw error;

        notyf.success("Message modifié avec succès.");
        window.closeEditLogModal();
        loadLogFeed();

    } catch (error) {
        console.error(error);
        notyf.error("Erreur lors de la modification : " + error.message);
    } finally {
        editLogSubmitBtn.disabled = false;
        editLogSubmitBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>Enregistrer</span>';
        lucide.createIcons();
    }
  }

  // --- LOGIQUE DES MENTIONS (inchangée) ---
  const showMentionPopup = (query) => {
    currentMentionQuery = query.toLowerCase();
    const filteredUsers = userCache.filter(user => {
      const username = user.username || '';
      const fullname = user.full_name || '';
      return username.toLowerCase().includes(currentMentionQuery) ||
             fullname.toLowerCase().includes(currentMentionQuery);
    });
    if (filteredUsers.length === 0) {
      hideMentionPopup();
      return;
    }
    mentionPopup.innerHTML = filteredUsers.map((user, index) => `
      <div class="mention-item" data-index="${index}" data-username="${user.username}" onmousedown="window.selectMention(event)">
        <span class="username">@${user.username}</span>
        <span class="fullname">(${user.full_name || '...'})</span>
      </div>
    `).join('');
    mentionPopup.style.display = 'block';
    selectedMentionIndex = 0;
    updateMentionSelection();
  }

  const updateMentionSelection = () => {
    mentionPopup.querySelectorAll('.mention-item').forEach((item, index) => {
      if (index === selectedMentionIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }
  
  const hideMentionPopup = () => {
    mentionPopup.style.display = 'none';
    selectedMentionIndex = -1;
  }

  const handleInput = (e) => {
    const text = logMessageInput.value;
    const cursorPos = logMessageInput.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex === -1) {
      hideMentionPopup();
      return;
    }
    const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
    if (potentialQuery.includes(' ')) {
      hideMentionPopup();
      return;
    }
    showMentionPopup(potentialQuery);
  }

  const handleKeydown = (e) => {
    if (mentionPopup.style.display !== 'block') return;
    const items = mentionPopup.querySelectorAll('.mention-item');
    if (items.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedMentionIndex = (selectedMentionIndex + 1) % items.length;
        updateMentionSelection();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedMentionIndex = (selectedMentionIndex - 1 + items.length) % items.length;
        updateMentionSelection();
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        window.selectMention();
        break;
      case 'Escape':
        e.preventDefault();
        hideMentionPopup();
        break;
    }
  }

  window.selectMention = (e) => {
    let selectedItem;
    if (e) {
      selectedItem = e.currentTarget;
    } else {
      selectedItem = mentionPopup.querySelector('.mention-item.selected');
    }
    if (!selectedItem) return;
    const username = selectedItem.dataset.username;
    const text = logMessageInput.value;
    const cursorPos = logMessageInput.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const textBefore = text.substring(0, lastAtIndex);
    const textAfter = text.substring(cursorPos);
    logMessageInput.value = textBefore + `@${username} ` + textAfter;
    const newCursorPos = (textBefore + `@${username} `).length;
    logMessageInput.focus();
    logMessageInput.setSelectionRange(newCursorPos, newCursorPos);
    hideMentionPopup();
  }

  // --- Lancement ---
  loadLogFeed();
  logForm.addEventListener('submit', handlePostSubmit);

  loadUserCache().then(() => {
    logMessageInput.addEventListener('input', handleInput);
    logMessageInput.addEventListener('keydown', handleKeydown);
  });

  document.addEventListener('click', (e) => {
    if (!logForm.contains(e.target)) {
      hideMentionPopup();
    }
  });

}; // Fin de window.pageInit