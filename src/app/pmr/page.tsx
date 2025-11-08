'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Edit, Trash2, X } from 'lucide-react';
import type { PmrData } from '@/types';

export default function PmrPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [data, setData] = useState<PmrData[]>([]);
  const [filteredData, setFilteredData] = useState<PmrData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [filterEtat, setFilterEtat] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const [formData, setFormData] = useState({
    rampe_id: '',
    gare: '',
    quai: '',
    zone: '',
    type_assistance: 'N/A',
    etat_rampe: 'En attente',
    date_panne: '',
    commentaire: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      loadData();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    applyFilters();
  }, [data, searchTerm, filterZone, filterEtat, filterType]);

  const loadData = async () => {
    try {
      const { data: pmrData, error } = await supabase
        .from('pmr_data')
        .select('*')
        .order('gare', { ascending: true });

      if (error) throw error;
      setData(pmrData || []);
    } catch (error) {
      console.error('Erreur chargement:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...data];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.gare?.toLowerCase().includes(term) ||
          item.quai?.toLowerCase().includes(term) ||
          item.rampe_id?.toLowerCase().includes(term)
      );
    }

    if (filterZone !== 'all') {
      filtered = filtered.filter((item) => item.zone === filterZone);
    }

    if (filterEtat !== 'all') {
      filtered = filtered.filter((item) => item.etat_rampe === filterEtat);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter((item) => item.type_assistance === filterType);
    }

    setFilteredData(filtered);
  };

  const openModal = (item?: PmrData) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        rampe_id: item.rampe_id || '',
        gare: item.gare || '',
        quai: item.quai || '',
        zone: item.zone || '',
        type_assistance: item.type_assistance || 'N/A',
        etat_rampe: item.etat_rampe || 'En attente',
        date_panne: item.date_panne || '',
        commentaire: item.commentaire || '',
      });
    } else {
      setEditingId(null);
      setFormData({
        rampe_id: '',
        gare: '',
        quai: '',
        zone: '',
        type_assistance: 'N/A',
        etat_rampe: 'En attente',
        date_panne: '',
        commentaire: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await supabase
          .from('pmr_data')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        alert('Modifié avec succès');
      } else {
        const { error } = await supabase.from('pmr_data').insert([formData]);

        if (error) throw error;
        alert('Ajouté avec succès');
      }

      closeModal();
      loadData();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette entrée ?')) return;

    try {
      const { error } = await supabase.from('pmr_data').delete().eq('id', id);

      if (error) throw error;
      alert('Supprimé avec succès');
      loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const getEtatColor = (etat?: string) => {
    if (etat === 'OK') return 'bg-green-100 text-green-800';
    if (etat === 'HS') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getTypeColor = (type?: string) => {
    if (type === 'Taxi') return 'bg-yellow-100 text-yellow-800';
    if (type === 'Full') return 'bg-blue-100 text-blue-800';
    if (type === 'Light') return 'bg-green-100 text-green-800';
    if (type === '3h') return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft size={20} />
            Retour au tableau de bord
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rampes PMR / Restrictions</h1>
              <p className="text-sm text-gray-500 mt-1">
                Gérez l'état des rampes et les restrictions de gare
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              Ajouter une entrée
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filtres</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechercher
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Gare, Quai, ID..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Zone</label>
              <select
                value={filterZone}
                onChange={(e) => setFilterZone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Toutes les zones</option>
                <option value="FTY">FTY</option>
                <option value="FMS">FMS</option>
                <option value="FCR">FCR</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">État</label>
              <select
                value={filterEtat}
                onChange={(e) => setFilterEtat(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les états</option>
                <option value="OK">OK</option>
                <option value="HS">HS</option>
                <option value="En attente">En attente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les types</option>
                <option value="3h">3h</option>
                <option value="Full">Full</option>
                <option value="Light">Light</option>
                <option value="Taxi">Taxi</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.length === 0 ? (
            <div className="col-span-full bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500 text-lg">Aucune donnée PMR trouvée</p>
              <p className="text-gray-400 text-sm mt-2">
                Modifiez vos filtres ou ajoutez une nouvelle entrée
              </p>
            </div>
          ) : (
            filteredData.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{item.gare}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(item)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {item.quai && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quai:</span>
                      <span className="font-medium">{item.quai}</span>
                    </div>
                  )}
                  {item.zone && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Zone:</span>
                      <span className="font-medium">{item.zone}</span>
                    </div>
                  )}
                  {item.rampe_id && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-medium">{item.rampe_id}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-gray-600">État:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEtatColor(item.etat_rampe)}`}>
                      {item.etat_rampe}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Type:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(item.type_assistance)}`}>
                      {item.type_assistance}
                    </span>
                  </div>
                  {item.commentaire && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-gray-600 text-xs">{item.commentaire}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingId ? 'Modifier l\'entrée' : 'Ajouter une entrée'}
              </h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gare (Code) *
                  </label>
                  <input
                    type="text"
                    value={formData.gare}
                    onChange={(e) => setFormData({ ...formData, gare: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quai</label>
                  <input
                    type="text"
                    value={formData.quai}
                    onChange={(e) => setFormData({ ...formData, quai: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Zone</label>
                  <input
                    type="text"
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    placeholder="FTY, FMS, FCR..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ID Rampe</label>
                  <input
                    type="text"
                    value={formData.rampe_id}
                    onChange={(e) => setFormData({ ...formData, rampe_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type Assistance
                  </label>
                  <select
                    value={formData.type_assistance}
                    onChange={(e) =>
                      setFormData({ ...formData, type_assistance: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="N/A">N/A</option>
                    <option value="3h">3h</option>
                    <option value="Full">Full</option>
                    <option value="Light">Light</option>
                    <option value="Taxi">Taxi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    État Rampe
                  </label>
                  <select
                    value={formData.etat_rampe}
                    onChange={(e) => setFormData({ ...formData, etat_rampe: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="OK">OK</option>
                    <option value="HS">HS</option>
                    <option value="En attente">En attente</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de panne
                  </label>
                  <input
                    type="date"
                    value={formData.date_panne}
                    onChange={(e) => setFormData({ ...formData, date_panne: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Commentaire
                  </label>
                  <textarea
                    value={formData.commentaire}
                    onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  {editingId ? 'Modifier' : 'Ajouter'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
