window.pageInit = () => {

  // --- DÉCLARATIONS DÉPLACÉES À L'INTÉRIEUR ---
  const notyf = (typeof Notyf !== 'undefined')
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  const feed = document.getElementById('changelog-feed');
  const statusMsg = document.getElementById('status-message');
  const paginationContainer = document.getElementById('pagination-container');
  const modal = document.getElementById('changelog-modal');
  const modalForm = document.getElementById('changelog-form');
  const modalTitle = document.getElementById('modal-title');
  const modalTitleInput = document.getElementById('modal-title-input');
  const modalTypeSelect = document.getElementById('modal-type-select');
  const submitButton = document.getElementById('modal-submit-button');

  let currentUserId = null;
  let currentPage = 1;
  const rowsPerPage = 5;
  let easyMDE; // Déclarer ici pour qu'elle soit accessible partout

  try {
    easyMDE = new EasyMDE({
      element: document.getElementById('modal-content'),
      spellChecker: false,
      status: false,
      toolbar: ["bold", "italic", "|", "unordered-list", "ordered-list", "|", "link", "|", "preview", "guide"],
      minHeight: "150px"
    });
  } catch(e) {
    console.error("Erreur EasyMDE", e);
  }
  
  // --- FONCTIONS INTERNES (const) ---
  
  function formatLogDate(dateString) {
    // Utilisation de la fonction globale
    return window.formatDate(dateString, 'long');
  }

  function getTypeBadge(type) {
    switch (type) {
      case 'Nouveau':
        return 'bg-green-100 text-green-800';
      case 'Corrigé':
        return 'bg-red-100 text-red-800';
      case 'Amélioré':
      default:
        return 'bg-blue-100 text-blue-800';
    }
  }

  async function loadChangelog() {
    feed.innerHTML = '';
    statusMsg.innerHTML = '<div class="flex justify-center items-center py-20"><i data-lucide="loader-2" class="w-10 h-10 text-blue-600 animate-spin"></i></div>';
    paginationContainer.innerHTML = '';
    lucide.createIcons();

    try {
      const { count, error: countError } = await supabaseClient
        .from('changelog')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const totalPages = Math.ceil(count / rowsPerPage);
      const from = (currentPage - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;

      const { data, error } = await supabaseClient
        .from('changelog')
        .select(`*, profiles ( full_name, avatar_url )`)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (!currentUserId) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) currentUserId = user.id;
      }

      statusMsg.innerHTML = '';

      if (data.length === 0) {
        statusMsg.innerHTML = `
          <div class="flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-lg border border-dashed border-gray-300">
            <i data-lucide="list-checks" class="w-16 h-16 text-gray-300"></i>
            <h3 class="mt-4 text-xl font-semibold text-gray-800">Aucune entrée</h3>
            <p class="mt-2 text-sm text-gray-500">Le journal des modifications est vide pour le moment.</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      feed.innerHTML = data.map(entry => {
        const author = entry.profiles;
        const timestamp = formatLogDate(entry.created_at);
        const badgeClasses = getTypeBadge(entry.type);
        const authorName = author ? author.full_name : 'Utilisateur';
        const authorAvatar = author ? author.avatar_url : 'https://api.dicebear.com/9.x/micah/svg?seed=deleted';
        const contentHtml = window.marked.parse(entry.content || '');

        return `
          <div class="bg-white shadow border border-gray-200 rounded-lg overflow-hidden">
            <div class="p-5 border-b bg-white">
              <div class="flex justify-between items-center mb-3">
                <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full ${badgeClasses}">
                  ${entry.type}
                </span>
                <span class="text-sm text-gray-500">${timestamp}</span>
              </div>
              <h2 class="text-2xl font-bold text-gray-800">${entry.title}</h2>
              <div class="flex items-center gap-2 mt-3">
                <img src="${authorAvatar}" alt="avatar" class="w-6 h-6 rounded-full object-cover">
                <span class="text-sm font-medium text-gray-600">Par ${authorName}</span>
              </div>
            </div>
            <div class="p-5 prose prose-sm max-w-none">
              ${contentHtml}
            </div>
            <div class="admin-only flex justify-end p-2 bg-gray-50 border-t">
              <button onclick="window.deleteEntry(${entry.id}, '${entry.title}')" class="p-2 text-red-500 rounded-full hover:bg-red-100" title="Supprimer">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      lucide.createIcons();
      if (window.hideAdminElements) window.hideAdminElements();

      renderPagination(totalPages, count, from, to);

    } catch (error) {
      statusMsg.innerHTML = `<p class="text-red-600 text-center">Erreur: ${error.message}</p>`;
      notyf.error('Erreur lors du chargement du changelog.');
    }
  }

  function renderPagination(totalPages, totalRows, from, to) {
    const container = document.getElementById('pagination-container');
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    const toRow = Math.min(to + 1, totalRows);
    const infoHtml = `
      <p class="text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm px-3 py-1.5">
        Entrées <span class="font-bold text-gray-900">${from + 1}</span> à <span class="font-bold text-gray-900">${toRow}</span> sur
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
                 disabled:opacity-50 disabled:cursor-not-allowed">
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          <span>Précédent</span>
        </button>
        <button 
          onclick="window.changePage(${currentPage + 1})" 
          ${nextDisabled ? 'disabled' : ''}
          class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm 
                 hover:bg-gray-50 
                 disabled:opacity-50 disabled:cursor-not-allowed">
          <span>Suivant</span>
          <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </button>
      </div>
    `;
    container.innerHTML = infoHtml + buttonsHtml;
    lucide.createIcons();
  }

  // --- ATTACHER LES FONCTIONS À WINDOW ---
  
  window.handleFormSubmit = async (event) => {
    event.preventDefault();
    if (!currentUserId) {
      notyf.error("Erreur: utilisateur non identifié.");
      return;
    }
    const entryData = {
      title: modalTitleInput.value,
      type: modalTypeSelect.value,
      content: easyMDE.value(),
      user_id: currentUserId
    };
    submitButton.disabled = true;
    submitButton.textContent = 'Enregistrement...';
    try {
      const { error } = await supabaseClient.from('changelog').insert(entryData);
      if (error) throw error;
      notyf.success('Entrée ajoutée !');
      window.hideChangelogModal(); // Utiliser window.
      currentPage = 1;
      loadChangelog();
      if (window.loadLatestChangelog) {
        window.loadLatestChangelog();
      }
    } catch (error) {
      notyf.error("Erreur: " + error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Enregistrer';
    }
  }

  window.deleteEntry = async (id, title) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'entrée : "${title}" ?`)) return;
    try {
      const { error } = await supabaseClient.from('changelog').delete().eq('id', id);
      if (error) throw error;
      notyf.success('Entrée supprimée.');
      loadChangelog();
      if (window.loadLatestChangelog) {
        window.loadLatestChangelog();
      }
    } catch (error) {
      notyf.error("Erreur: " + error.message);
    }
  }

  window.showChangelogModal = () => {
    modalForm.reset();
    if (easyMDE) easyMDE.value('');
    modal.style.display = 'flex';
    lucide.createIcons();
  }

  window.hideChangelogModal = () => {
    modal.style.display = 'none';
  }

  window.changePage = (page) => {
    if (page === currentPage) return;
    currentPage = page;
    loadChangelog();
    document.getElementById('changelog-feed').scrollIntoView({ behavior: 'smooth' });
  }
  
  // --- Lancement ---
  loadChangelog();
  
}; // Fin de window.pageInit