'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Edit, Trash2, X, Phone, Mail } from 'lucide-react';
import type { ContactRepertoire } from '@/types';

export default function RepertoirePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState<ContactRepertoire[]>([]);
  const [filteredData, setFilteredData] = useState<ContactRepertoire[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nom: '', prenom: '', fonction: '', service: '', telephone: '', email: '', notes: '', favoris: false,
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    else if (user) loadData();
  }, [user, authLoading, router]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = data.filter(item =>
      item.nom?.toLowerCase().includes(term) || item.prenom?.toLowerCase().includes(term) ||
      item.fonction?.toLowerCase().includes(term) || item.service?.toLowerCase().includes(term)
    );
    setFilteredData(filtered);
  }, [data, searchTerm]);

  const loadData = async () => {
    try {
      const { data: contacts, error } = await supabase.from('contacts_repertoire').select('*').order('nom', { ascending: true });
      if (error) throw error;
      setData(contacts || []);
    } catch (error) {
      alert('Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item?: ContactRepertoire) => {
    if (item) {
      setEditingId(item.id);
      setFormData({ nom: item.nom || '', prenom: item.prenom || '', fonction: item.fonction || '', service: item.service || '', telephone: item.telephone || '', email: item.email || '', notes: item.notes || '', favoris: item.favoris || false });
    } else {
      setEditingId(null);
      setFormData({ nom: '', prenom: '', fonction: '', service: '', telephone: '', email: '', notes: '', favoris: false });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase.from('contacts_repertoire').update(formData).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('contacts_repertoire').insert([formData]);
        if (error) throw error;
      }
      setShowModal(false);
      loadData();
      alert('Sauvegardé');
    } catch (error) {
      alert('Erreur sauvegarde');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ?')) return;
    try {
      await supabase.from('contacts_repertoire').delete().eq('id', id);
      loadData();
    } catch (error) {
      alert('Erreur suppression');
    }
  };

  if (authLoading || loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"><ArrowLeft size={20} />Retour</Link>
          <div className="flex justify-between items-center">
            <div><h1 className="text-3xl font-bold text-gray-900">Répertoire</h1><p className="text-sm text-gray-500 mt-1">Contacts et annuaire</p></div>
            <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"><Plus size={20} />Ajouter</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.length === 0 ? (
            <div className="col-span-full bg-white rounded-lg border-2 border-dashed p-12 text-center"><p className="text-gray-500">Aucun contact</p></div>
          ) : (
            filteredData.map(item => (
              <div key={item.id} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex justify-between items-start mb-4">
                  <div><h3 className="text-xl font-bold">{item.nom} {item.prenom}</h3>{item.fonction && <p className="text-sm text-gray-600">{item.fonction}</p>}{item.service && <p className="text-sm text-gray-500">{item.service}</p>}</div>
                  <div className="flex gap-2">
                    <button onClick={() => openModal(item)} className="text-purple-600"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600"><Trash2 size={18} /></button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {item.telephone && <div className="flex items-center gap-2"><Phone size={16} /><a href={`tel:${item.telephone}`}>{item.telephone}</a></div>}
                  {item.email && <div className="flex items-center gap-2"><Mail size={16} /><a href={`mailto:${item.email}`}>{item.email}</a></div>}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center p-6 border-b"><h3 className="text-xl font-semibold">{editingId ? 'Modifier' : 'Ajouter'}</h3><button onClick={() => setShowModal(false)}><X size={24} /></button></div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Nom *</label><input type="text" value={formData.nom} onChange={(e) => setFormData({...formData, nom: e.target.value})} required className="w-full px-4 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Prénom</label><input type="text" value={formData.prenom} onChange={(e) => setFormData({...formData, prenom: e.target.value})} className="w-full px-4 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Fonction</label><input type="text" value={formData.fonction} onChange={(e) => setFormData({...formData, fonction: e.target.value})} className="w-full px-4 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Service</label><input type="text" value={formData.service} onChange={(e) => setFormData({...formData, service: e.target.value})} className="w-full px-4 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Téléphone</label><input type="tel" value={formData.telephone} onChange={(e) => setFormData({...formData, telephone: e.target.value})} className="w-full px-4 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border rounded-lg" /></div>
                <div className="col-span-2"><label className="block text-sm font-medium mb-2">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} className="w-full px-4 py-2 border rounded-lg" /></div>
              </div>
              <div className="flex gap-4 mt-6">
                <button type="submit" className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">{editingId ? 'Modifier' : 'Ajouter'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
