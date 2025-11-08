'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Edit, Trash2, X, Phone, Mail, MapPin } from 'lucide-react';
import type { Taxi } from '@/types';

export default function TaxiPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [data, setData] = useState<Taxi[]>([]);
  const [filteredData, setFilteredData] = useState<Taxi[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPmr, setFilterPmr] = useState('all');

  const [formData, setFormData] = useState({
    compagnie: '',
    telephone: '',
    email: '',
    zone_couverture: '',
    pmr_disponible: false,
    notes: '',
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
  }, [data, searchTerm, filterPmr]);

  const loadData = async () => {
    try {
      const { data: taxiData, error } = await supabase
        .from('taxis')
        .select('*')
        .order('compagnie', { ascending: true });

      if (error) throw error;
      setData(taxiData || []);
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
          item.compagnie?.toLowerCase().includes(term) ||
          item.telephone?.toLowerCase().includes(term) ||
          item.zone_couverture?.toLowerCase().includes(term)
      );
    }

    if (filterPmr === 'yes') {
      filtered = filtered.filter((item) => item.pmr_disponible === true);
    } else if (filterPmr === 'no') {
      filtered = filtered.filter((item) => item.pmr_disponible === false);
    }

    setFilteredData(filtered);
  };

  const openModal = (item?: Taxi) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        compagnie: item.compagnie || '',
        telephone: item.telephone || '',
        email: item.email || '',
        zone_couverture: item.zone_couverture || '',
        pmr_disponible: item.pmr_disponible || false,
        notes: item.notes || '',
      });
    } else {
      setEditingId(null);
      setFormData({
        compagnie: '',
        telephone: '',
        email: '',
        zone_couverture: '',
        pmr_disponible: false,
        notes: '',
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
          .from('taxis')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        alert('Modifié avec succès');
      } else {
        const { error } = await supabase.from('taxis').insert([formData]);

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
    if (!confirm('Supprimer cette compagnie ?')) return;

    try {
      const { error } = await supabase.from('taxis').delete().eq('id', id);

      if (error) throw error;
      alert('Supprimé avec succès');
      loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
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
              <h1 className="text-3xl font-bold text-gray-900">Compagnies de Taxi</h1>
              <p className="text-sm text-gray-500 mt-1">
                Gérez les compagnies de taxi et leur disponibilité PMR
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
            >
              <Plus size={20} />
              Ajouter une compagnie
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filtres</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  placeholder="Compagnie, téléphone, zone..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Disponibilité PMR
              </label>
              <select
                value={filterPmr}
                onChange={(e) => setFilterPmr(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              >
                <option value="all">Tous</option>
                <option value="yes">PMR disponible</option>
                <option value="no">PMR non disponible</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.length === 0 ? (
            <div className="col-span-full bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500 text-lg">Aucune compagnie de taxi trouvée</p>
              <p className="text-gray-400 text-sm mt-2">
                Modifiez vos filtres ou ajoutez une nouvelle compagnie
              </p>
            </div>
          ) : (
            filteredData.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{item.compagnie}</h3>
                    {item.pmr_disponible && (
                      <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        PMR Disponible
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(item)}
                      className="text-yellow-600 hover:text-yellow-800"
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

                <div className="space-y-3 text-sm">
                  {item.telephone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone size={16} className="text-gray-400" />
                      <a href={`tel:${item.telephone}`} className="hover:text-yellow-600">
                        {item.telephone}
                      </a>
                    </div>
                  )}
                  {item.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail size={16} className="text-gray-400" />
                      <a href={`mailto:${item.email}`} className="hover:text-yellow-600">
                        {item.email}
                      </a>
                    </div>
                  )}
                  {item.zone_couverture && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin size={16} className="text-gray-400" />
                      <span>{item.zone_couverture}</span>
                    </div>
                  )}
                  {item.notes && (
                    <div className="pt-3 border-t mt-3">
                      <p className="text-gray-600 text-xs">{item.notes}</p>
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
                {editingId ? 'Modifier la compagnie' : 'Ajouter une compagnie'}
              </h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom de la compagnie *
                  </label>
                  <input
                    type="text"
                    value={formData.compagnie}
                    onChange={(e) => setFormData({ ...formData, compagnie: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zone de couverture
                  </label>
                  <input
                    type="text"
                    value={formData.zone_couverture}
                    onChange={(e) =>
                      setFormData({ ...formData, zone_couverture: e.target.value })
                    }
                    placeholder="Ex: Tournai, Lille, Région..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="pmr_disponible"
                    checked={formData.pmr_disponible}
                    onChange={(e) =>
                      setFormData({ ...formData, pmr_disponible: e.target.checked })
                    }
                    className="w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                  />
                  <label htmlFor="pmr_disponible" className="text-sm font-medium text-gray-700">
                    PMR disponible
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 transition font-medium"
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
