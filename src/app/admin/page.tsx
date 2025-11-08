'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function Page() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6">
          <ArrowLeft size={20} />
          Retour au tableau de bord
        </Link>
        <h1 className="text-4xl font-bold mb-4 text-gray-900">MODULE_NAME</h1>
        <div className="bg-white rounded-lg shadow p-8">
          <p className="text-gray-600">Module en cours de développement...</p>
          <p className="text-sm text-gray-500 mt-2">Les fonctionnalités seront ajoutées progressivement.</p>
        </div>
      </div>
    </div>
  );
}
