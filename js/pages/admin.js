window.pageInit = () => {
  // --- GARDE DE SÉCURITÉ ---
  const userRole = sessionStorage.getItem('userRole');
  if (userRole !== 'admin') {
    alert("Accès refusé. Vous devez être administrateur pour voir cette page.");
    window.location.replace('accueil.html');
    return;
  }
  // --------------------------

  const notyf = (typeof Notyf !== 'undefined')
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  const userListContainer = document.getElementById('user-list-container');

  // --- ÉLÉMENTS DU MODAL DE RESET ---
  const resetModal = document.getElementById('reset-password-modal');
  const resetUserEmail = document.getElementById('reset-user-email');
  const newRandomPassword = document.getElementById('new-random-password');
  const copyPasswordButton = document.getElementById('copy-password-button');
  const confirmResetButton = document.getElementById('confirm-reset-button');
  const resetStatusMessage = document.getElementById('reset-status-message');

  let targetUserId = null;
  let generatedPassword = null;
  // ---------------------------------

  // --- Logique du formulaire de création (CORRIGÉE ET DÉFINIE) ---
  const createUserForm = document.getElementById('create-user-form');
  const createUserButton = document.getElementById('create-user-button');
  const newUserEmail = document.getElementById('new-user-email');
  const newUserPassword = document.getElementById('new-user-password');
  const newUserRole = document.getElementById('new-user-role');

  const infractionModal = document.getElementById('infraction-modal');
  const infractionForm = document.getElementById('infraction-form');
  const infractionUserEmail = document.getElementById('infraction-user-email');
  const infractionUserIdInput = document.getElementById('infraction-user-id');
  const infractionCardType = document.getElementById('infraction-card-type');
  const infractionReason = document.getElementById('infraction-reason');
  const confirmInfractionButton = document.getElementById('confirm-infraction-button');

  // Fonction pour AFFICHER le modal
  window.showInfractionModal = (userId, email) => {
    infractionUserIdInput.value = userId;
    infractionUserEmail.textContent = email;
    infractionForm.reset();
    infractionModal.style.display = 'flex';
    lucide.createIcons();
  }

  // Fonction pour CACHER le modal
  window.hideInfractionModal = () => {
    infractionModal.style.display = 'none';
  }

  // ==========================================================
  // == LOGIQUE DU MODAL "CASIER D'INFRACTIONS"
  // ==========================================================

  const historyModal = document.getElementById('infraction-history-modal');
  const historyModalTitle = document.getElementById('history-modal-title');
  const historyModalList = document.getElementById('infraction-history-list');
  let historyModalCurrentUserId = null; // Pour savoir qui rafraîchir

  /**
   * Ouvre le modal du casier et charge les infractions de l'utilisateur
   */
  window.showInfractionHistory = async (userId, userName) => {
    historyModalCurrentUserId = userId;
    historyModalTitle.textContent = `Casier de : ${userName}`;
    historyModal.style.display = 'flex';
    historyModalList.innerHTML = '<div class="flex justify-center items-center py-10"><i data-lucide="loader-2" class="w-8 h-8 text-blue-600 animate-spin"></i></div>';
    lucide.createIcons();

    try {
      const { data, error } = await supabaseClient
        .from('infractions')
        .select('*, admin:admin_id ( full_name )') // Récupère le nom de l'admin
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data.length === 0) {
        historyModalList.innerHTML = '<p class="text-gray-500 text-sm text-center">Cet utilisateur n\'a aucune infraction.</p>';
        return;
      }

      historyModalList.innerHTML = data.map(renderAdminCardRow).join('');
      lucide.createIcons();

    } catch (error) {
      historyModalList.innerHTML = `<p class="text-red-500 text-sm">Erreur: ${error.message}</p>`;
    }
  }

  /**
   * Ferme le modal du casier
   */
  window.hideInfractionHistoryModal = () => {
    historyModal.style.display = 'none';
    historyModalCurrentUserId = null;
  }

  /**
   * (Copie de profil.html) Génère le HTML pour une ligne d'infraction
   * AVEC le bouton "Pardonner"
   */
  function renderAdminCardRow(card) {
    const icon = card.card_type === 'yellow' ? 'file-warning' : 'file-alert';
    const isCardActive = card.is_active && (card.card_type === 'red' || new Date(card.expires_at) > new Date());

    const color = isCardActive ? (card.card_type === 'yellow' ? 'text-yellow-600' : 'text-red-600') : 'text-gray-400';
    const bgColor = isCardActive ? 'bg-gray-50' : 'bg-gray-100 opacity-75';

    const adminName = card.admin ? card.admin.full_name : 'un admin';
    const date = window.formatDate(card.created_at, 'long'); // Utilisation de la fonction globale

    let status = '';
    if (!isCardActive) {
      status = `<span class="text-xs font-medium text-gray-500 ml-2">(${card.is_active ? 'Expiré' : 'Inactif/Pardonné'})</span>`;
    }

    return `
    <div class="flex items-start gap-3 p-3 ${bgColor} rounded-lg border">
      <i data-lucide="${icon}" class="w-5 h-5 ${color} flex-shrink-0 mt-0.5"></i>
      <div class="flex-grow">
        <p class="font-medium text-gray-800">
          Carton ${card.card_type === 'yellow' ? 'Jaune' : 'Rouge'} ${status}
        </p>
        <p class="text-sm text-gray-600 italic">"${card.reason || 'Aucune raison spécifiée'}"</p>
        <p class="text-xs text-gray-500 mt-1">Donné par ${adminName} le ${date}</p>
      </div>
      <div class="flex-shrink-0">
        ${isCardActive ? `
        <button 
          onclick="admin_pardon_card('${card.id}')"
          class="p-1 text-green-600 rounded-full hover:bg-green-100" 
          title="Pardonner cette infraction">
          <i data-lucide="shield-check" class="w-4 h-4"></i>
        </button>
        ` : ''}
      </div>
    </div>
    `;
  }

  /**
   * Appelle la RPC pour pardonner un carton
   */
  window.admin_pardon_card = async (infractionId) => {
    if (!confirm("Êtes-vous sûr de vouloir pardonner ce carton ? Le statut de ban de l'utilisateur sera recalculé.")) {
      return;
    }

    try {
      const { error } = await supabaseClient.rpc('admin_pardon_infraction', {
        p_infraction_id: infractionId
      });
      if (error) throw error;

      notyf.success("Carton pardonné ! Recalcul du statut...");

      loadUsers();

      const currentUserName = historyModalTitle.textContent.replace('Casier de : ', '');
      if (historyModalCurrentUserId) {
        window.showInfractionHistory(historyModalCurrentUserId, currentUserName);
      }

    } catch (error) {
      notyf.error("Erreur RPC: " + error.message);
    }
  }
  // ==========================================================
  // == FIN DE LA LOGIQUE DU MODAL "CASIER"
  // ==========================================================

  // Gérer le clic sur le bouton de type de carte
  infractionCardType.addEventListener('change', (e) => {
    if (e.target.value === 'red') {
      confirmInfractionButton.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
      confirmInfractionButton.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
      confirmInfractionButton.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
      confirmInfractionButton.classList.remove('bg-red-600', 'hover:bg-red-700');
    }
  });

  // Gérer la SOUMISSION du formulaire
  infractionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const targetUserId = infractionUserIdInput.value;
    const cardType = infractionCardType.value;
    const reason = infractionReason.value;

    if (!targetUserId || !cardType || !reason) {
      notyf.error("Tous les champs sont requis.");
      return;
    }

    confirmInfractionButton.disabled = true;
    confirmInfractionButton.textContent = 'Enregistrement...';

    try {
      const { data, error } = await supabaseClient.rpc('admin_add_infraction', {
        target_user_id: targetUserId,
        p_card_type: cardType,
        p_reason: reason
      });

      if (error) throw error;

      notyf.success(`Carton ${cardType} ajouté. Statut mis à jour.`);
      hideInfractionModal();
      loadUsers();

    } catch (error) {
      notyf.error("Erreur RPC: " + error.message);
    } finally {
      confirmInfractionButton.disabled = false;
      confirmInfractionButton.textContent = 'Donner le Carton';
    }
  });

  createUserForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = newUserEmail.value;
    const password = newUserPassword.value;
    const role = newUserRole.value;
    const defaultName = email.split('@')[0];

    createUserButton.disabled = true;
    createUserButton.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>Création...</span>';
    lucide.createIcons();

    const { data: { session: adminSession }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !adminSession) {
      notyf.error("Erreur critique: Session admin perdue.");
      createUserButton.disabled = false;
      createUserButton.innerHTML = '<i data-lucide="user-plus" class="w-4 h-4"></i> <span>Créer</span>';
      lucide.createIcons();
      return;
    }

    try {
      const { error: authError } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            role: role,
            full_name: defaultName,
            username: defaultName
          }
        }
      });

      if (authError) throw authError;

      const { error: restoreError } = await supabaseClient.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });

      if (restoreError) throw restoreError;

      notyf.success(`Utilisateur ${email} créé et rôle '${role}' attribué !`);
      createUserForm.reset();

      loadUsers();

    } catch (error) {
      console.error("Erreur création utilisateur:", error.message);
      notyf.error(`Erreur: ${error.message}`);

      await supabaseClient.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });

    } finally {
      createUserButton.disabled = false;
      createUserButton.innerHTML = '<i data-lucide="user-plus" class="w-4 h-4"></i> <span>Créer</span>';
      lucide.createIcons();
    }
  });

  // NOUVEAU: Helper pour formater la date
  function formatAdminDate(dateString) {
    // Utilisation de la fonction globale
    return window.formatDate(dateString, 'admin');
  }

  // --- Logique pour la gestion des rôles et du bannissement ---
  window.handleRoleChange = async (userId, newRole) => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user && user.id === userId) {
      notyf.error("Vous ne pouvez pas modifier votre propre rôle.");
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir changer le rôle de cet utilisateur à "${newRole}"?`)) return;

    try {
      // APPEL DE LA RPC SÉCURISÉE
      const { error } = await supabaseClient.rpc('admin_update_user_role', {
          p_user_id: userId,
          p_new_role: newRole
      });

      if (error) throw error;

      notyf.success(`Rôle mis à jour: ${newRole.toUpperCase()}.`);
      loadUsers(); // Recharger la liste
    } catch (error) {
      console.error("Erreur de changement de rôle (RPC):", error);
      notyf.error(`Échec du changement de rôle: ${error.message}`);
    }
  };


  window.handleBanUser = async (userId, shouldBan) => {
    const action = shouldBan ? 'Bannir' : 'Débannir';

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user && user.id === userId) {
      notyf.error("Vous ne pouvez pas vous bannir vous-même.");
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir ${action} cet utilisateur ?`)) return;

    const bannedUntil = shouldBan ? new Date().toISOString() : null;
    // NOTE: 'indefinite' n'est plus utilisé par notre logique SQL,
    // mais nous le gardons pour le débannissement manuel.
    const bannedUntilStatus = shouldBan ? 'banned' : null; 

    try {
      const { error } = await supabaseClient
        .from('profiles')
        .update({
          banned_until: bannedUntil,
          banned_until_status: bannedUntilStatus
        })
        .eq('id', userId);

      if (error) throw error;
      
      // Si on débanni, on "pardonne" aussi tous les cartons
      if (!shouldBan) {
          await supabaseClient
              .from('infractions')
              .update({ is_active: false, reason: reason || '' || ' (Débanni manuellement)' })
              .eq('user_id', userId);
      }

      notyf.success(`Utilisateur ${action === 'Bannir' ? 'banni' : 'débanni'} avec succès.`);
      setTimeout(loadUsers, 150);
    } catch (error) {
      console.error(`Erreur ${action}:`, error);
      notyf.error(`Échec de l'opération ${action}: ${error.message}`);
    }
  };

/**
   * Génère le HTML pour une seule ligne d'utilisateur (VERSION CORRIGÉE)
   */
  function renderUserRow(user, currentAdminId) {
    // 1. DÉCLARATIONS (Doivent être en premier !)
    const avatarSrc = user.avatar_url || 'https://via.placeholder.com/40';
    const currentRole = user.role || 'user'; // <--- currentRole est défini ICI
    const isSelf = (user.user_id === currentAdminId);
    
    const isBanned = user.banned_until && (new Date(user.banned_until) > new Date());
    const lastLogin = formatAdminDate(user.last_sign_in_at);

    // 2. LOGIQUE DU PROCHAIN RÔLE (Utilise currentRole défini juste au-dessus)
    let nextRole = 'user';
    let roleIcon = 'user';
    let roleColor = 'text-gray-600 hover:bg-gray-100';
    let roleTitle = 'Promouvoir Modérateur';

    if (currentRole === 'user') {
        nextRole = 'moderator';
        roleIcon = 'shield'; 
        roleColor = 'text-purple-600 hover:bg-purple-100';
    } else if (currentRole === 'moderator') {
        nextRole = 'admin';
        roleIcon = 'shield-check';
        roleTitle = 'Promouvoir Admin';
        roleColor = 'text-blue-600 hover:bg-blue-100';
    } else if (currentRole === 'admin') {
        nextRole = 'user';
        roleIcon = 'user-minus';
        roleTitle = 'Rétrograder Utilisateur';
        roleColor = 'text-yellow-600 hover:bg-yellow-100';
    }

    // SVG pour le carton de football
    const cardSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-5" viewBox="0 0 14 20" fill="currentColor">
        <path d="M1 3C1 1.89543 1.89543 1 3 1H11C12.1046 1 13 1.89543 13 3V17C13 18.1046 12.1046 19 11 19H3C1.89543 19 1 18.1046 1 17V3Z" />
      </svg>
    `;

    // 3. RENDU HTML
    return `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <div class="flex-shrink-0 h-10 w-10">
              <img class="h-10 w-10 rounded-full object-cover" src="${avatarSrc}" alt="">
            </div>
           <div class="ml-4">
                  <a href="profil.html?id=${user.user_id}" class="text-sm font-medium text-gray-900 hover:text-blue-600" title="Voir le profil">
                    ${user.full_name || user.username || 'N/A'}
                  </a>
                  <div class="text-sm text-gray-500">${user.email}</div>
                </div>
              </div>
            </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
            ${currentRole === 'admin' ? 'bg-blue-100 text-blue-800' : 
              (currentRole === 'moderator' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800')}">
            ${currentRole}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isBanned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
            ${isBanned ? 'Banni' : 'Actif'}
          </span>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center gap-3">
            ${user.active_yellow_cards > 0 ? `
            <span class="flex items-center gap-1.5 text-yellow-500" title="${user.active_yellow_cards} carton(s) jaune(s) actif(s)">
              ${cardSvg}
              <span class="text-sm font-bold">${user.active_yellow_cards}</span>
            </span>
            ` : ''}
            ${user.active_red_cards > 0 ? `
            <span class="flex items-center gap-1.5 text-red-600" title="${user.active_red_cards} carton(s) rouge(s) actif(s)">
              ${cardSvg}
              <span class="text-sm font-bold">${user.active_red_cards}</span>
            </span>
            ` : ''}
            ${user.active_yellow_cards == 0 && user.active_red_cards == 0 ? `
            <span class="text-gray-400 text-xs">Aucune</span>
            ` : ''}
          </div>
        </td>

        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm text-gray-700">${lastLogin}</div>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
          ${isSelf ?
        '<span class="text-gray-400 cursor-not-allowed"> (Vous) </span>' :
        `
            <button 
              onclick="window.showResetPasswordModal('${user.user_id}', '${user.email}')"
              class="p-2 rounded-md text-gray-600 hover:bg-yellow-100 hover:text-yellow-700"
              title="Réinitialiser le mot de passe">
              <i data-lucide="key-round" class="w-4 h-4"></i>
            </button>
            
            <button 
              onclick="window.showInfractionModal('${user.user_id}', '${user.email}')"
              class="p-2 rounded-md ${isBanned ? 'text-red-600' : 'text-yellow-600'} hover:bg-yellow-100"
              title="Ajouter une infraction">
              <i data-lucide="file-warning" class="w-4 h-4"></i>
            </button>

            <button 
              onclick="window.showInfractionHistory('${user.user_id}', '${user.full_name || user.email}')"
              class="p-2 rounded-md text-gray-600 hover:bg-gray-100"
              title="Voir le casier / Historique">
              <i data-lucide="history" class="w-4 h-4"></i>
            </button>
            
            <button 
              onclick="window.handleRoleChange('${user.user_id}', '${nextRole}')"
              class="p-2 rounded-md ${roleColor}"
              title="${roleTitle}">
              <i data-lucide="${roleIcon}" class="w-4 h-4"></i>
            </button>
            
            ${isBanned ? `
            <button 
              onclick="window.handleBanUser('${user.user_id}', ${!isBanned})"
              class="p-2 rounded-md text-green-600 hover:bg-green-100"
              title="Débannir Manuellement">
              <i data-lucide="user-check" class="w-4 h-4"></i>
            </button>
            ` : ''}
            `
      }
        </td>
      </tr>
    `;
  }

  /**
   * Charge et affiche la liste de tous les utilisateurs (FIXED SCOPE)
   */
  async function loadUsers() {
    userListContainer.innerHTML = '<div class="flex justify-center items-center py-10"><i data-lucide="loader-2" class="w-8 h-8 text-blue-600 animate-spin"></i></div>';
    lucide.createIcons();
    try {
      const { data: { user: adminUser }, error: adminError } = await supabaseClient.auth.getUser();
      if (adminError || !adminUser) throw adminError || new Error("Impossible d'identifier l'administrateur.");
      const currentAdminId = adminUser.id;

      // Appelle la fonction SQL
      const { data, error } = await supabaseClient.rpc('get_all_users');
      if (error) throw error;
      if (!data || data.length === 0) { userListContainer.innerHTML = '<p class="text-gray-600">Aucun utilisateur trouvé.</p>'; return; }

      userListContainer.innerHTML = `
        <div class="overflow-x-auto border rounded-lg">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Infractions</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dernière Connexion</th>
                <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${data.map(user => renderUserRow(user, currentAdminId)).join('')}
            </tbody>
          </table>
        </div>
      `;
      lucide.createIcons();
    } catch (error) {
      userListContainer.innerHTML = `<p class="text-red-500">Erreur critique : ${error.message}</p>`;
      notyf.error("Impossible de charger les utilisateurs. " + error.message);
    }
  }

  // --- NOUVELLE LOGIQUE DE RÉINITIALISATION DE MOT DE PASSE (suite) ---

  function generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  window.showResetPasswordModal = (userId, email) => {
    targetUserId = userId;
    generatedPassword = generateRandomPassword();

    resetUserEmail.textContent = email;
    newRandomPassword.value = generatedPassword;
    resetStatusMessage.textContent = '';

    resetModal.style.display = 'flex';
    lucide.createIcons();
    newRandomPassword.select();
  }

  window.hideResetPasswordModal = () => {
    resetModal.style.display = 'none';
  }

  async function handleResetPassword() {
    if (!targetUserId || !generatedPassword) return;

    confirmResetButton.disabled = true;
    confirmResetButton.textContent = 'Réinitialisation en cours...';
    resetStatusMessage.textContent = 'Envoi de la requête...';

    try {
      // Simule un appel RPC pour réinitialiser le mot de passe
      const { error } = await supabaseClient.rpc('admin_reset_user_password', {
        user_id_to_reset: targetUserId,
        new_password: generatedPassword
      });

      if (error) {
        throw error;
      }

      resetStatusMessage.className = 'text-green-600 text-sm';
      resetStatusMessage.innerHTML = '✅ **Succès !** Le mot de passe a été réinitialisé (utilisez le bouton Copier).';
      notyf.success("Mot de passe réinitialisé pour l'utilisateur.");

    } catch (error) {
      resetStatusMessage.className = 'text-red-600 text-sm';
      resetStatusMessage.textContent = `❌ Échec: ${error.message}. Vérifiez la RPC/RLS.`;
      notyf.error("Échec de la réinitialisation.");
    } finally {
      confirmResetButton.disabled = false;
      confirmResetButton.textContent = 'Confirmer la réinitialisation';
    }
  }

  // --- Écouteurs pour le Modal ---
  confirmResetButton.addEventListener('click', handleResetPassword);

  copyPasswordButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(newRandomPassword.value);
      notyf.success('Mot de passe copié !');
    } catch (err) {
      console.error('Impossible de copier le mot de passe:', err);
      notyf.error('Échec de la copie (copiez manuellement).');
    }
  });
  // -------------------------------

  // Lancement initial (Doit être la dernière ligne avant la fermeture du listener)
  loadUsers();

}; // Fin de DOMContentLoaded