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
        
        // Droit d'action : Admin OU Propriétaire du message
        const hasRights = adminRole || (currentUserId && currentUserId === entry.user_id);
        
        // Échapper les guillemets pour le onclick
        const safeContent = entry.message_content.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
const isModified = entry.updated_at && Math.abs(new Date(entry.updated_at) - new Date(entry.created_at)) > 1000;
        return `
          <div class="bg-white shadow border border-gray-200 rounded-lg flex gap-4 p-4 group">
            <img src="${authorAvatar}" alt="avatar" class="w-10 h-10 rounded-full object-cover hidden sm:block">
            <div class="flex-1">
              <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-2">
                  <img src="${authorAvatar}" alt="avatar" class="w-8 h-8 rounded-full object-cover sm:hidden"> 
                  <span class="font-semibold text-gray-900">${authorName}</span>
                  <span class="text-xs text-gray-500">${timestamp}</span>
                  ${isModified ? '<span class="text-xs text-gray-400 italic">(modifié)</span>' : ''}
                </div>
                
                ${hasRights ? `
                <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onclick="window.openEditLogModal('${entry.id}', '${safeContent}')" 
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
              <p class="text-gray-700 whitespace-pre-wrap">${entry.message_content}</p>
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
    const message = textarea.value.trim();
    if (!message || !currentUserId) return;

    logSubmitButton.disabled = true;
    logSubmitButton.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>...</span>';
    lucide.createIcons();

    try {
      const { data: logEntry, error: logError } = await supabaseClient
        .from('main_courante')
        .insert({ message_content: message, user_id: currentUserId })
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
      
      notyf.success('Message publié.');
      textarea.value = '';
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
  window.openEditLogModal = (id, content) => {
    editLogIdInput.value = id;
    editLogContentInput.value = content; // Le contenu brut
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
    const id = editLogIdInput.value;
    const newContent = editLogContentInput.value.trim();
    
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