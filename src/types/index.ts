export interface PmrData {
  id: string;
  rampe_id?: string;
  gare: string;
  quai?: string;
  zone?: string;
  type_assistance?: string;
  etat_rampe?: string;
  date_panne?: string;
  commentaire?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Taxi {
  id: string;
  compagnie: string;
  telephone?: string;
  email?: string;
  zone_couverture?: string;
  pmr_disponible?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContactRepertoire {
  id: string;
  nom: string;
  prenom?: string;
  fonction?: string;
  service?: string;
  telephone?: string;
  email?: string;
  notes?: string;
  favoris?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PmrClient {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  besoins_specifiques?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MainCourante {
  id: string;
  date?: string;
  heure?: string;
  type_evenement?: string;
  description: string;
  lieu?: string;
  auteur_id?: string;
  auteur_nom?: string;
  priorite?: string;
  statut?: string;
  created_at?: string;
  updated_at?: string;
}
