window.pageInit = () => {
    
  const userRole = sessionStorage.getItem('userRole');
  if (userRole !== 'admin') {
    alert("Accès refusé. Vous devez être administrateur pour voir cette page.");
    window.location.replace('accueil.html');
    return;
  }
  
  const notyf = (typeof Notyf !== 'undefined') 
    ? new Notyf({ duration: 3000, position: { x: 'right', y: 'top' }, dismissible: true })
    : { success: (msg) => alert(msg), error: (msg) => alert(msg) };

  const tbody = document.getElementById('audit-table-body');
  const statusMsg = document.getElementById('status-message');
  const paginationContainer = document.getElementById('pagination-container');
  const detailModal = document.getElementById('audit-detail-modal');
  const detailContent = document.getElementById('audit-diff-content');
  
  let currentPage = 1;
  const rowsPerPage = 20;
  
  function getActionBadge(actionType) {
    let classes = '';
    switch (actionType) {
      case 'INSERT': classes = 'bg-green-100 text-green-800'; break;
      case 'UPDATE': classes = 'bg-blue-100 text-blue-800'; break;
      case 'DELETE': classes = 'bg-red-100 text-red-800'; break;
      default: classes = 'bg-gray-100 text-gray-800';
    }
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${classes}">${actionType}</span>`;
  }

  // --- NOUVELLE FONCTION : Afficher les détails ---
  window.showAuditDetails = (logJson) => {
    // logJson est passé comme une string encodée, on la parse
    const log = JSON.parse(decodeURIComponent(logJson));
    const changes = log.changes;
    
    if (!changes) {
      detailContent.innerHTML = '<p class="text-gray-500 italic">Aucun détail enregistré.</p>';
    } else if (log.action_type === 'UPDATE') {
      // Affichage Comparatif (Diff)
      let html = '<div class="space-y-4">';
      for (const [key, value] of Object.entries(changes)) {
        html += `
          <div class="border rounded p-3">
            <p class="text-sm font-bold text-gray-700 uppercase mb-2">${key}</p>
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-red-50 p-2 rounded border border-red-100">
                <span class="text-xs text-red-500 font-semibold block">AVANT</span>
                <span class="text-sm text-gray-800 break-words">${value.old !== null ? value.old : '<em>(vide)</em>'}</span>
              </div>
              <div class="bg-green-50 p-2 rounded border border-green-100">
                <span class="text-xs text-green-500 font-semibold block">APRÈS</span>
                <span class="text-sm text-gray-800 break-words">${value.new !== null ? value.new : '<em>(vide)</em>'}</span>
              </div>
            </div>
          </div>
        `;
      }
      html += '</div>';
      detailContent.innerHTML = html;
    } else {
      // Affichage Simple (Insert/Delete)
      detailContent.innerHTML = `
        <pre class="bg-gray-800 text-gray-200 p-4 rounded text-xs font-mono overflow-auto max-h-96">
${JSON.stringify(changes, null, 2)}
        </pre>`;
    }
    
    detailModal.style.display = 'flex';
    lucide.createIcons();
  }

  window.hideAuditDetailModal = () => {
    detailModal.style.display = 'none';
  }

  async function loadData() {
    tbody.innerHTML = '';
    statusMsg.innerHTML = '<div class="flex justify-center items-center py-20"><i data-lucide="loader-2" class="w-10 h-10 text-blue-600 animate-spin"></i></div>';
    paginationContainer.innerHTML = '';
    lucide.createIcons();
    
    try {
      const from = (currentPage - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;

      const { count, error: countError } = await supabaseClient
        .from('admin_audit_view')
        .select('*', { count: 'exact', head: true });
        
      if (countError) throw countError;
      
      const totalPages = Math.ceil(count / rowsPerPage);

      const { data, error } = await supabaseClient
        .from('admin_audit_view')
        .select('*') // Sélectionne TOUT, y compris 'changes'
        .order('timestamp', { ascending: false })
        .range(from, to); 

      if (error) throw error;
      
      statusMsg.innerHTML = '';

      if (data.length === 0) {
        statusMsg.innerHTML = `<div class="text-center py-10 text-gray-500">Aucune activité.</div>`;
        return;
      }

      tbody.innerHTML = data.map(log => {
        // On prépare l'objet pour le passer à la fonction onClick
        // On utilise encodeURIComponent pour éviter les bugs avec les guillemets dans le JSON
        const logString = encodeURIComponent(JSON.stringify(log));
        
        return `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
            ${window.formatDate(log.timestamp, 'admin')}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
            ${log.full_name || log.email || 'Système / Inconnu'}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            ${getActionBadge(log.action_type)}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
            ${log.table_name}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onclick="window.showAuditDetails('${logString}')" 
                    class="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-2 rounded-full transition-colors"
                    title="Voir les détails">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `}).join('');

      lucide.createIcons();
      renderPagination(totalPages, count, from, to);
      
    } catch (error) {
      statusMsg.innerHTML = `<p class="text-red-600 text-center">Erreur: ${error.message}</p>`;
      notyf.error('Erreur lors du chargement du journal d\'audit.');
    }
  }
  
  window.changePage = (page) => {
    if (page === currentPage) return;
    currentPage = page;
    loadData();
    document.getElementById('result-container').scrollIntoView({ behavior: 'smooth' });
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
        Logs <span class="font-bold text-gray-900">${from + 1}</span> à <span class="font-bold text-gray-900">${toRow}</span> sur
        <span class="font-bold text-gray-900">${totalRows}</span>
      </p>
    `;
    const prevDisabled = currentPage === 1;
    const nextDisabled = currentPage === totalPages;
    const buttonsHtml = `
      <div class="flex gap-2">
        <button onclick="window.changePage(${currentPage - 1})" ${prevDisabled ? 'disabled' : ''} class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"><i data-lucide="arrow-left" class="w-4 h-4"></i><span>Précédent</span></button>
        <button onclick="window.changePage(${currentPage + 1})" ${nextDisabled ? 'disabled' : ''} class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"><span>Suivant</span><i data-lucide="arrow-right" class="w-4 h-4"></i></button>
      </div>
    `;
    container.innerHTML = infoHtml + buttonsHtml;
    lucide.createIcons();
  }

  loadData();
};