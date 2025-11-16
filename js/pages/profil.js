// js/pages/profil.js

window.pageInit = () => {
    
  const notyf = (typeof Notyf !== 'undefined') 
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  // --- RÉFÉRENCES DOM ---
  const pageTitle = document.getElementById('page-title');
  const profileForm = document.getElementById('profile-form');
  const saveButton = document.getElementById('save-button');
  const emailInput = document.getElementById('email');
  const roleInput = document.getElementById('role');
  const usernameInput = document.getElementById('username');
  const fullNameInput = document.getElementById('full_name');
  const avatarPreview = document.getElementById('avatar-preview');
  const avatarFileInput = document.getElementById('avatar-file');
  const avatarStatus = document.getElementById('avatar-upload-status');
  const avatarUploadLabel = document.getElementById('avatar-upload-label');
  const passwordSection = document.getElementById('password-section');
  const passwordForm = document.getElementById('password-form');
  const passwordSaveButton = document.getElementById('password-save-button');
  const adminBadge = document.getElementById('admin-badge');
  
  // Références pour le "Ban Meter"
  const banMeterFill = document.getElementById('ban-meter-fill');
  const banMeterStatus = document.getElementById('ban-meter-status');
  const infractionsList = document.getElementById('infractions-list');

  let currentUserId = null; // L'ID de la personne qui REGARDE
  let targetUserId = null;  // L'ID de la personne qu'on REGARDE
  let isMyProfile = false;  // Est-ce qu'on regarde notre propre profil ?
  let uploading = false;

  
  /**
   * Charge le profil (le sien ou celui d'un autre)
   */
  async function getProfile() {
    try {
      // 1. Identifier l'utilisateur actuel
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) throw new Error('Utilisateur non connecté');
      currentUserId = user.id;

      // 2. Déterminer quel profil charger
      const urlParams = new URLSearchParams(window.location.search);
      const requestedUserId = urlParams.get('id');

      if (requestedUserId) {
        targetUserId = requestedUserId;
        isMyProfile = (currentUserId === requestedUserId);
      } else {
        targetUserId = currentUserId;
        isMyProfile = true;
      }

      // 3. Récupérer les données du profil CIBLE
      const { data, error, status } = await supabaseClient
        .from('profiles')
        .select(`username, full_name, avatar_url, role, email`) // On a besoin de l'email depuis profiles maintenant
        .eq('id', targetUserId)
        .single();
        
      if (error && status !== 406) throw error;
      
      // 4. Mettre à jour l'UI
      if (data) {
        usernameInput.value = data.username || '';
        fullNameInput.value = data.full_name || '';
        emailInput.value = data.email || ''; // Utiliser l'email du profil
        roleInput.value = (data.role || 'user').charAt(0).toUpperCase() + (data.role || 'user').slice(1);
        if (data.avatar_url) avatarPreview.src = data.avatar_url + `?t=${new Date().getTime()}`;

        // Afficher le badge admin si l'utilisateur VU est admin
        if (data.role === 'admin' && adminBadge) {
          adminBadge.innerHTML = `
            <span title="Administrateur Certifié" class="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-full shadow-md">
                <i data-lucide="shield-check" class="w-4 h-4"></i> Admin
            </span>`;
          lucide.createIcons();
        }
      }
      
      // 5. Charger les infractions pour l'utilisateur CIBLE
      loadInfractions(targetUserId);
      
      // 6. Configurer la page
      setupPageMode();

    } catch (error) {
      console.error("Erreur chargement profil:", error.message);
      notyf.error("Impossible de charger le profil : " + error.message);
      pageTitle.textContent = "Profil introuvable";
    }
  }

  /**
   * Configure l'UI si on regarde son profil ou celui d'un autre
   */
  function setupPageMode() {
    if (isMyProfile) {
      pageTitle.innerHTML = 'Mon Profil <span id="admin-badge" class="ml-2"></span>';
      
      // Activer les formulaires
      profileForm.addEventListener('submit', handleProfileUpdate);
      passwordForm.addEventListener('submit', updatePassword);
      avatarFileInput.addEventListener('change', handleAvatarUpload);
      
    } else {
      pageTitle.innerHTML = `Profil de ${fullNameInput.value || 'Utilisateur'}`;
      
      // Cacher les sections sensibles
      passwordSection.style.display = 'none';
      saveButton.style.display = 'none';
      avatarUploadLabel.style.cursor = 'default';
      avatarFileInput.disabled = true;
      
      // Cacher l'overlay de l'avatar
      const overlay = avatarUploadLabel.querySelector('.avatar-overlay');
      if (overlay) overlay.style.display = 'none';
      
      // Désactiver les champs
      usernameInput.disabled = true;
      fullNameInput.disabled = true;
    }
    // (L'email et le rôle sont toujours désactivés, c'est correct)
  }

  /**
   * Gère la MISE À JOUR du profil (uniquement pour soi-même)
   */
  async function handleProfileUpdate(e) {
    e.preventDefault();
    if (!isMyProfile) return; // Sécurité
    
    try {
      saveButton.disabled = true;
      saveButton.textContent = 'Enregistrement...';
      const updates = { 
        id: currentUserId, 
        username: usernameInput.value, 
        full_name: fullNameInput.value, 
        updated_at: new Date() 
      };
      const { error } = await supabaseClient.from('profiles').upsert(updates);
      if (error) throw error;
      notyf.success('Profil mis à jour !');
    } catch (error) {
      notyf.error('Erreur mise à jour profil : ' + error.message);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Enregistrer les modifications';
    }
  }
  
  /**
   * Gère l'UPLOAD d'avatar (uniquement pour soi-même)
   */
  async function handleAvatarUpload(event) {
    if (!isMyProfile || uploading) return;
    const file = event.target.files[0];
    if (!file) return;
    uploading = true;
    avatarStatus.textContent = 'Téléchargement...';
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${currentUserId}/${fileName}`;
      const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
      if (!urlData) throw new Error("Impossible d'obtenir l'URL publique.");
      const publicURL = urlData.publicUrl;
      const { error: updateError } = await supabaseClient.from('profiles').update({ avatar_url: publicURL, updated_at: new Date() }).eq('id', currentUserId);
      if (updateError) throw updateError;
      avatarPreview.src = publicURL + `?t=${new Date().getTime()}`;
      avatarStatus.textContent = '';
      notyf.success('Avatar mis à jour !');
    } catch (error) {
      console.error("Erreur upload avatar:", error.message);
      avatarStatus.textContent = '';
      notyf.error("Échec de l'upload.");
    } finally {
      uploading = false;
    }
  }

  /**
   * Gère le CHANGEMENT DE MDP (uniquement pour soi-même)
   */
  async function updatePassword(event) {
    event.preventDefault();
    if (!isMyProfile) return;
    
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword.length < 6) {
      notyf.error('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      notyf.error('Les mots de passe ne correspondent pas.');
      return;
    }

    passwordSaveButton.disabled = true;
    passwordSaveButton.textContent = 'Enregistrement...';

    try {
      const { error } = await supabaseClient.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      notyf.success('Mot de passe mis à jour avec succès !');
      passwordForm.reset(); 
    } catch (error) {
      console.error("Erreur mise à jour MDP:", error.message);
      notyf.error('Erreur: ' + error.message);
    } finally {
      passwordSaveButton.disabled = false;
      passwordSaveButton.textContent = 'Changer le mot de passe';
    }
  }
  
  /**
   * Charge les infractions de l'utilisateur CIBLE
   */
  async function loadInfractions(userId) {
    if (!userId) return;

    try {
      // Ne charge que les infractions actives
      const { data, error } = await supabaseClient
        .from('infractions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .or('card_type.eq.red, and(card_type.eq.yellow,expires_at.gt.now())')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data.length === 0) {
        banMeterFill.style.width = '100%';
        banMeterFill.className = 'h-5 rounded-full text-right text-xs text-white font-bold pr-2 transition-all duration-1000 ease-out bg-gradient-to-r from-green-400 to-green-600';
        banMeterStatus.textContent = "Dossier impeccable !";
        infractionsList.innerHTML = '<p class="text-gray-500 text-sm">Aucune infraction active enregistrée.</p>';
        return;
      }

      let yellowPoints = 0;
      let redPoints = 0;
      const maxPoints = 6; 
      infractionsList.innerHTML = ''; 

      data.forEach(card => {
        infractionsList.innerHTML += renderCardRow(card); // Utilise la version simplifiée
        if (card.card_type === 'yellow') yellowPoints += 1;
        if (card.card_type === 'red') redPoints += 1;
      });
      
      lucide.createIcons();

      // (Logique du Ban Meter inchangée)
      const totalPoints = (redPoints * maxPoints) + yellowPoints;
      let percentage = 100 - ((totalPoints / maxPoints) * 100);
      if (percentage < 0) percentage = 0;
      setTimeout(() => { banMeterFill.style.width = `${percentage}%`; }, 100);
      
      // (Logique des couleurs inchangée)
      if (totalPoints === 0) {
           banMeterFill.className = 'h-5 rounded-full text-right text-xs text-white font-bold pr-2 transition-all duration-1000 ease-out bg-gradient-to-r from-green-400 to-green-600';
           banMeterStatus.textContent = "Niveau de confiance excellent (compteur à zéro).";
      } else if (totalPoints < 3) { 
          banMeterFill.className = 'h-5 rounded-full text-right text-xs text-black font-bold pr-2 transition-all duration-1000 ease-out bg-gradient-to-r from-yellow-300 to-yellow-400';
          banMeterStatus.textContent = "Niveau de confiance moyen. Attention.";
      } else if (totalPoints < 6) { 
           banMeterFill.className = 'h-5 rounded-full text-right text-xs text-white font-bold pr-2 transition-all duration-1000 ease-out bg-gradient-to-r from-orange-500 to-orange-600';
           banMeterStatus.textContent = "Niveau de confiance bas. Ban temporaire actif.";
      } else { 
          banMeterFill.className = 'h-5 rounded-full text-right text-xs text-white font-bold pr-2 transition-all duration-1000 ease-out bg-gradient-to-r from-red-600 to-red-700';
          banMeterStatus.textContent = "Niveau de confiance critique. Compte banni.";
      }
      banMeterFill.textContent = `${Math.round(percentage)}%`;

    } catch (error) {
      infractionsList.innerHTML = `<p class="text-red-500 text-sm">Erreur: ${error.message}</p>`;
    }
  }
  
  /**
   * Affiche une ligne d'infraction (version simple, sans nom d'admin)
   */
  function renderCardRow(card) {
    const icon = card.card_type === 'yellow' ? 'file-warning' : 'file-alert';
    const color = card.card_type === 'yellow' ? 'text-yellow-600' : 'text-red-600';
    const date = window.formatDate(card.created_at, 'long'); // Utilise la fonction globale

    return `
    <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
      <i data-lucide="${icon}" class="w-5 h-5 ${color} flex-shrink-0 mt-0.5"></i>
      <div class="flex-grow">
        <p class="font-medium text-gray-800">
          Carton ${card.card_type === 'yellow' ? 'Jaune' : 'Rouge'}
        </p>
        <p class="text-sm text-gray-600 italic">"${card.reason || 'Aucune raison spécifiée'}"</p>
        <p class="text-xs text-gray-500 mt-1">Donné le ${date}</p>
      </div>
    </div>
    `;
  }

  // --- Lancement ---
  getProfile();
  
}; // Fin de window.pageInit