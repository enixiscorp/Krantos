import type { PowerUnit } from '../lib/supabase';

export type ApplianceCategory =
  | 'Électroménager'
  | 'Climatisation & Ventilation'
  | 'Éclairage'
  | 'Informatique & Électronique'
  | 'Énergie solaire & autonome'
  | 'Coiffure & Esthétique'
  | 'Beauté (Pédicure/Manucure)'
  | 'Eau & Pompage'
  | 'Pro / Industriel léger'
  | 'Automobile / Mobile';

export type AppliancePreset = {
  id: string;
  label: string;
  category: ApplianceCategory;
  unit: Extract<PowerUnit, 'W'>;
  /** Puissance moyenne conseillée (W) */
  typical_watts: number;
  /** Plage indicative (W) */
  min_watts: number;
  max_watts: number;
};

function preset(
  label: string,
  category: ApplianceCategory,
  min_watts: number,
  max_watts: number,
  typical_watts?: number
): AppliancePreset {
  const typical = typical_watts ?? Math.round((min_watts + max_watts) / 2);
  return {
    id: `${category}:${label}`.toLowerCase(),
    label,
    category,
    unit: 'W',
    typical_watts: typical,
    min_watts,
    max_watts,
  };
}

export const APPLIANCE_CATALOG: AppliancePreset[] = [
  // 1. Électroménager (Cuisine & Maison)
  preset('Réfrigérateur', 'Électroménager', 100, 300),
  preset('Congélateur', 'Électroménager', 150, 400),
  preset('Micro-ondes', 'Électroménager', 800, 1500),
  preset('Bouilloire électrique', 'Électroménager', 1500, 3000),
  preset('Mixeur / Blender', 'Électroménager', 300, 1000),
  preset('Plaque électrique', 'Électroménager', 1000, 2500),
  preset('Four électrique', 'Électroménager', 2000, 5000),
  preset('Cuisinière (plaque + four)', 'Électroménager', 3000, 7000),
  preset('Cafetière', 'Électroménager', 600, 1200),
  preset('Grille-pain', 'Électroménager', 800, 1500),
  preset('Lave-vaisselle', 'Électroménager', 1200, 2500),
  preset('Machine à laver', 'Électroménager', 500, 2500),
  preset('Sèche-linge', 'Électroménager', 2000, 4000),
  preset('Aspirateur', 'Électroménager', 600, 2000),
  preset('Fer à repasser', 'Électroménager', 1000, 3000),

  // 2. Climatisation & Ventilation
  preset('Ventilateur', 'Climatisation & Ventilation', 40, 100),
  preset('Climatiseur 1 CV', 'Climatisation & Ventilation', 750, 1000),
  preset('Climatiseur 1.5 CV', 'Climatisation & Ventilation', 1000, 1500),
  preset('Climatiseur 2 CV', 'Climatisation & Ventilation', 1500, 2500),
  preset('Extracteur d’air', 'Climatisation & Ventilation', 20, 100),

  // 3. Éclairage (Ampoules & Lampes)
  preset('Ampoule LED', 'Éclairage', 5, 20),
  preset('Ampoule incandescente', 'Éclairage', 40, 100),
  preset('Ampoule halogène', 'Éclairage', 20, 500),
  preset('Tube néon', 'Éclairage', 18, 58),
  preset('Projecteur LED', 'Éclairage', 30, 300),
  preset('Ring light', 'Éclairage', 10, 100),
  preset('Lampe solaire', 'Éclairage', 5, 50),
  preset('Torche rechargeable', 'Éclairage', 3, 20),
  preset('Lampadaire LED', 'Éclairage', 20, 100),

  // 4. Informatique & Électronique
  preset('Ordinateur portable', 'Informatique & Électronique', 30, 100),
  preset('Ordinateur bureau', 'Informatique & Électronique', 150, 500),
  preset('Écran', 'Informatique & Électronique', 20, 100),
  preset('Téléviseur LED', 'Informatique & Électronique', 50, 200),
  preset('Routeur WiFi', 'Informatique & Électronique', 5, 20),
  preset('Imprimante', 'Informatique & Électronique', 20, 500),
  preset('Console de jeux', 'Informatique & Électronique', 100, 250),
  preset('Chargeur téléphone', 'Informatique & Électronique', 5, 20),
  preset('Power bank', 'Informatique & Électronique', 10, 30),
  preset('Microphone rechargeable', 'Informatique & Électronique', 5, 20),

  // 5. Énergie solaire & autonome
  preset('Panneau solaire (petit)', 'Énergie solaire & autonome', 50, 200),
  preset('Panneau solaire (maison)', 'Énergie solaire & autonome', 300, 600),
  preset('Kit solaire domestique', 'Énergie solaire & autonome', 100, 1000),
  preset('Onduleur', 'Énergie solaire & autonome', 500, 5000),

  // 6. Coiffure & Esthétique
  preset('Sèche-cheveux', 'Coiffure & Esthétique', 1000, 2500),
  preset('Fer à lisser', 'Coiffure & Esthétique', 30, 150),
  preset('Fer à boucler', 'Coiffure & Esthétique', 30, 200),
  preset('Tondeuse cheveux', 'Coiffure & Esthétique', 5, 20),
  preset('Casque sèche-cheveux', 'Coiffure & Esthétique', 800, 2000),
  preset('Lampe UV ongles', 'Coiffure & Esthétique', 24, 120),
  preset('Aspirateur manucure', 'Coiffure & Esthétique', 20, 80),

  // 7. Pédicure / Manucure / Beauté
  preset('Lime électrique', 'Beauté (Pédicure/Manucure)', 10, 50),
  preset('Stérilisateur UV', 'Beauté (Pédicure/Manucure)', 5, 20),
  preset('Bain de pieds électrique', 'Beauté (Pédicure/Manucure)', 100, 500),
  preset('Machine vapeur visage', 'Beauté (Pédicure/Manucure)', 200, 800),

  // 8. Eau & Pompage
  preset('Pompe à eau domestique', 'Eau & Pompage', 250, 1500),
  preset('Pompe immergée', 'Eau & Pompage', 500, 3000),
  preset('Chauffe-eau électrique', 'Eau & Pompage', 1500, 5000),

  // 9. Usage professionnel / industriel léger
  preset('Machine à coudre', 'Pro / Industriel léger', 50, 150),
  preset('Compresseur', 'Pro / Industriel léger', 750, 3000),
  preset('Perceuse', 'Pro / Industriel léger', 500, 1500),
  preset('Scie électrique', 'Pro / Industriel léger', 1000, 2000),
  preset('Soudeuse', 'Pro / Industriel léger', 2000, 5000),
  preset('Groupe électrogène', 'Pro / Industriel léger', 1000, 10000, 5000),

  // 10. Automobile / Mobile
  preset('Chargeur voiture', 'Automobile / Mobile', 50, 300),
  preset('Autoradio', 'Automobile / Mobile', 10, 50),
  preset('Frigo voiture', 'Automobile / Mobile', 30, 100),
];

export const APPLIANCE_CATEGORIES: ApplianceCategory[] = [
  'Électroménager',
  'Climatisation & Ventilation',
  'Éclairage',
  'Informatique & Électronique',
  'Énergie solaire & autonome',
  'Coiffure & Esthétique',
  'Beauté (Pédicure/Manucure)',
  'Eau & Pompage',
  'Pro / Industriel léger',
  'Automobile / Mobile',
];

export function findAppliancePreset(label: string): AppliancePreset | undefined {
  return APPLIANCE_CATALOG.find((p) => p.label === label);
}

