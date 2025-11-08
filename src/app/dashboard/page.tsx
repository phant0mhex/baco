'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { Users, Bus, Car, FileText, Calendar, Settings, LogOut, BookOpen, Clipboard } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const menuItems = [
    { title: 'PMR', href: '/pmr', icon: Users, color: 'bg-blue-500', description: 'Rampes et restrictions' },
    { title: 'Clients PMR', href: '/clients-pmr', icon: Users, color: 'bg-cyan-500', description: 'Gestion clients PMR' },
    { title: 'Bus', href: '/bus', icon: Bus, color: 'bg-green-500', description: 'Lignes et chauffeurs' },
    { title: 'Taxi', href: '/taxi', icon: Car, color: 'bg-yellow-500', description: 'Compagnies de taxi' },
    { title: 'Répertoire', href: '/repertoire', icon: FileText, color: 'bg-purple-500', description: 'Contacts' },
    { title: 'Lignes', href: '/lignes', icon: Calendar, color: 'bg-pink-500', description: 'Données lignes' },
    { title: 'PT Car', href: '/ptcar', icon: Bus, color: 'bg-indigo-500', description: 'Abréviations' },
    { title: 'Documents', href: '/documents', icon: FileText, color: 'bg-orange-500', description: 'Documentation' },
    { title: 'Journal', href: '/journal', icon: Clipboard, color: 'bg-red-500', description: 'Main courante' },
    { title: 'Opérationnel', href: '/operationnel', icon: BookOpen, color: 'bg-teal-500', description: 'Procédures' },
    { title: 'Profil', href: '/profil', icon: Settings, color: 'bg-gray-500', description: 'Mon profil' },
    { title: 'Admin', href: '/admin', icon: Settings, color: 'bg-gray-700', description: 'Administration' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">BACO Portal</h1>
            <p className="text-sm text-gray-500 mt-1">Portail interne</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut size={16} />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-2 text-gray-900">Bienvenue</h2>
        <p className="text-gray-600 mb-8">Sélectionnez un module pour commencer</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all p-6 border border-gray-100 hover:border-gray-200 group"
            >
              <div className="flex flex-col gap-4">
                <div className={`${item.color} rounded-lg p-3 text-white w-fit group-hover:scale-110 transition-transform`}>
                  <item.icon size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
