'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Clock } from 'lucide-react';
import type { MainCourante } from '@/types';

export default function JournalPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState<MainCourante[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    heure: '', type_evenement: '', description: '', lieu: '', priorite: 'normale', statut: 'en_cours'
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    else if (user) loadData();
  }, [user, authLoading, router]);

  const loadData = async () => {
    try {
      const { data: journal, error } = await supabase.from('main_courante').select('*').order('date', { ascending: false }).limit(50);
      if (error) throw error;
      setData(journal || []);
    } catch (error) {
      alert('Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabase.from('main_courante').insert([{ ...formData, auteur_id: user?.id, auteur_nom: user?.email }]);
      setShowModal(false);
      setFormData({ heure: '', type_evenement: '', description: '', lieu: '', priorite: 'normale', statut: 'en_cours' });
      loadData();
      alert('Ajouté');
    } catch (error) {
      alert('Erreur');
    }
  };

  if (authLoading || loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"><ArrowLeft size={20} />Retour</Link>
          <div className="flex justify-between items-center">
            <div><h1 className="text-3xl font-bold text-gray-900">Main Courante</h1><p className="text-sm text-gray-500 mt-1">Journal des événements</p></div>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"><Plus size={20} />Ajouter un événement</button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {data.length === 0 ? (
            <div className="bg-white rounded-lg border-2 border-dashed p-12 text-center"><p className="text-gray-500">Aucun événement</p></div>
          ) : (
            data.map(item => (
              <div key={item.id} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <Clock size={20} className="text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">{new Date(item.date || '').toLocaleDateString('fr-FR')} {item.heure}</p>
                      {item.type_evenement && <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">{item.type_evenement}</span>}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${item.priorite === 'haute' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{item.priorite}</span>
                </div>
                <p className="text-gray-900 mb-2">{item.description}</p>
                {item.lieu && <p className="text-sm text-gray-500">📍 {item.lieu}</p>}
                {item.auteur_nom && <p className="text-xs text-gray-400 mt-2">Par: {item.auteur_nom}</p>}
              </div>
            ))
          )}
        </div>
      </main>
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center p-6 border-b"><h3 className="text-xl font-semibold">Ajouter un événement</h3><button onClick={() => setShowModal(false)}><X size={24} /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Heure</label><input type="time" value={formData.heure} onChange={(e) => setFormData({...formData, heure: e.target.value})} className="w-full px-4 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Type</label><input type="text" value={formData.type_evenement} onChange={(e) => setFormData({...formData, type_evenement: e.target.value})} className="w-full px-4 py-2 border rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Description *</label><textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required rows={3} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2">Lieu</label><input type="text" value={formData.lieu} onChange={(e) => setFormData({...formData, lieu: e.target.value})} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Priorité</label><select value={formData.priorite} onChange={(e) => setFormData({...formData, priorite: e.target.value})} className="w-full px-4 py-2 border rounded-lg"><option value="normale">Normale</option><option value="haute">Haute</option><option value="basse">Basse</option></select></div>
                <div><label className="block text-sm font-medium mb-2">Statut</label><select value={formData.statut} onChange={(e) => setFormData({...formData, statut: e.target.value})} className="w-full px-4 py-2 border rounded-lg"><option value="en_cours">En cours</option><option value="resolu">Résolu</option><option value="archive">Archivé</option></select></div>
              </div>
              <div className="flex gap-4 mt-6">
                <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">Ajouter</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
