// js/pages/journal.js

window.pageInit = () => {

  // --- DÉCLARATIONS DÉPLACÉES À L'INTÉRIEUR ---
  const notyf = (typeof Notyf !== 'undefined')
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  const logForm = document.getElementById('log-form');
  const logMessageInput = document.getElementById('log-message');
  const logSubmitButton = document.getElementById('log-submit-button');
  const logFeed = document.getElementById('log-feed');
  
  let currentUserId = null;
  let currentUserFullName = 'un utilisateur';
  const adminRole = sessionStorage.getItem('userRole') === 'admin';
  const JOURNAL_STORAGE_KEY = 'lastJournalVisit';
  
  const mentionPopup = document.getElementById('mention-popup');
  let userCache = [];
  let selectedMentionIndex = -1;
  let currentMentionQuery = '';
  // ---------------------------------------------------

  // --- FONCTIONS INTERNES (déclarées avec const) ---

  const loadUserCache = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, username, full_name')
        .order('username', { ascending: true });
      if (error) throw error;
      userCache = data;
      console.log(`[Mentions] Cache de ${userCache.length} utilisateurs chargé.`);
    } catch (error) {
      console.error("Erreur chargement cache utilisateurs:", error.message);
    }
  }

  // --- Récupérer l'ID et le nom de l'utilisateur actuel ---
  (async () => {
    try {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) throw new Error("Utilisateur non identifié");
      currentUserId = user.id;
      
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('full_name, username')
        .eq('id', currentUserId)
        .single();
        
      if (profile) {
        currentUserFullName = profile.full_name || profile.username || 'un utilisateur';
      }
    } catch (error) {
      console.error("Erreur init. utilisateur journal:", error.message);
      notyf.error("Impossible d'identifier l'utilisateur pour les mentions.");
    }
  })();

  const markJournalAsRead = async () => {
    const now = new Date().toISOString();
    localStorage.setItem(JOURNAL_STORAGE_KEY, now);
    if (window.loadJournalNotificationCount) {
         window.loadJournalNotificationCount();
    }
  }

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
            <p class="mt-2 text-sm text-gray-500">Aucune entrée n'a été enregistrée pour le moment. Soyez le premier !</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }
      
      logFeed.innerHTML = data.map(entry => {
        const author = entry.profiles; 
        const timestamp = window.formatDate(entry.created_at, 'short'); // Utilise la fonction globale
        const authorName = author ? author.full_name : 'Utilisateur supprimé';
        const authorAvatar = author ? author.avatar_url : 'https://api.dicebear.com/9.x/micah/svg?seed=deleted';
        const canDelete = adminRole || (currentUserId && currentUserId === entry.user_id);
        
        return `
          <div class="bg-white shadow border border-gray-200 rounded-lg flex gap-4 p-4">
            <img src="${authorAvatar}" alt="avatar" class="w-10 h-10 rounded-full object-cover hidden sm:block">
            <div class="flex-1">
              <div class="flex justify-between items-center mb-2">
                <div class="flex items-center gap-2">
                  <img src="${authorAvatar}" alt="avatar" class="w-8 h-8 rounded-full object-cover sm:hidden"> <span class="font-semibold text-gray-900">${authorName}</span>
                  <span class="text-xs text-gray-500">${timestamp}</span>
                </div>
                ${canDelete ? `
                <button onclick="window.deleteLogEntry(${entry.id})" class="admin-only p-1 text-red-500 rounded-full hover:bg-red-100" title="Supprimer">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
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

  const setLoading = (button, isLoading) => {
    if (!button) return;
    if (isLoading) {
      button.disabled = true;
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }
      button.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>Publication...</span>';
      lucide.createIcons();
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
      } else {
        button.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> <span>Publier</span>';
        lucide.createIcons();
      }
    }
  }

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    const textarea = document.getElementById('log-message');
    const message = textarea.value.trim();
    if (!message || !currentUserId) return;

    const postButton = e.target.querySelector('button[type="submit"]');
    setLoading(postButton, true);

    try {
      const { data: logEntry, error: logError } = await supabaseClient
        .from('main_courante')
        .insert({ message_content: message, user_id: currentUserId })
        .select()
        .single();
      if (logError) throw logError;

      const mentionRegex = /@(\w+)/g;
      const mentions = message.match(mentionRegex);
      if (mentions && mentions.length > 0) {
        const usernames = mentions.map(m => m.substring(1));
        const { data: users, error: userError } = await supabaseClient
          .from('profiles')
          .select('id, full_name')
          .in('username', usernames);
        if (users && users.length > 0) {
          const notifications = users.map(user => ({
            user_id_target: user.id,
            user_id_author: currentUserId,
            message: `${currentUserFullName} vous a mentionné dans le journal.`,
            link_url: `journal.html?highlight=${logEntry.id}`
          }));
          supabaseClient.from('notifications').insert(notifications)
            .then(({ error: notifError }) => {
              if (notifError) console.warn("Erreur création notif mention:", notifError);
            });
        }
      }
      notyf.success('Message posté dans le journal.');
      textarea.value = '';
      loadLogFeed();
    } catch (error) {
      notyf.error(error.message);
    } finally {
      setLoading(postButton, false);
    }
  }
  
  // --- ATTACHER LES FONCTIONS À WINDOW ---
  
  window.deleteLogEntry = async (id) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette entrée ?")) return;
    try {
      const { error } = await supabaseClient
        .from('main_courante')
        .delete()
        .eq('id', id);
      if (error) throw error;
      notyf.success('Message supprimé.');
      loadLogFeed(); 
    } catch (error) {
      notyf.error("Erreur: " + error.message);
    }
  }

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
        window.selectMention(); // Appeler la fonction globale
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

  // --- Lancement et Abonnements ---
  
  loadLogFeed();
  logForm.addEventListener('submit', handlePostSubmit);

  loadUserCache().then(() => {
    console.log("[Mentions] Le cache est prêt. Activation des écouteurs.");
    logMessageInput.addEventListener('input', handleInput);
    logMessageInput.addEventListener('keydown', handleKeydown);
  }).catch(err => {
    console.error("[Mentions] Échec du chargement du cache, les @mentions ne fonctionneront pas.", err);
    notyf.error("Erreur: le service de @mention n'a pas pu démarrer.");
  });

  document.addEventListener('click', (e) => {
    if (!logForm.contains(e.target)) {
      hideMentionPopup();
    }
  });

}; // Fin de window.pageInit